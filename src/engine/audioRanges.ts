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
  return (item.audioRanges ?? []).flatMap((r) => r.map((t) => item.start + (t - item.trimIn) / item.speed));
}
