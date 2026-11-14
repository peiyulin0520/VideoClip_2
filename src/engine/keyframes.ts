import type {
  AnimatedValues,
  ResolvedAnimatedValues,
  ColorAdjustment,
  Item,
  Keyframe,
  Project,
  Transform,
} from '../model/types';
import { DEFAULT_ADJUSTMENT, resolveAdjustment, TONE_KEYS } from './grade';
export { DEFAULT_ADJUSTMENT };
export type AnimationTarget = {
  transform?: Partial<Transform>;
  adjustment?: ColorAdjustment;
  keyframes?: Keyframe[];
  opacity?: number;
};
export function baseValues(target: AnimationTarget): ResolvedAnimatedValues {
  return {
    x: 0.5,
    y: 0.5,
    scale: 1,
    rotation: 0,
    ...target.transform,
    ...resolveAdjustment(target.adjustment),
    opacity: target.opacity ?? target.transform?.opacity ?? 1,
  };
}
export function mixColor(a: string, b: string, p: number) {
  const parts = (value: string) => [1, 3, 5].map((i) => parseInt(value.slice(i, i + 2), 16));
  const from = parts(a),
    to = parts(b);
  return (
    '#' +
    from
      .map((v, i) =>
        Math.round(v + (to[i]! - v) * p)
          .toString(16)
          .padStart(2, '0'),
      )
      .join('')
  );
}
export function animationValues(target: AnimationTarget, local: number): ResolvedAnimatedValues {
  const frames = target.keyframes;
  if (!frames?.length) return baseValues(target);
  const right = frames.findIndex((k) => k.time >= local);
  const resolved = (values: AnimatedValues): ResolvedAnimatedValues => ({
    ...baseValues(target),
    ...values,
    ...resolveAdjustment(values),
  });
  if (right <= 0) return resolved((right < 0 ? frames.at(-1)! : frames[0]!).values);
  const a = frames[right - 1]!,
    b = frames[right]!,
    p = (local - a.time) / (b.time - a.time);
  const av = resolved(a.values),
    bv = resolved(b.values);
  const result = { ...av };
  for (const key of ['x', 'y', 'scale', 'rotation', 'opacity', ...TONE_KEYS] as const)
    result[key] = av[key] + (bv[key] - av[key]) * p;
  result.tint = mixColor(a.values.tint, b.values.tint, p);
  return result;
}
export function evaluatedItem<T extends Item>(item: T, time: number): T {
  if (!item.keyframes?.length) return item;
  const { x, y, scale, rotation, opacity, ...adjustment } = animationValues(item, time - item.start);
  return {
    ...item,
    transform: { x, y, scale, rotation, opacity },
    adjustment,
  };
}
export function animationTarget(project: Project, id: string) {
  for (const track of project.tracks) {
    const item = track.items.find((it) => it.id === id);
    if (item)
      return {
        target: (track.template && track.layout ? track.layout : item) as AnimationTarget,
        track,
        item,
        start: item.start,
        duration: item.duration,
      };
  }
  throw Error('請先選取素材');
}
export function upsertFrame(target: AnimationTarget, local: number, values: AnimatedValues) {
  const frames = (target.keyframes ??= []);
  const found = frames.find((k) => Math.abs(k.time - local) < 0.015);
  if (found) found.values = values;
  else frames.push({ time: local, values });
  frames.sort((a, b) => a.time - b.time);
}
export function addKeyframe(project: Project, id: string, time: number) {
  const { target, start, duration, track } = animationTarget(project, id);
  if (track.locked) throw Error('請先解鎖圖層');
  if (time < start - 0.01 || time > start + duration + 0.01) throw Error('請將播放頭移到選取素材的時間範圍');
  const local = Math.max(0, Math.min(duration, time - start));
  upsertFrame(target, local, animationValues(target, local));
}
export function editAnimatedValues(
  project: Project,
  id: string,
  time: number,
  patch: Partial<AnimatedValues>,
  forceFrame = false,
) {
  const { target, start, duration, track } = animationTarget(project, id);
  if (track.locked) throw Error('請先解鎖圖層');
  const local = Math.max(0, Math.min(duration, time - start));
  const values = { ...animationValues(target, local), ...patch };
  if (track.template) values.rotation = 0;
  if (target.keyframes?.length || forceFrame) upsertFrame(target, local, values);
  else {
    const { x, y, scale, rotation, opacity, ...adjustment } = values;
    target.transform = track.template ? { x, y, scale } : { x, y, scale, rotation, opacity };
    if (track.template) target.opacity = opacity;
    target.adjustment = adjustment;
  }
}
export function trimKeyframes(target: AnimationTarget, from: number, to: number): Keyframe[] | undefined {
  if (!target.keyframes?.length) return undefined;
  const result: Keyframe[] = [{ time: 0, values: animationValues(target, from) }];
  for (const k of target.keyframes)
    if (k.time > from && k.time < to) result.push({ ...k, time: k.time - from });
  result.push({ time: to - from, values: animationValues(target, to) });
  return result;
}
