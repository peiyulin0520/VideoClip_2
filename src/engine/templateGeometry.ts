import { animationValues } from './keyframes';
import type { Project, Track, VideoItem } from '../model/types';
import type { Box } from './geometry';
import { layoutMotion, layoutSlots } from './layouts';
export const groupTransform = (track: Track, t = track.layout?.start ?? 0) =>
  animationValues(track.layout ?? {}, t - (track.layout?.start ?? 0));
export function groupFrame(track: Track, w: number, h: number, t: number): Box {
  const tf = groupTransform(track, t),
    motion = layoutMotion(track.layout, t);
  return {
    cx: (tf.x + motion.x) * w,
    cy: (tf.y + motion.y) * h,
    w: w * tf.scale,
    h: h * tf.scale,
    rotation: 0,
  };
}
export function cellViewport(track: Track, item: VideoItem, index: number, t: number) {
  const layout = track.layout;
  let slot = item.slot ?? layoutSlots(layout?.style ?? 'filmstrip', layout?.count)[index]!;
  if (layout?.style === 'story') {
    const story = layout.story ?? { opening: 0.7, step: 0.45 },
      local = t - layout.start,
      count = layout.count ?? track.items.length;
    if (index === 0) {
      const opening = Math.min(1, Math.max(0, local / Math.max(0.1, story.opening)));
      const shrink = Math.min(1, Math.max(0, (local - story.opening) / Math.max(0.1, story.step)));
      const height = (0.2 + 0.8 * opening) * (1 - shrink) + shrink / count;
      slot = { x: 0, y: ((1 - height) / 2) * (1 - shrink), w: 1, h: height };
    } else {
      const p = Math.min(
        1,
        Math.max(0, (local - story.opening - (index - 1) * story.step) / Math.max(0.1, story.step)),
      );
      if (p <= 0) return null;
      slot = { x: 0, y: index / count - (1 - p) / count, w: 1, h: 1 / count };
    }
  }
  const tf = groupTransform(track, t),
    m = layoutMotion(layout, t);
  return {
    x: tf.x + m.x + (slot.x - 0.5) * tf.scale,
    y: tf.y + m.y + (slot.y - 0.5) * tf.scale,
    w: slot.w * tf.scale,
    h: slot.h * tf.scale,
  };
}
export function templateContexts(project: Project, w: number, h: number, t: number) {
  return Object.fromEntries(
    project.tracks
      .filter((tr) => tr.template)
      .flatMap((tr) =>
        tr.items.flatMap((it, i) =>
          it.type === 'text'
            ? []
            : [
                [
                  it.id,
                  { slot: cellViewport(tr, it, i, t), frame: groupFrame(tr, w, h, t), anchor: i === 0 },
                ],
              ],
        ),
      ),
  );
}
