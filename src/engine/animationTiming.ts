import type { ClipAnimation, Project } from '../model/types';

export type TimeRange = [number, number];
/** Local timeline seconds, never source-frame holds or an extension to clip duration. */
export function animationRanges(
  animation: ClipAnimation | undefined,
  edge: 'enter' | 'exit',
  duration: number,
): TimeRange[] {
  if (!animation) return [];
  // Old arbitrary windows are now anchored to the selected clip edge. Empty legacy windows stay off.
  if (animation.ranges?.length === 0) return [];
  const length = Math.min(Math.max(0, animation.duration), duration);
  return length > 0 ? [edge === 'enter' ? [0, length] : [duration - length, duration]] : [];
}
export function activeAnimation(
  animation: ClipAnimation | undefined,
  edge: 'enter' | 'exit',
  duration: number,
  local: number,
) {
  const range = animationRanges(animation, edge, duration).find(([a, b]) => local >= a && local < b);
  return animation && range ? { animation, progress: (local - range[0]) / (range[1] - range[0]) } : null;
}

/** Absolute project-time windows for screen effects; an empty list means none. */
export function effectAtTime(effect: NonNullable<Project['effects']>[number], t: number) {
  const range = (effect.ranges ?? [[effect.start, effect.start + effect.duration]]).find(
    ([a, b]) => t >= a && t < b,
  );
  return range ? { ...effect, start: range[0], duration: range[1] - range[0] } : null;
}
export function transitionRanges(
  transition: NonNullable<Project['transitions']>[number],
  from: { start: number; duration: number },
  to: { start: number; duration: number },
): TimeRange[] {
  if (transition.ranges) {
    const shift = transition.anchor === undefined ? 0 : to.start - transition.anchor;
    return transition.ranges
      .map(
        ([a, b]) =>
          [Math.max(from.start, a + shift), Math.min(to.start + to.duration, b + shift)] as TimeRange,
      )
      .filter(([a, b]) => b > a);
  }
  return [
    [
      Math.max(from.start, to.start - transition.duration / 2),
      Math.min(to.start + to.duration, to.start + transition.duration / 2),
    ],
  ];
}

/** Resize a paired window without crossing neighbors; endings stay anchored, A/B defaults balance. */
export function resizeTimeRange(
  range: TimeRange,
  length: number,
  low: number,
  high: number,
  split?: number,
): TimeRange {
  const span = Math.max(0.01, Math.min(high - low, length));
  if (split !== undefined && range[0] <= split && range[1] >= split) {
    const a = Math.max(low, split - span / 2),
      b = Math.min(high, a + span);
    return [Math.max(low, b - span), b];
  }
  if (Math.abs(range[1] - high) < 0.00001 && range[0] > low)
    return [Math.max(low, range[1] - span), range[1]];
  return [range[0], Math.min(high, range[0] + span)];
}
