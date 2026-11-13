import { transitionRanges } from './animationTiming';
import { filmBorderCanvas } from './transitionArt';
import type { Project, TransitionPreset } from '../model/types';
import type { SceneLayer } from './compositor';
import type { Layer } from './timeline';
import { findItem, itemEnd, visibleLayers } from './timeline';
export { TRANSITIONS } from './effectCatalog';
export function transitionPairs(project: Project) {
  return project.tracks
    .filter((t) => !t.template)
    .flatMap((track) => {
      const items = track.items
        .filter((it) => it.type !== 'audio')
        .slice()
        .sort((a, b) => a.start - b.start);
      return items.slice(0, -1).flatMap((from, i) => {
        const to = items[i + 1]!;
        return Math.abs(itemEnd(from) - to.start) < 0.05 ? [{ from, to, track }] : [];
      });
    });
}
export function activeTransitions(project: Project, t: number) {
  return (project.transitions ?? []).flatMap((transition) => {
    const from = findItem(project, transition.fromId),
      to = findItem(project, transition.toId);
    if (
      !from ||
      !to ||
      from.track.hidden ||
      to.track.hidden ||
      from.track.id !== to.track.id ||
      from.track.template ||
      Math.abs(itemEnd(from.item) - to.item.start) > 0.05
    )
      return [];
    const range = transitionRanges(transition, from.item, to.item).find(
      ([start, end]) => t >= start && t < end,
    );
    return range ? [{ transition, from, to, range, p: (t - range[0]) / (range[1] - range[0]) }] : [];
  });
}
/** Native clip clocks keep moving. Never borrow a frozen first/last frame from the other side. */
export function renderLayers(project: Project, t: number): Layer[] {
  return visibleLayers(project, t);
}
function move(layer: SceneLayer, x: number, y: number): SceneLayer {
  return {
    ...layer,
    box: { ...layer.box, cx: layer.box.cx + x, cy: layer.box.cy + y },
    viewport: layer.viewport
      ? { ...layer.viewport, x: layer.viewport.x + x, y: layer.viewport.y + y }
      : undefined,
  };
}
function clipped(layer: SceneLayer, id: string, x: number, y: number, w: number, h: number): SceneLayer {
  const vp = layer.viewport;
  const l = Math.max(x, vp?.x ?? 0),
    top = Math.max(y, vp?.y ?? 0),
    r = Math.min(x + w, vp ? vp.x + vp.w : Infinity),
    b = Math.min(y + h, vp ? vp.y + vp.h : Infinity);
  return {
    ...layer,
    id,
    continuity: undefined,
    viewport: { x: l, y: top, w: Math.max(0.001, r - l), h: Math.max(0.001, b - top) },
  };
}
export function applyTransitions(
  layers: SceneLayer[],
  project: Project,
  t: number,
  w: number,
  h: number,
): SceneLayer[] {
  let out = layers;
  for (const { transition: tr, from, to, range } of activeTransitions(project, t)) {
    const outgoing = t < to.item.start;
    const target = outgoing ? from.item : to.item;
    const a = outgoing ? range[0] : Math.max(range[0], to.item.start);
    const b = outgoing ? Math.min(range[1], to.item.start) : range[1];
    if (b <= a) continue;
    out = out.flatMap((layer) =>
      layer.id === target.id || layer.id.startsWith(`${target.id}-`)
        ? transitionSingle(layer, tr.preset, (t - a) / (b - a), outgoing ? 'exit' : 'enter', w, h, tr.id)
        : [layer],
    );
  }
  return out;
}

/** Same transition geometry is used for A/B joins and a single A against transparency. */
export function transitionPair(
  layers: SceneLayer[],
  a: SceneLayer,
  b: SceneLayer,
  preset: TransitionPreset,
  p: number,
  w: number,
  h: number,
  id: string,
): SceneLayer[] {
  let aa = { ...a, box: { ...a.box } },
    bb = { ...b, box: { ...b.box } };
  const extra: SceneLayer[] = [];
  const kind = preset;
  if (kind.startsWith('push-') || kind.startsWith('slide-') || kind === 'film-left' || kind === 'film-up') {
    const horizontal = kind.endsWith('left') || kind.endsWith('right');
    const sign = kind.endsWith('right') || kind.endsWith('down') ? 1 : -1;
    const dx = horizontal ? w * sign : 0,
      dy = horizontal ? 0 : h * sign;
    if (!kind.startsWith('slide-')) aa = move(aa, p * dx, p * dy);
    bb = move(bb, (p - 1) * dx, (p - 1) * dy);
  } else if (kind.startsWith('wipe-')) {
    const right = kind.endsWith('right'),
      left = kind.endsWith('left'),
      up = kind.endsWith('up');
    bb = clipped(
      bb,
      bb.id,
      left ? w * (1 - p) : 0,
      up ? h * (1 - p) : 0,
      left || right ? w * p : w,
      left || right ? h : h * p,
    );
  } else if (['grid4', 'grid9', 'split-horizontal', 'split-vertical', 'projector'].includes(kind)) {
    const cols =
      kind === 'grid9' ? 3 : kind === 'grid4' || kind === 'split-vertical' ? 2 : kind === 'projector' ? 5 : 1;
    const rows = kind === 'grid9' ? 3 : kind === 'grid4' || kind === 'split-horizontal' ? 2 : 1;
    for (let row = 0; row < rows; row++)
      for (let col = 0; col < cols; col++) {
        const cellW = w / cols,
          cellH = h / rows;
        const progress = kind === 'projector' ? Math.max(0, Math.min(1, p * 1.6 - col * 0.15)) : p;
        extra.push(
          clipped(
            bb,
            `${bb.id}-${id}-${row}-${col}`,
            col * cellW + (cellW * (1 - progress)) / 2,
            row * cellH + (cellH * (1 - progress)) / 2,
            cellW * progress,
            cellH * progress,
          ),
        );
      }
    bb.opacity = 0;
  } else if (kind === 'circle') bb.clipCircle = { x: w / 2, y: h / 2, r: (Math.hypot(w, h) * p) / 2 };
  else if (kind === 'page-turn') {
    bb.box.w *= p;
    bb.box.cx = w - bb.box.w / 2;
  } else {
    bb.opacity *= p;
    if (kind === 'zoom-in' || kind === 'zoom-out' || kind === 'spin') {
      const scale = kind === 'zoom-out' ? 1.5 - 0.5 * p : 0.5 + 0.5 * p;
      bb.box.w *= scale;
      bb.box.h *= scale;
      if (kind === 'spin') bb.box.rotation += (1 - p) * 100;
    }
    if (kind === 'blur') {
      aa.blur = Math.sin(Math.PI * p) * 16;
      bb.blur = aa.blur;
    }
    if (kind === 'glitch') {
      const shift = Math.sin(Math.floor(p * 18) * 7) * w * 0.04;
      bb = move(bb, shift * (1 - p), 0);
      for (let i = 0; i < 5; i++)
        extra.push(
          clipped(
            move(
              {
                ...bb,
                opacity: 0.45,
                adjustment: {
                  brightness: 1,
                  saturation: 1,
                  temperature: 0,
                  tint: i % 2 ? '#ff5577' : '#55ffff',
                },
              },
              shift * (i % 2 ? 1 : -1),
              0,
            ),
            `${bb.id}-${id}-glitch${i}`,
            0,
            (h * i) / 5,
            w,
            h / 20,
          ),
        );
    }
  }
  if (kind === 'film-left' || kind === 'film-up') {
    const art = filmBorderCanvas();
    for (const [i, l] of [aa, bb].entries())
      if (l.opacity > 0)
        extra.push({
          id: `${id}-film-${i}`,
          kind: 'image',
          source: art,
          srcW: 160,
          srcH: 96,
          frameW: 160,
          frameH: 96,
          ready: true,
          box: { cx: l.box.cx, cy: l.box.cy, w, h, rotation: 0 },
          opacity: Math.sin(Math.PI * p) * l.opacity,
          blend: 'normal',
          cornerRadius: 0,
        });
  }
  return layers.flatMap((l) => (l.id === a.id ? [aa] : l.id === b.id ? [bb, ...extra] : [l]));
}

/** A leaves towards the transition direction; B enters from the opposite side.
 * Geometry/masks use the shared preset renderer, with an explicit outgoing role. */
export function transitionSingle(
  layer: SceneLayer,
  preset: TransitionPreset,
  progress: number,
  role: 'enter' | 'exit',
  w: number,
  h: number,
  id: string,
) {
  const blank = { ...layer, id: `${layer.id}-empty`, opacity: 0 };
  const p = role === 'enter' ? progress : 1 - progress;
  const result = transitionPair([blank, layer], blank, layer, preset, p, w, h, id).filter(
    (l) => l.id !== blank.id && l.opacity > 0,
  );
  if (role === 'enter') return result;
  const horizontal = preset.endsWith('left') || preset.endsWith('right');
  const moving = preset.startsWith('push-') || preset.startsWith('slide-') || preset.startsWith('film-');
  return result.map((l) => {
    let out = l;
    if (moving)
      out = move(
        out,
        horizontal ? -2 * (l.box.cx - layer.box.cx) : 0,
        horizontal ? 0 : -2 * (l.box.cy - layer.box.cy),
      );
    if (preset.startsWith('wipe-') && out.viewport)
      out = {
        ...out,
        viewport: {
          ...out.viewport,
          x: horizontal ? w - out.viewport.x - out.viewport.w : out.viewport.x,
          y: horizontal ? out.viewport.y : h - out.viewport.y - out.viewport.h,
        },
      };
    if (preset === 'page-turn') out = { ...out, box: { ...out.box, cx: out.box.w / 2 } };
    if (preset === 'zoom-in' || preset === 'zoom-out') {
      const scale = preset === 'zoom-in' ? 1 + 0.5 * progress : 1 - 0.5 * progress;
      out = { ...out, box: { ...out.box, w: layer.box.w * scale, h: layer.box.h * scale } };
    }
    if (preset === 'spin')
      out = { ...out, box: { ...out.box, rotation: layer.box.rotation - progress * 100 } };
    return out;
  });
}
