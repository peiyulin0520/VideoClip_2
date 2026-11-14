import { cellMediaTime } from './templateTiming';
import type { Asset, Project, Track, VideoItem } from '../model/types';
import { Compositor, type SceneLayer } from './compositor';
import { toLocal } from './geometry';
import { audioWindowAt } from './audioEnvelope';
import { AudioPool } from './audioPool';
import { VideoPool } from './mediaPool';
import { captureThumb } from './probe';
import { buildScene } from './scene';
import { mainTrack, sourceTimeAt, totalDuration } from './timeline';
import { usePreferences } from '../store/preferences';
import { audioRetained } from './audioRanges';
import { AudioBus, audibleClips, previewPlaybackRate } from './audio';
import { AnimatedGif } from './gif';
import { getMedia } from '../storage/media';

type Deps = {
  getProject: () => Project | null;
  getLiftedId?: () => string | null;
  urlFor: (assetId: string) => string | undefined;
  /** 素材沒有縮圖時，播放器拿到畫面後順手擷取一張（iPhone 匯入時可能產生不出來） */
  clock?: 'preview' | 'wall';
  onPlaybackError?: (message: string) => void;
  onThumb?: (assetId: string, thumbs: string[]) => void;
};
type Listener = (t: number, playing: boolean) => void;

const DRIFT = 0.3;
const PREFETCH_S = 1.0;
const POOL_SIZE = 8;

/** 編輯預覽依裝置偏好；輸出可另外指定尺寸，文字仍獨立超取樣。 */
export function previewSize(
  p: Pick<Project, 'width' | 'height'>,
  maxSize = usePreferences.getState().preview,
): { width: number; height: number } {
  const k = Math.min(1, maxSize / Math.max(p.width, p.height));
  return { width: Math.round(p.width * k), height: Math.round(p.height * k) };
}

/**
 * 預覽播放引擎。時間由時鐘驅動；每個 t 算出要畫的圖層（主軌＋疊加＋文字…），
 * 影片物件各用一個 <video>（VideoPool），再交給 Pixi 合成到 canvas。
 * 即將開始的片段/疊加會提前載入並停在起點，切換時不會黑畫面。
 */
export class Player {
  private t = 0;
  private draftProject: Project | null = null;

  private getProject() {
    return this.draftProject ?? this.deps.getProject();
  }

  /** Temporary timing-sheet preview; never persisted or exported. */
  setPreviewProject(project: Project | null) {
    if (this.destroyed) return;
    this.draftProject = project;
    this.scheduleRender();
  }
  private playing = false;
  private buffering = false;
  private bufferSince = 0;
  private lastSeeks = new WeakMap<HTMLMediaElement, { target: number; at: number }>();
  private pendingPlay = new WeakSet<HTMLMediaElement>();
  private requestedSeek = false;
  private readyCount = 0;
  private expectedCount = 0;
  private audioPool: AudioPool;
  private raf = 0;
  private renderRaf = 0;
  private previewTime: number | null = null;
  private wallStart = 0;
  private tStart = 0;
  private listeners = new Set<Listener>();
  private images = new Map<string, HTMLImageElement>();
  private thumbTried = new Set<string>();
  private gifs = new Map<string, AnimatedGif>();
  private gifLoading = new Set<string>();
  private destroyed = false;
  private bus: AudioBus;
  private lastEmit = 0;
  frameReady = false;
  private preloadReady = false;
  private lastScene: SceneLayer[] = [];
  private hitCanvas: HTMLCanvasElement | null = null;

  private constructor(
    readonly compositor: Compositor,
    private pool: VideoPool,
    private deps: Deps,
    audioContext?: AudioContext,
  ) {
    this.audioPool = new AudioPool(pool.els[0]!.parentElement!, POOL_SIZE, () => this.scheduleRender());
    this.bus = new AudioBus([...pool.els, ...this.audioPool.els], audioContext);
  }

  static async create(
    opts: {
      host: HTMLElement;
      canvas: HTMLCanvasElement;
      maxSize?: number;
      audioContext?: AudioContext;
    } & Deps,
  ): Promise<Player> {
    const p = opts.getProject();
    const size = p ? previewSize(p, opts.maxSize) : { width: 540, height: 960 };
    const compositor = await Compositor.create({
      ...size,
      canvas: opts.canvas,
      preview: opts.clock !== 'wall' && Math.max(size.width, size.height) <= 720,
    });
    let player: Player | null = null;
    const pool = new VideoPool(opts.host, POOL_SIZE, () => player?.scheduleRender());
    player = new Player(compositor, pool, opts, opts.audioContext);
    return player;
  }

  get time() {
    return this.t;
  }

  /** One source pixel only on a selection gesture, never during playback/rendering. */
  opaqueAt(id: string, nx: number, ny: number): boolean {
    const layer = this.lastScene.find((l) => l.id === id);
    if (!layer || !layer.ready || layer.kind === 'video') return true;
    const point = toLocal(layer.box, nx * this.compositor.width, ny * this.compositor.height);
    const crop = layer.crop ?? { l: 0, t: 0, r: 0, b: 0 };
    const u = crop.l + (point.x / layer.box.w + 0.5) * (1 - crop.l - crop.r);
    const v = crop.t + (point.y / layer.box.h + 0.5) * (1 - crop.t - crop.b);
    const source = layer.source;
    const sw = 'naturalWidth' in source ? source.naturalWidth : source.width;
    const sh = 'naturalHeight' in source ? source.naturalHeight : source.height;
    if (!sw || !sh) return true;
    if (!this.hitCanvas) {
      this.hitCanvas = document.createElement('canvas');
      this.hitCanvas.width = this.hitCanvas.height = 1;
    }
    try {
      const ctx = this.hitCanvas.getContext('2d', { willReadFrequently: true })!;
      ctx.clearRect(0, 0, 1, 1);
      ctx.drawImage(
        source,
        Math.min(sw - 1, Math.max(0, u * sw)),
        Math.min(sh - 1, Math.max(0, v * sh)),
        1,
        1,
        0,
        0,
        1,
        1,
      );
      return ctx.getImageData(0, 0, 1, 1).data[3]! > 12;
    } catch {
      return true;
    }
  }

  get isBuffering() {
    return this.buffering;
  }

  /** Prepare the actual first drawable scene. Progress counts ready sources, never elapsed time. */
  async prepare(t = this.t, onProgress?: (value: number) => void) {
    this.pause();
    this.seek(t);
    const deadline = performance.now() + 15000;
    while (!this.frameReady || !this.preloadReady) {
      if (this.destroyed) return;
      onProgress?.(Math.min(99, Math.round((100 * this.readyCount) / Math.max(1, this.expectedCount))));
      if (performance.now() > deadline) throw Error('預覽素材尚未準備完成，請重試或略過無法載入的素材');
      await new Promise<void>((resolve) => setTimeout(resolve, 40));
      this.render(t);
    }
    onProgress?.(100);
  }

  get isReady() {
    return !this.destroyed && this.frameReady;
  }

  get isPlaying() {
    return this.playing;
  }

  subscribe(fn: Listener): () => void {
    this.listeners.add(fn);
    fn(this.t, this.playing);
    return () => this.listeners.delete(fn);
  }

  private emit() {
    const now = performance.now();
    if (this.playing && now - this.lastEmit < 80) return;
    this.lastEmit = now;
    for (const l of [...this.listeners]) l(this.t, this.playing);
  }

  private total(): number {
    const p = this.getProject();
    return p ? totalDuration(p) : 0;
  }

  seek(t: number) {
    if (this.destroyed) return;
    this.previewTime = null;
    this.t = Math.min(Math.max(t, 0), this.total());
    if (this.playing) {
      this.wallStart = performance.now();
      this.tStart = this.t;
    }
    this.requestedSeek = true;
    this.render(this.t);
    this.emit();
  }

  /** 只更新畫面到 t 秒，不移動播放頭（修剪時預覽邊緣畫格用） */
  peek(t: number) {
    if (this.destroyed) return;
    if (this.playing) return;
    this.previewTime = Math.min(Math.max(t, 0), this.total());
    this.scheduleRender();
  }

  play() {
    if (this.destroyed) return;
    const total = this.total();
    if (total <= 0 || this.playing) return;
    this.previewTime = null;
    if (this.t >= total - 0.01) this.t = 0;
    this.bus.unlock();
    this.playing = true;
    this.buffering = !this.frameReady;
    this.bufferSince = performance.now();
    this.wallStart = performance.now();
    this.tStart = this.t;
    this.render(this.t);
    this.pool.unlock();
    this.emit();
    this.raf = requestAnimationFrame(this.tick);
  }

  pause() {
    if (this.destroyed) return;
    this.playing = false;
    this.buffering = false;
    cancelAnimationFrame(this.raf);
    this.pool.pauseAllExcept(new Set(), (el) => this.bus.pause(el));
    this.audioPool.pauseAllExcept(new Set(), (el) => this.bus.pause(el));
    this.render(this.t);
    this.emit();
  }

  toggle() {
    if (this.playing) this.pause();
    else this.play();
  }

  /** 專案內容改變後呼叫：修正播放頭並重新對畫面 */
  refresh() {
    if (this.destroyed) return;
    this.previewTime = null;
    const total = this.total();
    if (this.t > total) this.t = total;
    this.scheduleRender();
    this.emit();
  }

  scheduleRender() {
    if (this.destroyed) return;
    if (this.playing || this.renderRaf) return;
    this.renderRaf = requestAnimationFrame(() => {
      this.renderRaf = 0;
      if (!this.playing) this.render(this.previewTime ?? this.t);
    });
  }

  private tick = () => {
    if (!this.playing) return;
    const total = this.total();
    const now = performance.now();
    if (!this.frameReady && this.deps.clock !== 'wall') {
      if (!this.buffering) this.bufferSince = now;
      this.buffering = true;
      this.wallStart = now;
      this.tStart = this.t;
      this.render(this.t);
      this.emit();
      if (now - this.bufferSince > 15000) {
        this.pause();
        this.deps.onPlaybackError?.('預覽暫時無法繼續，請稍候再播放');
        return;
      }
      this.raf = requestAnimationFrame(this.tick);
      return;
    }
    if (this.buffering) {
      this.buffering = false;
      this.wallStart = now;
      this.tStart = this.t;
      this.render(this.t);
    }
    const t = this.tStart + (now - this.wallStart) / 1000;
    const fps = this.getProject()?.fps ?? 30;
    if (Math.floor(t * fps) === Math.floor(this.t * fps) && t < total) {
      this.raf = requestAnimationFrame(this.tick);
      return;
    }
    if (t >= total) {
      this.t = total;
      this.playing = false;
      this.render(total);
      this.emit();
      return;
    }
    this.t = t;
    this.render(t);
    this.emit();
    this.raf = requestAnimationFrame(this.tick);
  };

  private imageFor(assetId: string): HTMLImageElement | null {
    let img = this.images.get(assetId);
    if (!img) {
      const url = this.deps.urlFor(assetId);
      if (!url) return null;
      img = new Image();
      img.onload = () => this.scheduleRender();
      img.src = url;
      this.images.set(assetId, img);
    }
    return img;
  }

  private syncVideo(el: HTMLMediaElement, item: VideoItem, asset: Asset, track: Track, t: number) {
    const active = this.playing && !this.buffering && t >= item.start && t < item.start + item.duration;
    el.dataset.previewIntent = active ? 'play' : 'pause';
    const s = sourceTimeAt(item, t);
    const gain =
      !active ||
      el.seeking ||
      t < item.start ||
      t >= item.start + item.duration ||
      (item.sourceRanges && cellMediaTime(item, t) === null) ||
      track.muted ||
      item.audioEnabled === false ||
      !audioRetained(item, s) ||
      !asset.hasAudio
        ? 0
        : item.volume;
    el.dataset.seekTarget = String(s);
    const now = performance.now(),
      last = this.lastSeeks.get(el);
    const delta = s - el.currentTime;
    if (
      el.readyState >= 1 &&
      !el.seeking &&
      Math.abs(delta) > (active && !this.requestedSeek ? DRIFT : 0.02) &&
      (!active || this.requestedSeek || !last || now - last.at > 1000)
    ) {
      this.lastSeeks.set(el, { target: s, at: now });
      this.bus.deferSeek(el, () => {
        if (!this.destroyed && el.dataset.itemId === item.id && el.dataset.assetId === asset.id) {
          el.currentTime = Math.max(0, Math.min(s, Math.max(0, asset.duration - 0.001)));
          this.scheduleRender();
        }
      });
    }
    this.bus.set(
      el,
      el.seeking || this.bus.isSeeking(el) ? 0 : gain,
      audioWindowAt(item, t),
      t - delta / item.speed,
    );
    if (!this.bus.owns(el)) el.muted = !!el.dataset.priming || gain === 0;
    if (!el.preservesPitch) el.preservesPitch = true;
    const rate = active && !asset.hasAudio ? previewPlaybackRate(delta, item.speed) : item.speed;
    if (el.playbackRate !== rate) el.playbackRate = rate;
    if (active) {
      if (el.paused && !this.pendingPlay.has(el)) {
        this.pendingPlay.add(el);
        void el.play().then(
          () => {
            this.pendingPlay.delete(el);
            if (this.destroyed) el.pause();
            else if (!this.playing || el.dataset.previewIntent !== 'play') this.bus.pause(el);
          },
          () => {
            this.pendingPlay.delete(el);
            if (this.playing && el.dataset.previewIntent === 'play') {
              this.pause();
              this.deps.onPlaybackError?.('瀏覽器尚未允許播放，請再點一次播放');
            }
          },
        );
      }
    } else if (!el.paused && !el.dataset.priming) this.bus.pause(el);
  }

  private render(t: number) {
    if (this.destroyed) return;
    const p = this.getProject();
    const { compositor: comp } = this;
    if (!p) {
      comp.render([]);
      return;
    }
    const used = new Set<HTMLVideoElement>(),
      usedAudio = new Set<HTMLAudioElement>();
    this.readyCount = 0;
    this.expectedCount = 0;
    this.bus.clear();

    const scene = buildScene(
      p,
      t,
      comp.width,
      comp.height,
      (item, asset, track) => {
        this.expectedCount++;
        const url = this.deps.urlFor(asset.id);
        if (!url) return null;
        if (item.type === 'image') {
          if (asset.mime === 'image/gif') {
            const gif = this.gifs.get(item.id);
            if (gif) {
              const frame = gif.frame(sourceTimeAt(item, t));
              this.readyCount++;
              return {
                source: frame.canvas,
                ready: true,
                srcW: frame.canvas.width,
                srcH: frame.canvas.height,
                stamp: frame.stamp,
              };
            }
            if (!this.gifLoading.has(item.id)) {
              this.gifLoading.add(item.id);
              void getMedia(p.id, asset.id, asset.mime)
                .then(AnimatedGif.load)
                .then((loaded) => {
                  if (this.destroyed) return loaded.destroy();
                  this.gifs.set(item.id, loaded);
                  this.scheduleRender();
                })
                .catch(() => this.scheduleRender());
            }
          }
          const img = this.imageFor(asset.id);
          if (!img) return null;
          if (img.complete && img.naturalWidth > 0) this.readyCount++;
          return {
            source: img,
            ready: img.complete && img.naturalWidth > 0,
            srcW: img.naturalWidth || asset.width,
            srcH: img.naturalHeight || asset.height,
          };
        }
        const el = this.pool.acquire(item.id, asset.id, url, used);
        if (!el) return null; // 同時疊的影片超過上限，多的不畫
        used.add(el);
        this.syncVideo(el, item, asset, track, t);
        if (el.readyState >= 2 && !el.seeking && !this.bus.isSeeking(el) && !el.dataset.priming)
          this.readyCount++;
        if (
          track.kind === 'main' &&
          !p.flexibleLayers &&
          p.layout &&
          t >= p.layout.start &&
          t < p.layout.start + p.layout.duration &&
          p.tracks.some((tr) => tr.template && !tr.hidden && tr.items.length)
        )
          el.muted = true;
        this.maybeCaptureThumb(el, asset);
        return {
          source: el,
          ready: el.readyState >= 2 && !el.seeking && !this.bus.isSeeking(el) && el.videoWidth > 0,
          srcW: el.videoWidth || asset.width,
          srcH: el.videoHeight || asset.height,
        };
      },
      this.deps.getLiftedId?.(),
    );

    for (const { item, asset, track } of audibleClips(p, t)) {
      if (item.type !== 'audio') continue;
      const url = this.deps.urlFor(asset.id);
      if (!url) continue;
      this.expectedCount++;
      const el = this.audioPool.acquire(item.id, asset.id, url, usedAudio);
      if (!el) continue;
      usedAudio.add(el);
      this.syncVideo(el, item, asset, track, t);
      if (el.readyState >= 2 && !el.seeking && !this.bus.isSeeking(el)) this.readyCount++;
    }

    this.frameReady =
      this.readyCount === this.expectedCount &&
      scene.every((layer) => layer.ready) &&
      [...used, ...usedAudio].every(
        (el) => el.readyState >= 2 && !el.seeking && !this.bus.isSeeking(el) && !el.dataset.priming,
      );

    // 預載：下一個主軌片段、1 秒內要開始的疊加影片
    for (const { item, asset } of this.upcoming(p, t)) {
      const url = this.deps.urlFor(asset.id);
      if (!url) continue;
      const el = this.pool.acquire(item.id, asset.id, url, used);
      if (!el) continue;
      used.add(el);
      el.dataset.seekTarget = String(item.trimIn);
      if (el.dataset.primed !== '1' && el.readyState >= 1 && !el.seeking) {
        el.currentTime = item.trimIn;
        el.dataset.primed = '1';
      }
      if (!el.paused) el.pause();
    }
    this.preloadReady = [...used, ...usedAudio].every(
      (el) => el.readyState >= 2 && !el.seeking && !this.bus.isSeeking(el) && !el.dataset.priming,
    );
    this.pool.pauseAllExcept(used, (el) => this.bus.pause(el));
    this.audioPool.pauseAllExcept(usedAudio, (el) => this.bus.pause(el));
    this.bus.flush();
    this.requestedSeek = false;
    this.lastScene = scene;
    comp.render(scene, p.background ?? '#000000');
  }

  private maybeCaptureThumb(el: HTMLVideoElement, asset: Asset) {
    if (!this.deps.onThumb || asset.thumbs.length > 0 || this.thumbTried.has(asset.id)) return;
    if (el.seeking || el.readyState < 2) return;
    const url = captureThumb(el);
    if (!url) return;
    this.thumbTried.add(asset.id);
    // render() 進行中不要改 store，等這一輪結束
    queueMicrotask(() => this.deps.onThumb?.(asset.id, [url]));
  }

  private upcoming(p: Project, t: number): { item: VideoItem; asset: Asset }[] {
    const out: { item: VideoItem; asset: Asset }[] = [];
    const push = (item: VideoItem) => {
      if (item.type !== 'video') return;
      const asset = p.assets.find((a) => a.id === item.assetId);
      if (asset) out.push({ item, asset });
    };
    for (const track of p.tracks) {
      if (track.hidden) continue;
      const items = track.items;
      if (track.kind === 'main' && !p.freeMain) {
        const first = items[0] as VideoItem | undefined;
        if (first && t < first.start) {
          if (first.start <= t + PREFETCH_S) push(first);
          continue;
        }
        const cur = (items as VideoItem[]).findIndex((x) => t < x.start + x.duration);
        const next = items[cur + 1] as VideoItem | undefined;
        if (cur >= 0 && next) push(next);
      } else if (track.kind === 'overlay' || track.kind === 'main') {
        const future = (items as VideoItem[])
          .filter((it) => it.start > t && it.start <= t + PREFETCH_S)
          .sort((a, b) => a.start - b.start);
        if (track.template) {
          for (const it of future.filter((it) => it.start === future[0]?.start)) push(it);
        } else if (future[0]) push(future[0]);
      }
    }
    return out;
  }

  audioProbe(milliseconds: number) {
    return this.bus.probe(milliseconds);
  }

  audioEnergy() {
    return this.bus.energy();
  }

  captureAudio(): MediaStream | null {
    return this.bus.stream();
  }

  /** 預覽主軌目前的片段 id（測試用） */
  currentMainItemId(): string | undefined {
    const p = this.getProject();
    if (!p) return undefined;
    return mainTrack(p).items.find((x) => this.t >= x.start && this.t < x.start + x.duration)?.id;
  }

  destroy() {
    if (this.destroyed) return;
    this.destroyed = true;
    for (const gif of this.gifs.values()) gif.destroy();
    this.gifs.clear();
    cancelAnimationFrame(this.raf);
    cancelAnimationFrame(this.renderRaf);
    this.playing = false;
    this.listeners.clear();
    this.pool.destroy();
    this.audioPool.destroy();
    this.bus.destroy();
    this.compositor.destroy();
  }
}
