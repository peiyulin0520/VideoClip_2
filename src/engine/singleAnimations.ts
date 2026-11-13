import type { Project } from '../model/types';
import type { SceneLayer } from './compositor';
import { transitionSingle } from './transitions';
import { activeAnimation } from './animationTiming';
import { groupFrame } from './templateGeometry';

/** Animate only the chosen asset, or the entire template frame/cells/title together. */
export function applySingleAnimations(
  layers: SceneLayer[],
  project: Project,
  t: number,
  w: number,
  h: number,
) {
  let out = layers;
  for (const track of project.tracks) {
    const targets =
      track.template && track.layout
        ? [
            {
              id: track.id,
              start: track.layout.start,
              duration: track.layout.duration,
              animations: track.layout.animations,
              group: true,
            },
          ]
        : track.items.filter((it) => it.type !== 'audio').map((it) => ({ ...it, group: false }));
    for (const target of targets) {
      if (!target.animations || t < target.start || t >= target.start + target.duration) continue;
      const local = t - target.start;
      // Explicit windows may last the full clip; no hidden half-clip clamp.
      const incoming = activeAnimation(target.animations.enter, 'enter', target.duration, local);
      const outgoing = activeAnimation(target.animations.exit, 'exit', target.duration, local);
      const active = outgoing ?? incoming;
      if (!active) continue;
      const { animation, progress } = active;
      const role = outgoing ? 'exit' : 'enter';
      const p = role === 'enter' ? progress : 1 - progress;
      const chosen = out.filter((l) =>
        target.group
          ? track.items.some((it) => l.id === it.id || l.id.startsWith(`${it.id}-`)) ||
            l.id.startsWith(`${track.id}-`)
          : l.id === target.id,
      );
      const frame = target.group ? groupFrame(track, w, h, t) : chosen[0]?.box;
      if (!frame) continue;
      if (target.group && ['zoom-in', 'zoom-out', 'spin', 'page-turn'].includes(animation.preset)) {
        const kind = animation.preset;
        const scale =
          kind === 'page-turn'
            ? 1
            : role === 'exit' && ['zoom-in', 'zoom-out'].includes(kind)
              ? 1 + (kind === 'zoom-in' ? 0.5 : -0.5) * progress
              : kind === 'zoom-out'
                ? 1.5 - 0.5 * p
                : 0.5 + 0.5 * p;
        const ids = new Set(chosen.map((l) => l.id));
        out = out.map((l) =>
          ids.has(l.id)
            ? {
                ...l,
                continuity: undefined,
                opacity: l.opacity * (kind === 'page-turn' ? 1 : p),
                animationTransform: {
                  x: kind === 'page-turn' ? frame.cx + ((role === 'enter' ? 1 : -1) * frame.w) / 2 : frame.cx,
                  y: frame.cy,
                  scaleX: kind === 'page-turn' ? p : scale,
                  scaleY: scale,
                  rotation: kind === 'spin' ? (role === 'enter' ? (1 - p) * 100 : -progress * 100) : 0,
                },
              }
            : l,
        );
        continue;
      }
      const left = frame.cx - frame.w / 2,
        top = frame.cy - frame.h / 2;
      const transformed = chosen.flatMap((layer) => {
        const normalized: SceneLayer = {
          ...layer,
          box: { ...layer.box, cx: layer.box.cx - left, cy: layer.box.cy - top },
          viewport: layer.viewport
            ? { ...layer.viewport, x: layer.viewport.x - left, y: layer.viewport.y - top }
            : undefined,
        };
        return transitionSingle(
          normalized,
          animation.preset,
          Math.max(0, Math.min(1, progress)),
          role,
          frame.w,
          frame.h,
          `${layer.id}-single`,
        )
          .filter(
            (l) =>
              l.opacity > 0 &&
              (!target.group || !l.id.includes('-single-film-') || layer.id === `${track.id}-frame`),
          )
          .map((l): SceneLayer => ({
            ...l,
            continuity: undefined,
            box: { ...l.box, cx: l.box.cx + left, cy: l.box.cy + top },
            viewport: l.viewport
              ? { ...l.viewport, x: l.viewport.x + left, y: l.viewport.y + top }
              : undefined,
            clipCircle: l.clipCircle
              ? { ...l.clipCircle, x: l.clipCircle.x + left, y: l.clipCircle.y + top }
              : undefined,
          }));
      });
      const ids = new Set(chosen.map((l) => l.id));
      const index = out.findIndex((l) => ids.has(l.id));
      if (index >= 0) {
        out = out.filter((l) => !ids.has(l.id));
        out.splice(index, 0, ...transformed);
      }
    }
  }
  return out;
}
