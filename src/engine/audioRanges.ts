import { mediaSegments } from './templateTiming';
import type { VideoItem } from '../model/types';
export function audioRetained(item: VideoItem, sourceTime: number) {
  return (
    item.audioRanges === undefined || item.audioRanges.some(([a, b]) => sourceTime >= a && sourceTime < b)
  );
}
export function excludeAudio(ranges: [number, number][], start: number, end: number): [number, number][] {
  return ranges.flatMap(([a, b]) =>
    end <= a || start >= b
      ? [[a, b] as [number, number]]
      : [
          ...(a < start ? [[a, start] as [number, number]] : []),
          ...(b > end ? [[end, b] as [number, number]] : []),
        ],
  );
}
export function audioBoundaries(item: VideoItem) {
  if (item.cell)
    return mediaSegments(item).flatMap((s) => [
      s.start,
      s.end,
      ...(item.audioRanges ?? [])
        .flatMap((r) => r.map((t) => s.start + (t - s.sourceStart) / item.speed))
        .filter((t) => t > s.start && t < s.end),
    ]);
  return (item.audioRanges ?? []).flatMap((r) => r.map((t) => item.start + (t - item.trimIn) / item.speed));
}

export function inverseRanges(ranges: [number, number][], duration: number): [number, number][] {
  const out: [number, number][] = [];
  let from = 0;
  for (const [a, b] of ranges) {
    if (a > from) out.push([from, a]);
    from = Math.max(from, b);
  }
  if (from < duration) out.push([from, duration]);
  return out;
}
export function includeAudio(ranges: [number, number][], start: number, end: number): [number, number][] {
  const out: [number, number][] = [];
  for (const r of [...ranges, [start, end] as [number, number]].sort((a, b) => a[0] - b[0])) {
    const previous = out.at(-1);
    if (previous && r[0] <= previous[1]) previous[1] = Math.max(previous[1], r[1]);
    else out.push([...r]);
  }
  return out;
}
