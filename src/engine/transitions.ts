import type { Project } from '../model/types';
import type { SceneLayer } from './compositor';
import type { Layer } from './timeline';
import { findItem, itemEnd, visibleLayers } from './timeline';
export { TRANSITIONS } from './effectCatalog';
export function transitionPairs(project: Project) {
  return project.tracks
    .filter((t) => !t.template)
    .flatMap((track) => {
      const items = track.items
        .filter((it) => it.type === 'video' || it.type === 'image')
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
    const duration = Math.min(transition.duration, from.item.duration * 2, to.item.duration * 2);
    const start = to.item.start - duration / 2,
      p = (t - start) / duration;
    return p >= 0 && p < 1 ? [{ transition, from, to, p }] : [];
  });
}
/** Decode both sides throughout a transition, including held edge frames outside each clip. */
export function renderLayers(project: Project, t: number): Layer[] {
  const active = activeTransitions(project, t),
    out = visibleLayers(project, t);
  for (const { from, to } of active) {
    for (const f of [from, to])
      if (!out.some((l) => l.item.id === f.item.id))
        out.push({ item: f.item, track: f.track, trackIndex: f.trackIndex });
  }
  return out.sort((a, b) => a.trackIndex - b.trackIndex || a.item.start - b.item.start);
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
  for (const { transition: tr, from, to, p } of activeTransitions(project, t)) {
    const a = out.find((l) => l.id === from.item.id),
      b = out.find((l) => l.id === to.item.id);
    if (!a || !b) continue;
    let aa = { ...a, box: { ...a.box } },
      bb = { ...b, box: { ...b.box } };
    const extra: SceneLayer[] = [];
    const kind = tr.preset;
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
        kind === 'grid9'
          ? 3
          : kind === 'grid4' || kind === 'split-vertical'
            ? 2
            : kind === 'projector'
              ? 5
              : 1;
      const rows = kind === 'grid9' ? 3 : kind === 'grid4' || kind === 'split-horizontal' ? 2 : 1;
      for (let row = 0; row < rows; row++)
        for (let col = 0; col < cols; col++) {
          const cellW = w / cols,
            cellH = h / rows;
          const progress = kind === 'projector' ? Math.max(0, Math.min(1, p * 1.6 - col * 0.15)) : p;
          extra.push(
            clipped(
              bb,
              `${bb.id}-${tr.id}-${row}-${col}`,
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
              `${bb.id}-${tr.id}-glitch${i}`,
              0,
              (h * i) / 5,
              w,
              h / 20,
            ),
          );
      }
    }
    out = out.flatMap((l) => (l.id === a.id ? [aa] : l.id === b.id ? [bb, ...extra] : [l]));
  }
  return out;
}
