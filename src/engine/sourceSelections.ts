import type { VideoItem } from '../model/types';
export function addSourceSelection(
  ranges: [number, number][],
  cursor: number,
  duration: number,
  minimum = 0.01,
): [number, number][] {
  const next = ranges.filter(([a]) => a > cursor).sort((a, b) => a[0] - b[0])[0]?.[0] ?? duration;
  const end = Math.min(cursor + Math.max(minimum, 0.5), next, duration);
  if (cursor < 0 || end - cursor < minimum - 1e-8 || ranges.some(([a, b]) => cursor < b && end > a))
    throw Error('請先縮小既有選段，再將白線移到未選取的秒數新增標記');
  return [...ranges, [cursor, end] as [number, number]].sort((a, b) => a[0] - b[0]);
}
export function selectedSourceRanges(item: VideoItem, duration: number): [number, number][] {
  return (
    item.sourceRanges ?? [
      [item.trimIn, Math.min(duration, item.cell?.sourceEnd ?? item.trimIn + item.duration * item.speed)],
    ]
  );
}
