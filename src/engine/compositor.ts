import { GradeFilter } from './GradeFilter';
import { gradeKey, hasGrade } from './grade';
import {
  Application,
  CanvasSource,
  Container,
  Graphics,
  Rectangle,
  Sprite,
  Texture,
  BlurFilter,
} from 'pixi.js';
import 'pixi.js/advanced-blend-modes';
import { paintMask } from './mediaMask';
import type { MediaMask, BlendMode, Crop, Outline, ColorAdjustment } from '../model/types';
import type { Box } from './geometry';
import { uiScale } from './textRender';

export type LayerSource =
  HTMLVideoElement | HTMLImageElement | HTMLCanvasElement | OffscreenCanvas | ImageBitmap;

/** 一個要畫的圖層（由 scene.ts 依專案與時間算出）。座標都是合成器畫布的像素。 */
export type SceneLayer = {
  id: string;
  continuity?: string;
  animationTransform?: { x: number; y: number; scaleX: number; scaleY: number; rotation: number };
  kind: 'video' | 'image' | 'text';
  source: LayerSource;
  /** 來源目前能不能取到畫面（影片正在 seek / 還沒載入就是 false，保留上一格） */
  ready: boolean;
  /** 來源的原始像素大小（文字用文字畫布大小） */
  srcW: number;
  srcH: number;
  box: Box;
  /** 文字：內容改變時才重新上傳貼圖 */
  textKey?: string;
  /** 影片/照片：暫存畫面的解析度（固定，免得縮放手勢時一直重建貼圖） */
  frameW?: number;
  frameH?: number;
  crop?: Crop;
  mask?: MediaMask;
  sourceStamp?: number;
  opacity: number;
  adjustment?: ColorAdjustment;
  blur?: number;
  blend: BlendMode;
  cornerRadius: number; // 0–0.5
  outline?: Outline;
  viewport?: { x: number; y: number; w: number; h: number };
  clipCircle?: { x: number; y: number; r: number };
};

type FrameResource = {
  source: LayerSource;
  contentKey: string;
  refs: number;
  canvas: HTMLCanvasElement;
  ctx: CanvasRenderingContext2D;
  texture: Texture;
  textureSource: CanvasSource;
  hasFrame: boolean;
  frameKey: string;
  alphaCanvas?: HTMLCanvasElement;
  alphaKey?: string;
};
type Obj = {
  container: Container;
  sprite: Sprite;
  texture: Texture | null;
  textureSource: CanvasSource | null;
  frame?: FrameResource;
  textKey: string | undefined;
  hasFrame: boolean;
  continuity?: string;
  mask: Graphics | null;
  outline: Graphics | null;
  maskKey: string;
  outlineKey: string;
  colorFilter?: GradeFilter;
  blurFilter?: BlurFilter;
  colorKey?: string;
  filterKey?: string;
};

export class Compositor {
  private objs = new Map<string, Obj>();
  private background = new Graphics();
  private backgroundColor = '';
  private uploads = 0;
  private allocations = 0;
  private colorAllocations = 0;
  private colorUpdates = 0;
  private maskStrings = new WeakMap<MediaMask, string>();
  private constructor(
    private app: Application,
    readonly width: number,
    readonly height: number,
    private preview = false,
  ) {
    this.app.stage.addChild(this.background);
  }

  static async create(opts: {
    width: number;
    height: number;
    canvas?: HTMLCanvasElement;
    preview?: boolean;
  }): Promise<Compositor> {
    const app = new Application();
    await app.init({
      canvas: opts.canvas,
      width: opts.width,
      height: opts.height,
      background: 0x000000,
      antialias: true,
      resolution: 1,
      autoDensity: false,
      autoStart: false,
      preference: 'webgl',
      preserveDrawingBuffer: true,
    });
    app.ticker.stop();
    return new Compositor(app, opts.width, opts.height, opts.preview);
  }

  get canvas(): HTMLCanvasElement {
    return this.app.canvas as HTMLCanvasElement;
  }

  render(layers: SceneLayer[], background = '#000000'): void {
    if (this.backgroundColor !== background) {
      this.background.clear().rect(0, 0, this.width, this.height).fill(background);
      this.backgroundColor = background;
    }
    const stage = this.app.stage;
    const seen = new Set<string>();
    const waiting = new Set(
      layers.filter((layer) => !layer.ready && layer.continuity).map((layer) => layer.continuity),
    );

    const frames = new Map<LayerSource, Map<string, FrameResource>>();
    layers.forEach((layer, index) => {
      seen.add(layer.id);
      const o = this.ensure(layer);
      o.continuity = layer.continuity;
      this.update(o, layer, frames);
      if (stage.children[index + 1] !== o.container)
        stage.addChildAt(o.container, Math.min(index + 1, stage.children.length));
    });

    // Keep only a previous clip on the SAME waiting track; deleted overlays and frames must disappear.
    for (const [id, o] of this.objs) {
      if (!seen.has(id) && !(o.continuity && waiting.has(o.continuity))) {
        this.destroyObj(o);
        this.objs.delete(id);
      }
    }
    this.app.renderer.render({ container: stage });
  }

  private ensure(layer: SceneLayer): Obj {
    let o = this.objs.get(layer.id);
    if (o) return o;
    const container = new Container();
    const sprite = new Sprite();
    sprite.anchor.set(0.5);
    container.addChild(sprite);
    container.visible = false;
    o = {
      container,
      sprite,
      texture: null,
      textureSource: null,

      textKey: undefined,
      hasFrame: false,

      mask: null,
      outline: null,
      maskKey: '',
      outlineKey: '',
    };
    this.objs.set(layer.id, o);
    return o;
  }

  private setSource(o: Obj, canvas: HTMLCanvasElement) {
    this.releaseFrame(o);
    this.allocations++;
    o.texture?.destroy(false);
    o.textureSource?.destroy();
    o.textureSource = new CanvasSource({ resource: canvas, scaleMode: 'linear' });
    o.texture = new Texture({ source: o.textureSource });
    o.sprite.texture = o.texture;
  }

  private releaseFrame(o: Obj) {
    const f = o.frame;
    if (!f) return;
    o.frame = undefined;
    if (--f.refs === 0) {
      f.texture.destroy(false);
      f.textureSource.destroy();
      f.canvas.width = f.canvas.height = 0;
    }
  }
  private bindFrame(o: Obj, frame: FrameResource) {
    if (o.frame === frame) return;
    this.releaseFrame(o);
    o.texture?.destroy(false);
    o.textureSource?.destroy();
    o.texture = null;
    o.textureSource = null;
    o.textKey = undefined;
    o.frame = frame;
    frame.refs++;
    o.sprite.texture = frame.texture;
  }
  private maskString(mask?: MediaMask) {
    if (!mask) return '';
    let key = this.maskStrings.get(mask);
    if (!key) {
      key = JSON.stringify(mask);
      this.maskStrings.set(mask, key);
    }
    return key;
  }
  private update(o: Obj, layer: SceneLayer, frames: Map<LayerSource, Map<string, FrameResource>>) {
    if (layer.kind === 'text') {
      if (o.textKey !== layer.textKey || !o.texture) {
        this.setSource(o, layer.source as HTMLCanvasElement);
        o.textKey = layer.textKey;
        o.hasFrame = true;
      }
    } else {
      const fw = Math.max(Math.round(layer.frameW ?? layer.box.w), 2),
        fh = Math.max(Math.round(layer.frameH ?? layer.box.h), 2);
      const crop = layer.crop ?? { l: 0, t: 0, r: 0, b: 0 },
        mask = this.maskString(layer.mask);
      const key = `${fw}|${fh}|${crop.l}|${crop.t}|${crop.r}|${crop.b}|${mask}`;
      let group = frames.get(layer.source);
      if (!group) {
        group = new Map();
        frames.set(layer.source, group);
      }
      let frame = group.get(key);
      if (!frame) {
        if (
          o.frame?.contentKey === key &&
          (o.frame.source === layer.source || o.frame.refs === 1 || !layer.ready)
        ) {
          frame = o.frame;
          if (layer.ready && frame.source !== layer.source) {
            frame.source = layer.source;
            frame.frameKey = '';
          }
        } else {
          const canvas = document.createElement('canvas');
          canvas.width = fw;
          canvas.height = fh;
          const textureSource = new CanvasSource({ resource: canvas, scaleMode: 'linear' });
          frame = {
            source: layer.source,
            contentKey: key,
            refs: 0,
            canvas,
            ctx: canvas.getContext('2d')!,
            textureSource,
            texture: new Texture({ source: textureSource }),
            hasFrame: false,
            frameKey: '',
          };
          this.allocations++;
        }
        group.set(key, frame);
      }
      this.bindFrame(o, frame);
      if (layer.ready) {
        const video = layer.source instanceof HTMLVideoElement ? layer.source : null;
        const frameKey = [
          layer.srcW,
          layer.srcH,
          layer.sourceStamp,
          video && !video.requestVideoFrameCallback ? Math.floor(video.currentTime * 30) : undefined,
          video?.requestVideoFrameCallback
            ? video.dataset.frameStamp
            : video?.getVideoPlaybackQuality?.().totalVideoFrames,
        ].join('|');
        if (!frame.hasFrame || frame.source !== layer.source || frame.frameKey !== frameKey)
          try {
            const ctx = frame.ctx;
            ctx.clearRect(0, 0, fw, fh);
            ctx.drawImage(
              layer.source,
              layer.srcW * crop.l,
              layer.srcH * crop.t,
              Math.max(layer.srcW * (1 - crop.l - crop.r), 1),
              Math.max(layer.srcH * (1 - crop.t - crop.b), 1),
              0,
              0,
              fw,
              fh,
            );
            if (layer.mask) {
              if (frame.alphaKey !== key) {
                const alpha = frame.alphaCanvas ?? document.createElement('canvas');
                alpha.width = fw;
                alpha.height = fh;
                const a = alpha.getContext('2d')!;
                a.save();
                a.scale(fw / (1 - crop.l - crop.r), fh / (1 - crop.t - crop.b));
                a.translate(-crop.l, -crop.t);
                a.scale(1 / layer.srcW, 1 / layer.srcH);
                paintMask(a, layer.mask, layer.srcW, layer.srcH);
                a.restore();
                frame.alphaCanvas = alpha;
                frame.alphaKey = key;
              }
              ctx.save();
              ctx.globalCompositeOperation = 'destination-in';
              ctx.drawImage(frame.alphaCanvas!, 0, 0);
              ctx.restore();
            }
            frame.textureSource.update();
            this.uploads++;
            frame.hasFrame = true;
            frame.source = layer.source;
            frame.frameKey = frameKey;
          } catch {
            /* Preserve the last drawable frame while decoding. */
          }
      }
      o.hasFrame = frame.hasFrame;
    }

    // ---- 位置、大小、旋轉、透明度、混合 ----
    const { box } = layer;
    o.container.visible = o.hasFrame;
    o.container.position.set(box.cx, box.cy);
    o.container.rotation = layer.viewport ? 0 : (box.rotation * Math.PI) / 180;
    o.sprite.rotation = layer.viewport ? (box.rotation * Math.PI) / 180 : 0;
    const animation = layer.animationTransform;
    o.container.scale.set(animation?.scaleX ?? 1, animation?.scaleY ?? 1);
    if (animation) {
      const angle = (animation.rotation * Math.PI) / 180;
      const x = (box.cx - animation.x) * animation.scaleX;
      const y = (box.cy - animation.y) * animation.scaleY;
      o.container.position.set(
        animation.x + x * Math.cos(angle) - y * Math.sin(angle),
        animation.y + x * Math.sin(angle) + y * Math.cos(angle),
      );
      o.container.rotation += angle;
    }
    o.container.alpha = layer.opacity;
    o.sprite.width = box.w;
    o.sprite.height = box.h;
    o.sprite.blendMode = layer.blend;
    const adjustment = layer.adjustment;
    o.sprite.tint = adjustment?.tint ?? '#ffffff';
    const filters = [];
    if (adjustment && hasGrade(adjustment)) {
      if (!o.colorFilter) {
        o.colorFilter = new GradeFilter();
        this.colorAllocations++;
      }
      const colorKey = gradeKey(adjustment);
      if (o.colorKey !== colorKey) {
        o.colorFilter.setTone(adjustment);
        o.colorKey = colorKey;
        this.colorUpdates++;
      }
      filters.push(o.colorFilter);
    }
    if (layer.blur && layer.blur > 0) {
      const blur = (o.blurFilter ??= new BlurFilter({
        strength: 1,
        quality: this.preview ? 1 : 3,
        resolution: this.preview ? 0.5 : 1,
      }));
      if (blur.strength !== layer.blur) blur.strength = layer.blur;
      filters.push(blur);
    }
    const filterKey = `${filters.includes(o.colorFilter!)}|${filters.includes(o.blurFilter!)}`;
    if (o.filterKey !== filterKey) {
      o.sprite.filters = filters;
      o.filterKey = filterKey;
    }

    // ---- 圓角遮罩 ----
    const radius = Math.min(layer.cornerRadius * Math.min(box.w, box.h), Math.min(box.w, box.h) / 2);
    if (radius > 0.5 || layer.viewport || layer.clipCircle) {
      const vp = layer.viewport;
      const key = `${box.w.toFixed(1)}|${box.h.toFixed(1)}|${radius.toFixed(1)}|${vp ? [vp.x - box.cx, vp.y - box.cy, vp.w, vp.h].join(',') : ''}|${JSON.stringify(layer.clipCircle)}`;
      if (!o.mask) {
        o.mask = new Graphics();
        o.container.addChild(o.mask);
      }
      if (o.maskKey !== key) {
        o.mask.clear();
        if (layer.clipCircle)
          o.mask
            .circle(layer.clipCircle.x - box.cx, layer.clipCircle.y - box.cy, layer.clipCircle.r)
            .fill(0xffffff);
        else
          o.mask
            .roundRect(
              vp ? vp.x - box.cx : -box.w / 2,
              vp ? vp.y - box.cy : -box.h / 2,
              vp?.w ?? box.w,
              vp?.h ?? box.h,
              radius,
            )
            .fill(0xffffff);
        o.maskKey = key;
      }
      o.sprite.mask = o.mask;
    } else if (o.mask) {
      o.sprite.mask = null;
      o.container.removeChild(o.mask);
      o.mask.destroy();
      o.mask = null;
      o.maskKey = '';
    }

    // ---- 外框（畫在框內側，方框大小不變，選取框才對得準）----
    if (layer.outline && layer.outline.width > 0) {
      const w = layer.outline.width * uiScale(this.width, this.height);
      const key = `${box.w.toFixed(1)}|${box.h.toFixed(1)}|${radius.toFixed(1)}|${w.toFixed(1)}|${layer.outline.color}`;
      if (!o.outline) {
        o.outline = new Graphics();
        o.container.addChild(o.outline);
      }
      if (o.outlineKey !== key) {
        o.outline
          .clear()
          .roundRect(-box.w / 2, -box.h / 2, box.w, box.h, radius)
          .stroke({ width: w, color: layer.outline.color, alignment: 1 });
        o.outlineKey = key;
      }
    } else if (o.outline) {
      o.container.removeChild(o.outline);
      o.outline.destroy();
      o.outline = null;
      o.outlineKey = '';
    }
  }

  private destroyObj(o: Obj) {
    o.container.parent?.removeChild(o.container);
    o.container.destroy({ children: true });
    this.releaseFrame(o);
    o.texture?.destroy(false);
    o.textureSource?.destroy();
    o.colorFilter?.destroy();
    o.blurFilter?.destroy();
  }

  /** 讀畫面上某一點的 RGBA（x、y 是合成器畫布像素） */
  samplePixel(x: number, y: number): [number, number, number, number] {
    const { pixels } = this.app.renderer.extract.pixels({
      target: this.app.stage,
      frame: new Rectangle(Math.floor(x), Math.floor(y), 1, 1),
    });
    return [pixels[0]!, pixels[1]!, pixels[2]!, pixels[3]!];
  }

  /** 讀一塊區域的 RGBA（測試用：數某個顏色有幾個像素） */
  readRegion(x: number, y: number, w: number, h: number): Uint8ClampedArray {
    const { pixels } = this.app.renderer.extract.pixels({
      target: this.app.stage,
      frame: new Rectangle(
        Math.floor(x),
        Math.floor(y),
        Math.max(Math.floor(w), 1),
        Math.max(Math.floor(h), 1),
      ),
    });
    return pixels;
  }

  mediaStats() {
    return {
      uploads: this.uploads,
      colorAllocations: this.colorAllocations,
      colorUpdates: this.colorUpdates,
      colorPasses: [...this.objs.values()].filter((o) => o.sprite.filters?.includes(o.colorFilter!)).length,
      allocations: this.allocations,
      buffers: new Set([...this.objs.values()].flatMap((o) => (o.frame ? [o.frame] : []))).size,
      frames: [...this.objs]
        .filter(([, o]) => o.frame)
        .map(([id, o]) => ({ id, width: o.frame!.canvas.width, height: o.frame!.canvas.height })),
    };
  }

  toCanvas(): HTMLCanvasElement {
    // 明確指定 (0,0,寬,高)：不然 Pixi 會用內容的外框，內容超出畫面（例如填滿的影片）時尺寸和位置都會跑掉
    return this.app.renderer.extract.canvas({
      target: this.app.stage,
      frame: new Rectangle(0, 0, this.width, this.height),
    }) as HTMLCanvasElement;
  }

  destroy() {
    for (const o of this.objs.values()) this.destroyObj(o);
    this.objs.clear();
    this.app.destroy(false, { children: true, texture: true });
  }
}
