import type { Asset, Project, Track, VideoItem } from '../model/types';
import { Compositor } from './compositor';
import { VideoPool } from './mediaPool';
import { captureThumb } from './probe';
import { buildScene } from './scene';
import { mainTrack, sourceTimeAt, totalDuration } from './timeline';
import { usePreferences } from '../store/preferences';
import { AudioBus, audibleClips } from './audio';
import { AnimatedGif } from './gif';
import { getMedia } from '../storage/media';

type Deps = {
  getProject: () => Project | null;
  urlFor: (assetId: string) => string | undefined;
  /** 素材沒有縮圖時，播放器拿到畫面後順手擷取一張（iPhone 匯入時可能產生不出來） */
  onThumb?: (assetId: string, thumbs: string[]) => void;
};
type Listener = (t: number, playing: boolean) => void;

const DRIFT = 0.3;
const PREFETCH_S = 1.0;
const POOL_SIZE = 8;

/** 預覽保留專案解析度，長邊最多 1920，避免手機高密度螢幕把文字放糊。 */
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
  private playing = false;
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

  private constructor(
    readonly compositor: Compositor,
    private pool: VideoPool,
    private deps: Deps,
    audioContext?: AudioContext,
  ) {
    this.bus = new AudioBus(pool.els, audioContext);
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
    const compositor = await Compositor.create({ ...size, canvas: opts.canvas });
    let player: Player | null = null;
    const pool = new VideoPool(opts.host, POOL_SIZE, () => player?.scheduleRender());
    player = new Player(compositor, pool, opts, opts.audioContext);
    return player;
  }

  get time() {
    return this.t;
  }
  get isPlaying() {
    return this.playing;
  }

  subscribe(fn: Listener): () => void {
    this.listeners.add(fn);
    return () => this.listeners.delete(fn);
  }

  private emit() {
    const now = performance.now();
    if (this.playing && now - this.lastEmit < 80) return;
    this.lastEmit = now;
    for (const l of this.listeners) l(this.t, this.playing);
  }

  private total(): number {
    const p = this.deps.getProject();
    return p ? totalDuration(p) : 0;
  }

  seek(t: number) {
    this.previewTime = null;
    this.t = Math.min(Math.max(t, 0), this.total());
    if (this.playing) {
      this.wallStart = performance.now();
      this.tStart = this.t;
    }
    this.render(this.t);
    this.emit();
  }

  /** 只更新畫面到 t 秒，不移動播放頭（修剪時預覽邊緣畫格用） */
  peek(t: number) {
    if (this.playing) return;
    this.previewTime = Math.min(Math.max(t, 0), this.total());
    this.scheduleRender();
  }

  play() {
    const total = this.total();
    if (total <= 0 || this.playing) return;
    this.previewTime = null;
    if (this.t >= total - 0.01) this.t = 0;
    this.bus.unlock();
    this.pool.unlock();
    this.playing = true;
    this.wallStart = performance.now();
    this.tStart = this.t;
    this.render(this.t);
    this.emit();
    this.raf = requestAnimationFrame(this.tick);
  }

  pause() {
    if (!this.playing) return;
    this.playing = false;
    cancelAnimationFrame(this.raf);
    this.render(this.t);
    this.emit();
  }

  toggle() {
    if (this.playing) this.pause();
    else this.play();
  }

  /** 專案內容改變後呼叫：修正播放頭並重新對畫面 */
  refresh() {
    this.previewTime = null;
    const total = this.total();
    if (this.t > total) this.t = total;
    this.scheduleRender();
    this.emit();
  }

  scheduleRender() {
    if (this.playing || this.renderRaf) return;
    this.renderRaf = requestAnimationFrame(() => {
      this.renderRaf = 0;
      if (!this.playing) this.render(this.previewTime ?? this.t);
    });
  }

  private tick = () => {
    if (!this.playing) return;
    const total = this.total();
    const t = this.tStart + (performance.now() - this.wallStart) / 1000;
    const frameStep = 1 / (this.deps.getProject()?.fps ?? 30);
    if (t < this.t + frameStep - 0.002 && t < total) {
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

  private syncVideo(el: HTMLVideoElement, item: VideoItem, asset: Asset, track: Track, t: number) {
    el.dataset.previewIntent = this.playing ? 'play' : 'pause';
    const s = sourceTimeAt(item, t);
    const gain = track.muted || item.audioEnabled === false || !asset.hasAudio ? 0 : item.volume;
    this.bus.set(el, gain);
    el.muted = !!el.dataset.priming || gain === 0;
    el.preservesPitch = false;
    el.playbackRate = item.speed;
    if (this.playing) {
      if (Math.abs(el.currentTime - s) > DRIFT && el.readyState >= 1) el.currentTime = s;
      if (el.paused) void el.play().catch(() => {});
    } else {
      if (!el.paused && !el.dataset.priming) el.pause();
      if (Math.abs(el.currentTime - s) > 0.02 && el.readyState >= 1) el.currentTime = s;
    }
  }

  private render(t: number) {
    const p = this.deps.getProject();
    const { compositor: comp } = this;
    if (!p) {
      comp.render([]);
      return;
    }
    const used = new Set<HTMLVideoElement>();
    this.bus.clear();

    const scene = buildScene(p, t, comp.width, comp.height, (item, asset, track) => {
      const url = this.deps.urlFor(asset.id);
      if (!url) return null;
      if (item.type === 'image') {
        if (asset.mime === 'image/gif') {
          const gif = this.gifs.get(asset.id);
          if (gif) {
            const frame = gif.frame(sourceTimeAt(item, t));
            return {
              source: frame.canvas,
              ready: true,
              srcW: frame.canvas.width,
              srcH: frame.canvas.height,
              stamp: frame.stamp,
            };
          }
          if (!this.gifLoading.has(asset.id)) {
            this.gifLoading.add(asset.id);
            void getMedia(p.id, asset.id, asset.mime)
              .then(AnimatedGif.load)
              .then((loaded) => {
                if (this.destroyed) return loaded.destroy();
                this.gifs.set(asset.id, loaded);
                this.scheduleRender();
              })
              .catch(() => this.scheduleRender());
          }
        }
        const img = this.imageFor(asset.id);
        if (!img) return null;
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
      if (
        track.kind === 'main' &&
        p.layout &&
        t >= p.layout.start &&
        t < p.layout.start + p.layout.duration &&
        p.tracks.some((tr) => tr.template && !tr.hidden && tr.items.length)
      )
        el.muted = true;
      this.maybeCaptureThumb(el, asset);
      return {
        source: el,
        ready: el.readyState >= 2 && !el.seeking && el.videoWidth > 0,
        srcW: el.videoWidth || asset.width,
        srcH: el.videoHeight || asset.height,
      };
    });

    for (const { item, asset, track } of audibleClips(p, t)) {
      if (item.type !== 'audio') continue;
      const url = this.deps.urlFor(asset.id);
      if (!url) continue;
      const el = this.pool.acquire(item.id, asset.id, url, used, true);
      if (!el) continue;
      used.add(el);
      this.syncVideo(el, item, asset, track, t);
    }

    this.frameReady =
      scene.every((layer) => layer.ready) && [...used].every((el) => el.readyState >= 2 && !el.seeking);

    // 預載：下一個主軌片段、1 秒內要開始的疊加影片
    for (const { item, asset } of this.upcoming(p, t)) {
      const url = this.deps.urlFor(asset.id);
      if (!url) continue;
      const el = this.pool.acquire(item.id, asset.id, url, used);
      if (!el) continue;
      used.add(el);
      if (el.dataset.primed !== '1') {
        if (el.readyState >= 1) el.currentTime = item.trimIn;
        el.dataset.primed = '1';
      }
      if (!el.paused) el.pause();
    }
    this.pool.pauseAllExcept(used);
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
        for (const it of items as VideoItem[]) if (it.start > t && it.start <= t + PREFETCH_S) push(it);
      }
    }
    return out;
  }

  audioEnergy() {
    return this.bus.energy();
  }

  captureAudio(): MediaStream | null {
    return this.bus.stream();
  }

  /** 預覽主軌目前的片段 id（測試用） */
  currentMainItemId(): string | undefined {
    const p = this.deps.getProject();
    if (!p) return undefined;
    return mainTrack(p).items.find((x) => this.t >= x.start && this.t < x.start + x.duration)?.id;
  }

  destroy() {
    this.destroyed = true;
    for (const gif of this.gifs.values()) gif.destroy();
    this.gifs.clear();
    cancelAnimationFrame(this.raf);
    cancelAnimationFrame(this.renderRaf);
    this.playing = false;
    this.listeners.clear();
    this.pool.destroy();
    this.bus.destroy();
    this.compositor.destroy();
  }
}
