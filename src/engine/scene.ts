import type { Asset, Item, Project, Track, VideoItem } from '../model/types';
import type { SceneLayer } from './compositor';
import { fittedSize, itemBox, type GeoCtx } from './geometry';
import { renderText, measureTextItem, uiScale } from './textRender';
import { layoutArt, layoutMotion } from './layouts';
import { visibleLayers } from './timeline';

/** 預覽/匯出各自提供「這個影片/照片物件現在的畫面」 */
export type SourceProvider = (
  item: VideoItem,
  asset: Asset,
  track: Track,
) => {
  source: HTMLVideoElement | HTMLImageElement | ImageBitmap | HTMLCanvasElement | OffscreenCanvas;
  ready: boolean;
  srcW: number;
  srcH: number;
  stamp?: number;
} | null;

export function geoCtx(project: Project, canvasW: number, canvasH: number, t?: number): GeoCtx {
  return {
    canvasW,
    canvasH,
    assets: project.assets,
    textSize: measureTextItem,
    motions:
      t === undefined
        ? undefined
        : Object.fromEntries(
            project.tracks
              .filter((tr) => tr.template)
              .flatMap((tr) => tr.items.map((it) => [it.id, layoutMotion(tr.layout ?? project.layout, t)])),
          ),
  };
}

/** 依專案與時間算出要畫的圖層（由下到上）。canvasW/H 是合成器畫布的像素。 */
export function buildScene(
  project: Project,
  t: number,
  canvasW: number,
  canvasH: number,
  provide: SourceProvider,
): SceneLayer[] {
  const ctx = geoCtx(project, canvasW, canvasH);
  const out: SceneLayer[] = [];
  const artAdded = new Set<string>();
  const layers = visibleLayers(project, t);
  const templateActive = layers.some((l) => l.track.template);
  for (const { item, track } of layers) {
    if (templateActive && track.kind === 'main') continue;
    const layout = track.layout ?? project.layout;
    const motion = layoutMotion(layout, t);
    if (track.template && layout && !artAdded.has(track.id)) {
      const art = layoutArt(layout.style, canvasW, canvasH);
      out.push({
        id: `${track.id}-frame`,
        kind: 'image',
        source: art,
        ready: true,
        srcW: canvasW,
        srcH: canvasH,
        frameW: canvasW,
        frameH: canvasH,
        box: {
          cx: canvasW * (0.5 + motion.x),
          cy: canvasH * (0.5 + motion.y),
          w: canvasW,
          h: canvasH,
          rotation: 0,
        },
        opacity: 1,
        blend: 'normal',
        cornerRadius: 0,
      });
      artAdded.add(track.id);
    }
    const layer = toLayer(item, track, project, ctx, provide);
    if (layer) {
      if (track.template) {
        layer.box = {
          ...layer.box,
          cx: layer.box.cx + motion.x * canvasW,
          cy: layer.box.cy + motion.y * canvasH,
        };
        if (layer.viewport) {
          layer.viewport.x += motion.x * canvasW;
          layer.viewport.y += motion.y * canvasH;
        }
      }
      out.push(layer);
    }
  }
  return out;
}

function toLayer(
  item: Item,
  track: Track,
  project: Project,
  ctx: GeoCtx,
  provide: SourceProvider,
): SceneLayer | null {
  if (item.type === 'audio') return null;
  const box = itemBox(item, ctx);
  if (!box) return null;
  const common = {
    id: item.id,
    continuity: track.template ? undefined : track.id,
    box,
    opacity: item.transform.opacity,
    blend: item.blend ?? 'normal',
    cornerRadius: item.cornerRadius ?? 0,
    outline: item.outline,
    crop: item.crop,
    mask: item.type !== 'text' ? item.mask : undefined,
  };
  if (item.type === 'text') {
    const r = renderText(
      item.card,
      uiScale(ctx.canvasW, ctx.canvasH),
      Math.min(4, Math.max(2, Math.ceil(item.transform.scale))),
    );
    return { ...common, kind: 'text', source: r.canvas, ready: true, srcW: r.w, srcH: r.h, textKey: r.key };
  }
  const asset = project.assets.find((a) => a.id === item.assetId);
  if (!asset) return null;
  const src = provide(item, asset, track);
  if (!src) return null;
  // 暫存畫面的解析度：scale=1 時的顯示大小，最多放大 2 倍（縮放手勢時才不會一直重建貼圖）
  const crop = item.crop ?? { l: 0, t: 0, r: 0, b: 0 };
  const cw = Math.max(asset.width * (1 - crop.l - crop.r), 1);
  const ch = Math.max(asset.height * (1 - crop.t - crop.b), 1);
  const base = fittedSize(
    cw,
    ch,
    ctx.canvasW * (item.slot?.w ?? 1),
    ctx.canvasH * (item.slot?.h ?? 1),
    item.fit,
  );
  const k = Math.min(1, src.srcW / base.w, src.srcH / base.h); // Never expand a small GIF to a full-resolution media texture.
  return {
    ...common,
    kind: item.type,
    source: src.source,
    ready: src.ready,
    srcW: src.srcW,
    srcH: src.srcH,
    sourceStamp: src.stamp,
    viewport: item.slot
      ? {
          x: item.slot.x * ctx.canvasW,
          y: item.slot.y * ctx.canvasH,
          w: item.slot.w * ctx.canvasW,
          h: item.slot.h * ctx.canvasH,
        }
      : undefined,
    frameW: base.w * k,
    frameH: base.h * k,
  };
}
