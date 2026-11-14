import {
  Application,
  CanvasSource,
  Container,
  Graphics,
  Rectangle,
  Sprite,
  Texture,
  ColorMatrixFilter,
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

type Obj = {
  container: Container;
  sprite: Sprite;
  texture: Texture | null;
  textureSource: CanvasSource | null;
  frameCanvas: HTMLCanvasElement | null;
  frameCtx: CanvasRenderingContext2D | null;
  textKey: string | undefined;
  hasFrame: boolean;
  lastSource: LayerSource | null;
  continuity?: string;
  frameKey: string;
  mask: Graphics | null;
  outline: Graphics | null;
  maskKey: string;
  alphaCanvas?: HTMLCanvasElement;
  alphaKey?: string;
  outlineKey: string;
  colorFilter?: ColorMatrixFilter;
  blurFilter?: BlurFilter;
};

export class Compositor {
  private objs = new Map<string, Obj>();
  private background = new Graphics();
  private backgroundColor = '';
  private uploads = 0;
  private constructor(
    private app: Application,
    readonly width: number,
    readonly height: number,
  ) {
    this.app.stage.addChild(this.background);
  }

  static async create(opts: {
    width: number;
    height: number;
    canvas?: HTMLCanvasElement;
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
    return new Compositor(app, opts.width, opts.height);
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

    layers.forEach((layer, index) => {
      seen.add(layer.id);
      const o = this.ensure(layer);
      o.continuity = layer.continuity;
      this.update(o, layer);
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
      frameCanvas: null,
      frameCtx: null,
      textKey: undefined,
      hasFrame: false,
      lastSource: null,
      frameKey: '',
      mask: null,
      outline: null,
      maskKey: '',
      outlineKey: '',
    };
    this.objs.set(layer.id, o);
    return o;
  }

  private setSource(o: Obj, canvas: HTMLCanvasElement) {
    o.texture?.destroy(false);
    o.textureSource?.destroy();
    o.textureSource = new CanvasSource({ resource: canvas, scaleMode: 'linear' });
    o.texture = new Texture({ source: o.textureSource });
    o.sprite.texture = o.texture;
  }

  private update(o: Obj, layer: SceneLayer) {
    // ---- 內容 ----
    if (layer.kind === 'text') {
      if (o.textKey !== layer.textKey || !o.texture) {
        this.setSource(o, layer.source as HTMLCanvasElement);
        o.textKey = layer.textKey;
        o.hasFrame = true;
      }
    } else {
      const fw = Math.max(Math.round(layer.frameW ?? layer.box.w), 2);
      const fh = Math.max(Math.round(layer.frameH ?? layer.box.h), 2);
      if (!o.frameCanvas || o.frameCanvas.width !== fw || o.frameCanvas.height !== fh) {
        const c = o.frameCanvas ?? document.createElement('canvas');
        c.width = fw;
        c.height = fh;
        o.frameCanvas = c;
        o.frameCtx = c.getContext('2d');
        this.setSource(o, c);
        o.hasFrame = false;
      }
      if (layer.ready && o.frameCtx) {
        const crop = layer.crop ?? { l: 0, t: 0, r: 0, b: 0 };
        const video = layer.source instanceof HTMLVideoElement ? layer.source : null;
        const frameKey = [
          layer.srcW,
          layer.srcH,
          crop.l,
          crop.t,
          crop.r,
          crop.b,
          layer.sourceStamp,
          JSON.stringify(layer.mask),
          video && !video.requestVideoFrameCallback ? Math.floor(video.currentTime * 30) : undefined,
          video?.getVideoPlaybackQuality?.().totalVideoFrames,
          video?.dataset.frameStamp,
        ].join('|');
        const sx = layer.srcW * crop.l;
        const sy = layer.srcH * crop.t;
        const sw = Math.max(layer.srcW * (1 - crop.l - crop.r), 1);
        const sh = Math.max(layer.srcH * (1 - crop.t - crop.b), 1);
        if (!o.hasFrame || o.lastSource !== layer.source || o.frameKey !== frameKey)
          try {
            o.frameCtx.clearRect(0, 0, fw, fh);
            o.frameCtx.drawImage(layer.source, sx, sy, sw, sh, 0, 0, fw, fh);
            if (layer.mask) {
              const key = JSON.stringify([layer.mask, fw, fh, crop]);
              if (o.alphaKey !== key) {
                const c = o.alphaCanvas ?? document.createElement('canvas');
                c.width = fw;
                c.height = fh;
                const ctx = c.getContext('2d')!;
                ctx.save();
                ctx.scale(fw / (1 - crop.l - crop.r), fh / (1 - crop.t - crop.b));
                ctx.translate(-crop.l, -crop.t);
                // Draw in source pixel space to keep circular brush geometry.
                ctx.scale(1 / layer.srcW, 1 / layer.srcH);
                paintMask(ctx, layer.mask, layer.srcW, layer.srcH);
                ctx.restore();
                o.alphaCanvas = c;
                o.alphaKey = key;
              }
              o.frameCtx.save();
              o.frameCtx.globalCompositeOperation = 'destination-in';
              o.frameCtx.drawImage(o.alphaCanvas!, 0, 0);
              o.frameCtx.restore();
            }
            o.textureSource?.update();
            this.uploads++;
            o.hasFrame = true;
            o.lastSource = layer.source;
            o.frameKey = frameKey;
          } catch {
            /* 來源暫時畫不出來（解碼中），保留上一格 */
          }
      }
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
    if (
      adjustment &&
      (adjustment.brightness !== 1 || adjustment.saturation !== 1 || adjustment.temperature !== 0)
    ) {
      const color = (o.colorFilter ??= new ColorMatrixFilter());
      const sat = adjustment.saturation,
        inv = 1 - sat,
        bright = adjustment.brightness,
        temp = adjustment.temperature * 0.18;
      const r = bright * (1 + temp),
        g = bright,
        b = bright * (1 - temp);
      color.matrix = [
        (0.2126 * inv + sat) * r,
        0.7152 * inv * r,
        0.0722 * inv * r,
        0,
        0,
        0.2126 * inv * g,
        (0.7152 * inv + sat) * g,
        0.0722 * inv * g,
        0,
        0,
        0.2126 * inv * b,
        0.7152 * inv * b,
        (0.0722 * inv + sat) * b,
        0,
        0,
        0,
        0,
        0,
        1,
        0,
      ];
      filters.push(color);
    }
    if (layer.blur && layer.blur > 0) {
      const blur = (o.blurFilter ??= new BlurFilter({ strength: 1, quality: 3 }));
      blur.strength = layer.blur;
      filters.push(blur);
    }
    o.sprite.filters = filters;

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
      frames: [...this.objs]
        .filter(([, o]) => o.frameCanvas)
        .map(([id, o]) => ({ id, width: o.frameCanvas!.width, height: o.frameCanvas!.height })),
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
