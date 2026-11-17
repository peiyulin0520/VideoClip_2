import type { ItemBase, Transform } from '../model/types';
/** Local-time motion: deterministic for preview/export, no timers or new filters. */
export function continuousMotion(
  kind: ItemBase['continuous'],
  t: number,
  duration: number,
  width: number,
  height: number,
): Partial<Transform> {
  if (!kind) return {};
  const p = Math.max(0, Math.min(1, t / Math.max(0.1, duration))),
    strength = kind.strength ?? 1,
    phase = t * (kind.speed ?? 1) * Math.PI * 2;
  if (kind.kind === 'drift') return { y: (1.1 - 2.2 * p) * height * strength };
  if (kind.kind === 'slide') {
    const edge = Math.min(p / 0.18, (1 - p) / 0.18, 1);
    return { x: (p < 0.5 ? 1 : -1) * (1 - Math.max(0, edge)) ** 3 * width * 1.2 * strength };
  }
  if (kind.kind === 'breathe') return { scale: 1 + Math.sin(phase * 0.5) * 0.05 * strength };
  if (kind.kind === 'sway') return { rotation: Math.sin(phase * 0.5) * 4 * strength };
  return {
    x: Math.sin(phase * 7.3) * width * 0.008 * strength,
    y: Math.sin(phase * 11.7) * height * 0.004 * strength,
  };
}
