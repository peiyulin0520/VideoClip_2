import type { Project, Track, VideoItem } from '../model/types';
/** Child durations/source trims stay independent. Reflow only their project-time placement. */
export function arrangeTemplate(track: Track, mode = track.layout?.playback ?? 'simultaneous') {
  if (!track.template || !track.layout) return;
  const start = track.layout.start,
    previous = track.layout.playback ?? 'simultaneous';
  track.layout.playback = mode;
  let cursor = start;
  for (const item of track.items) {
    item.start = mode === 'sequential' ? cursor : start;
    if (item.type !== 'text' && previous !== mode) {
      const cell = item.cell ?? {
        sourceEnd: item.trimIn + item.duration * item.speed,
        offset: 0,
        blanks: [],
        background: '#000000',
      };
      if (mode === 'sequential') {
        cell.parallelAudio = item.audioEnabled ?? true;
        item.audioEnabled = cell.sequentialAudio ?? true;
      } else {
        cell.sequentialAudio = item.audioEnabled ?? true;
        item.audioEnabled = cell.parallelAudio ?? true;
      }
      item.cell = cell;
    }
    if (item.type !== 'text')
      item.cell = {
        sourceEnd: item.cell?.sourceEnd ?? item.trimIn + item.duration * item.speed,
        offset: 0,
        blanks: [],
        background: '#000000',
        ...item.cell,
        holdAfter: mode === 'sequential',
      };
    cursor += item.duration;
  }
  track.layout.duration =
    mode === 'sequential' ? cursor - start : Math.max(0.2, ...track.items.map((it) => it.duration));
}
export function setTemplatePlayback(project: Project, id: string, mode: 'simultaneous' | 'sequential') {
  const track = project.tracks.find((t) => t.id === id);
  if (!track?.template) return;
  if (track.locked) throw Error('請先解鎖圖層');
  arrangeTemplate(track, mode);
}
export function moveTemplateChild(project: Project, trackId: string, itemId: string, direction: -1 | 1) {
  const track = project.tracks.find((t) => t.id === trackId);
  if (!track?.template || track.locked) return;
  const index = track.items.findIndex((i) => i.id === itemId),
    other = index + direction;
  if (index < 0 || other < 0 || other >= track.items.length) return;
  [track.items[index], track.items[other]] = [track.items[other]!, track.items[index]!];
  arrangeTemplate(track);
}
export function updateTemplateChild(project: Project, id: string, item: VideoItem) {
  const track = project.tracks.find((t) => t.template && t.items.some((i) => i.id === id));
  if (!track || track.locked) return;
  const index = track.items.findIndex((i) => i.id === id),
    before = track.items[index]!;
  track.items[index] = { ...item, id: before.id, slot: before.type !== 'text' ? before.slot : undefined };
  arrangeTemplate(track);
}
