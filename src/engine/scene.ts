import { applySingleAnimations } from './singleAnimations';
import { renderLayers, applyTransitions } from './transitions';
import { applyVideoEffects, videoEffectOverlay } from './videoEffects';
import { animationValues, evaluatedItem } from './keyframes';
import { groupFrame, templateContexts } from './templateGeometry';
import { cellMediaTime } from './templateTiming';
import { effectLayer, solidCanvas } from './sceneEffects';
import { createTextItem } from '../model/defaults';
import type { Asset, Item, Project, Track, VideoItem } from '../model/types';
import type { SceneLayer } from './compositor';
import { fittedSize, itemBox, type GeoCtx } from './geometry';
import { renderText, measureTextItem, uiScale } from './textRender';
import { layoutArt, layoutMotion } from './layouts';

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
    time: t,
    assets: project.assets,
    textSize: measureTextItem,
    templates: templateContexts(project, canvasW, canvasH, t ?? 0),
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
  previewLiftedId?: string | null,
): SceneLayer[] {
  const ctx = geoCtx(project, canvasW, canvasH, t);
  let out: SceneLayer[] = [];
  const artAdded = new Set<string>();
  const layers = renderLayers(project, t);
  const templateActive = layers.some((l) => l.track.template);
  for (const { item, track } of layers) {
    if (templateActive && track.kind === 'main' && !project.flexibleLayers) continue;
    const layout = track.layout ?? project.layout;

    if (track.template && layout && !artAdded.has(track.id)) {
      const frame = groupFrame(track, canvasW, canvasH, t);
      const scale = Math.max(0.05, animationValues(layout, t - layout.start).scale);
      const artW = frame.w / scale,
        artH = frame.h / scale;
      const textureScale = Math.min(1, Math.max(canvasW, canvasH) / Math.max(artW, artH));
      const art = layoutArt(
        layout.style,
        Math.max(2, Math.round(artW * textureScale)),
        Math.max(2, Math.round(artH * textureScale)),
        layout,
      );
      out.push({
        id: `${track.id}-frame`,
        kind: 'image',
        source: art,
        ready: true,
        srcW: art.width,
        srcH: art.height,
        frameW: art.width,
        frameH: art.height,
        box: frame,
        opacity: animationValues(layout, t - layout.start).opacity * (layout.frameOpacity ?? 1),
        adjustment: animationValues(layout, t - layout.start),
        blend: 'normal',
        cornerRadius: 0,
      });
      artAdded.add(track.id);
    }
    const viewport = ctx.templates?.[item.id]?.slot;
    if (track.template && item.type !== 'text' && viewport) {
      const source = solidCanvas(item.cell?.background ?? '#000000');
      out.push({
        id: `${item.id}-blank`,
        kind: 'image',
        source,
        ready: true,
        srcW: 256,
        srcH: 2,
        frameW: 256,
        frameH: 2,
        box: {
          cx: (viewport.x + viewport.w / 2) * canvasW,
          cy: (viewport.y + viewport.h / 2) * canvasH,
          w: viewport.w * canvasW,
          h: viewport.h * canvasH,
          rotation: 0,
        },
        opacity: animationValues(layout ?? {}, t - (layout?.start ?? 0)).opacity,
        adjustment: animationValues(layout ?? {}, t - (layout?.start ?? 0)),
        blend: 'normal',
        cornerRadius: 0,
      });
    }
    const layer =
      item.type !== 'text' && item.cell && cellMediaTime(item, t) === null
        ? null
        : toLayer(item, track, project, ctx, provide);
    if (layer) out.push(layer);
    if (track.template && layout?.style === 'story' && item === track.items.at(-1)) {
      const story = layout.story;
      if (story && t >= layout.start + story.opening) {
        const fonts = story.fontIds.length ? story.fontIds : ['system'];
        const text = createTextItem(0, story.title);
        text.card.runs[0]!.fontId =
          fonts[Math.floor((t - layout.start) / Math.max(0.04, story.fontInterval)) % fonts.length]!;
        text.card.runs[0]!.size = 90;
        delete text.card.runs[0]!.shadow;
        text.card.width = 900;
        const value = renderText(text.card, uiScale(canvasW, canvasH), 2),
          frame = groupFrame(track, canvasW, canvasH, t),
          s = frame.w / canvasW;
        out.push({
          id: `${track.id}-title`,
          kind: 'text',
          source: value.canvas,
          ready: true,
          srcW: value.w,
          srcH: value.h,
          textKey: value.key,
          box: { cx: frame.cx, cy: frame.cy, w: value.w * s, h: value.h * s, rotation: 0 },
          opacity: animationValues(layout, t - layout.start).opacity,
          adjustment: animationValues(layout, t - layout.start),
          blend: 'normal',
          cornerRadius: 0,
        });
        if (story.flash) {
          const e = effectLayer(
            {
              id: `${track.id}-flash`,
              preset: 'light-leak',
              start: layout.start + layout.duration - 0.7,
              duration: 0.7,
              strength: 1,
            },
            t,
            canvasW,
            canvasH,
          );
          if (e) {
            e.box = {
              ...e.box,
              cx: frame.cx + (e.box.cx - canvasW / 2) * s,
              cy: frame.cy,
              w: e.box.w * s,
              h: e.box.h * s,
            };
            e.viewport = { x: frame.cx - frame.w / 2, y: frame.cy - frame.h / 2, w: frame.w, h: frame.h };
            out.push(e);
          }
        }
      }
    }
  }
  out = applySingleAnimations(out, project, t, canvasW, canvasH);
  out = applyVideoEffects(applyTransitions(out, project, t, canvasW, canvasH), project, t, canvasW, canvasH);
  for (const effect of project.effects ?? []) {
    const layer = effectLayer(effect, t, canvasW, canvasH) ?? videoEffectOverlay(effect, t, canvasW, canvasH);
    if (layer) out.push(layer);
  }
  if (previewLiftedId) {
    const group = project.tracks.find(
      (tr) => tr.template && tr.items.some((it) => it.id === previewLiftedId),
    );
    if (group) {
      const ids = new Set(group.items.flatMap((it) => [it.id, `${it.id}-blank`]));
      const raised = out.filter((l) => ids.has(l.id) || l.id.startsWith(`${group.id}-`));
      return [...out.filter((l) => !raised.includes(l)), ...raised];
    }
    const i = out.findIndex((layer) => layer.id === previewLiftedId);
    if (i >= 0) out.push(out.splice(i, 1)[0]!);
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
  item = evaluatedItem(item, ctx.time ?? item.start);
  if (track.template && track.layout) {
    const values = animationValues(track.layout, (ctx.time ?? item.start) - track.layout.start);
    item = {
      ...item,
      transform: { ...item.transform, opacity: values.opacity * item.transform.opacity },
      adjustment: values,
    };
  }
  const box = itemBox(item, ctx);
  if (!box) return null;
  const common = {
    id: item.id,
    continuity: track.template ? undefined : track.id,
    box,
    opacity: item.transform.opacity,
    adjustment: item.adjustment,
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
    ctx.canvasW * (ctx.templates?.[item.id]?.slot?.w ?? item.slot?.w ?? 1),
    ctx.canvasH * (ctx.templates?.[item.id]?.slot?.h ?? item.slot?.h ?? 1),
    item.fit,
  );
  const k = Math.min(1, src.srcW / base.w, src.srcH / base.h); // Never expand a small GIF to a full-resolution media texture.
  return {
    ...common,
    kind: item.type === 'video' ? 'video' : 'image',
    source: src.source,
    ready: src.ready,
    srcW: src.srcW,
    srcH: src.srcH,
    sourceStamp: src.stamp,
    viewport: ctx.templates?.[item.id]
      ? ctx.templates[item.id]!.slot
        ? {
            x: ctx.templates[item.id]!.slot!.x * ctx.canvasW,
            y: ctx.templates[item.id]!.slot!.y * ctx.canvasH,
            w: ctx.templates[item.id]!.slot!.w * ctx.canvasW,
            h: ctx.templates[item.id]!.slot!.h * ctx.canvasH,
          }
        : undefined
      : item.slot
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
