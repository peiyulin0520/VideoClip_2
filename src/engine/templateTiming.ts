import type { VideoItem } from '../model/types';
export type MediaSegment = { start: number; end: number; sourceStart: number };
/** Local gaps pause source consumption; trailing shortage becomes a solid, never a frozen frame. */
function rawSegments(item: VideoItem): MediaSegment[] {
  if (!item.cell) return [{ start: item.start, end: item.start + item.duration, sourceStart: item.trimIn }];
  const c = item.cell,
    segments: MediaSegment[] = [];
  let at = c.offset,
    source = item.trimIn;
  const end = Math.min(
    item.duration,
    c.offset +
      Math.max(0, (c.sourceEnd - item.trimIn) / item.speed) +
      c.blanks.reduce((n, [a, b]) => n + b - a, 0),
  );
  for (const [a, b] of [...c.blanks, [end, end] as [number, number]].sort((a, b) => a[0] - b[0])) {
    const until = Math.min(a, end, at + Math.max(0, (c.sourceEnd - source) / item.speed));
    if (until > at) {
      segments.push({ start: item.start + at, end: item.start + until, sourceStart: source });
      source += (until - at) * item.speed;
    }
    at = Math.max(at, b);
    if (at >= end || source >= c.sourceEnd) break;
  }
  return segments;
}
export function mediaSegments(item: VideoItem): MediaSegment[] {
  const segments = rawSegments(item);
  if (!item.sourceRanges) return segments;
  return segments.flatMap((s) =>
    item.sourceRanges!.flatMap(([a, b]) => {
      const start = Math.max(s.start, s.start + (a - s.sourceStart) / item.speed);
      const end = Math.min(s.end, s.start + (b - s.sourceStart) / item.speed);
      return end > start ? [{ start, end, sourceStart: s.sourceStart + (start - s.start) * item.speed }] : [];
    }),
  );
}
export function cellMediaTime(item: VideoItem, t: number): number | null {
  if (!item.cell && !item.sourceRanges)
    return item.trimIn + Math.min(Math.max(t - item.start, 0), item.duration) * item.speed;
  const s = mediaSegments(item).find((s) => t >= s.start && t < s.end);
  return s ? s.sourceStart + (t - s.start) * item.speed : null;
}
/** Cut the left of a group while retaining every cell's source and gap alignment. */
export function sliceCell(item: VideoItem, delta: number): VideoItem {
  if (!item.cell) return { ...item, trimIn: item.trimIn + delta * item.speed };
  if (delta <= 0)
    return {
      ...item,
      cell: {
        ...item.cell,
        offset: item.cell.offset - delta,
        blanks: item.cell.blanks.map(([a, b]) => [a - delta, b - delta]),
      },
    };
  const segments = mediaSegments({ ...item, duration: Math.max(item.duration, 600) }).filter(
    (s) => s.end > item.start + delta,
  );
  const first = segments[0];
  const trimIn = first
    ? first.sourceStart + Math.max(0, item.start + delta - first.start) * item.speed
    : item.cell.sourceEnd;
  return {
    ...item,
    trimIn,
    cell: {
      ...item.cell,
      offset: first ? Math.max(0, first.start - item.start - delta) : 0,
      blanks: item.cell.blanks
        .filter(([, b]) => b > delta)
        .map(([a, b]) => [Math.max(0, a - delta), b - delta]),
    },
  };
}
