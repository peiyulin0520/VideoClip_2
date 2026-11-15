import { trimKeyframes } from './keyframes';
import { sliceCell } from './templateTiming';
import type { Item, Project, VideoItem } from '../model/types';
import { findItem, itemEnd } from './timeline';
import { MIN_CLIP_DURATION } from '../model/defaults';

/** A template's cells share one timeline interval; transforms remain independent. */
export function setTimelineItems(project: Project, trackId: string, next: Item[]) {
  const track = project.tracks.find((t) => t.id === trackId);
  if (!track) return;
  const previousLayout = track.layout;
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
      const delta = Math.max(-previous.start, changed.start - previous.start);
      const duration = Math.max(MIN_CLIP_DURATION, changed.duration);
      track.items = track.items.map((it) => ({
        ...(it.type === 'text' ? it : sliceCell(it, delta)),
        start: previous.start + delta,
        duration,
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
      keyframes:
        previousLayout && previousLayout.duration !== track.items[0].duration
          ? trimKeyframes(
              previousLayout,
              track.items[0].start - previousLayout.start,
              track.items[0].start - previousLayout.start + track.items[0].duration,
            )
          : previousLayout?.keyframes,
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
  if (found.track.template) {
    Object.assign(item, {
      trimIn,
      cell: {
        ...item.cell,
        sourceEnd: end,
        offset: item.cell?.offset ?? 0,
        blanks: item.cell?.blanks ?? [],
        background: item.cell?.background ?? '#000000',
      },
    });
    return;
  }
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
    found.track.items.map((it) =>
      it.id === item.id
        ? {
            ...item,
            start,
            trimIn,
            duration,
            keyframes: trimKeyframes(item, start - item.start, start - item.start + duration),
          }
        : it,
    ),
  );
}
