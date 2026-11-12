import type { Item, Project, VideoItem } from '../model/types';
import { findItem, itemEnd, maxDuration } from './timeline';
import { MIN_CLIP_DURATION } from '../model/defaults';

/** A template's cells share one timeline interval; transforms remain independent. */
export function setTimelineItems(project: Project, trackId: string, next: Item[]) {
  const track = project.tracks.find((t) => t.id === trackId);
  if (!track) return;
  if (track.template && track.items.length > 1) {
    const changed = next.find((it) => {
      const prev = track.items.find((p) => p.id === it.id);
      return (
        prev &&
        (prev.start !== it.start ||
          prev.duration !== it.duration ||
          (it.type !== 'text' && prev.type !== 'text' && prev.trimIn !== it.trimIn))
      );
    });
    const previous = changed && track.items.find((it) => it.id === changed.id);
    if (changed && previous) {
      const wantedDelta = changed.start - previous.start;
      const minimum = Math.max(
        ...track.items.map((it) =>
          Math.max(-it.start, it.type !== 'text' && it.type !== 'image' ? -it.trimIn / it.speed : -Infinity),
        ),
      );
      const delta = Math.max(minimum, wantedDelta);
      const duration = Math.min(
        changed.duration + wantedDelta - delta,
        ...track.items.map((it) => {
          const a = it.type !== 'text' ? project.assets.find((a) => a.id === it.assetId) : undefined;
          return it.type !== 'text'
            ? maxDuration({ ...it, trimIn: it.trimIn + delta * it.speed }, a)
            : Infinity;
        }),
      );
      track.items = track.items.map((it) => ({
        ...it,
        start: it.start + delta,
        duration,
        ...(it.type !== 'text' && it.type !== 'image' ? { trimIn: it.trimIn + delta * it.speed } : {}),
      }));
    }
  } else track.items = next;
  if (track.kind === 'main') {
    project.freeMain = true;
    project.mainOffset = 0;
  }
  if (track.template && project.layout && track.items[0]) {
    const layout = {
      ...(track.layout ?? project.layout),
      start: track.items[0].start,
      duration: track.items[0].duration,
    };
    track.layout = layout;
    project.layout = { ...layout };
  }
}

export function trimSourceRange(project: Project, itemId: string, from: number, to: number) {
  const found = findItem(project, itemId);
  if (!found || found.item.type === 'text' || found.item.type === 'image') return;
  const item = found.item as VideoItem;
  const asset = project.assets.find((a) => a.id === item.assetId);
  if (!asset) return;
  const trimIn = Math.max(0, Math.min(asset.duration - MIN_CLIP_DURATION * item.speed, from));
  const end = Math.max(trimIn + MIN_CLIP_DURATION * item.speed, Math.min(asset.duration, to));
  // Keep the original source anchored; restoring the first frame restores its former location.
  const start = Math.max(0, item.start + (trimIn - item.trimIn) / item.speed);
  const duration = (end - trimIn) / item.speed;
  if (
    found.track.items.some(
      (other) =>
        other.id !== item.id &&
        !found.track.template &&
        start < itemEnd(other) &&
        start + duration > other.start,
    )
  )
    throw Error('還原後會與旁邊片段重疊，請先把旁邊片段移開');
  setTimelineItems(
    project,
    found.track.id,
    found.track.items.map((it) => (it.id === item.id ? { ...item, start, trimIn, duration } : it)),
  );
}
