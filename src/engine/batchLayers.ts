import type { Item, Project, Track } from '../model/types';
import { createMainTrack } from '../model/defaults';
export type LaneCategory = 'visual' | 'text' | 'sticker' | 'audio';
export const LANE_NAMES: Record<LaneCategory, string> = {
  visual: '影像',
  text: '文字',
  sticker: '貼紙',
  audio: '音訊',
};
export function itemCategory(item: Item, project: Project): LaneCategory {
  if (item.type === 'text') return 'text';
  if (item.type === 'audio') return 'audio';
  return project.assets.find((a) => a.id === item.assetId)?.origin ? 'sticker' : 'visual';
}
export function laneCategory(track: Track, project: Project): LaneCategory {
  return track.items[0]
    ? itemCategory(track.items[0], project)
    : track.kind === 'text'
      ? 'text'
      : track.kind === 'audio'
        ? 'audio'
        : 'visual';
}
function selected(project: Project, ids: string[]) {
  const tracks = project.tracks.filter((t) => ids.includes(t.id));
  if (!tracks.length) throw Error('請先選取圖層');
  if (tracks.some((t) => t.locked)) throw Error('請先解鎖選取的圖層');
  return tracks;
}
export function shiftSelectedTracks(project: Project, ids: string[], direction: 1 | -1) {
  selected(project, ids);
  const tracks = project.tracks;
  if (direction > 0) {
    for (let i = tracks.length - 2; i >= 0; i--)
      if (ids.includes(tracks[i]!.id) && !ids.includes(tracks[i + 1]!.id))
        [tracks[i], tracks[i + 1]] = [tracks[i + 1]!, tracks[i]!];
  } else
    for (let i = 1; i < tracks.length; i++)
      if (ids.includes(tracks[i]!.id) && !ids.includes(tracks[i - 1]!.id))
        [tracks[i], tracks[i - 1]] = [tracks[i - 1]!, tracks[i]!];
}
export function deleteSelectedTracks(project: Project, ids: string[]) {
  selected(project, ids);
  project.tracks = project.tracks.filter((t) => !ids.includes(t.id));
  if (!project.tracks.some((t) => t.kind === 'main')) project.tracks.unshift(createMainTrack());
  if (!project.tracks.some((t) => t.template)) delete project.layout;
  const remaining = new Set(project.tracks.flatMap((t) => t.items.map((it) => it.id)));
  project.transitions = project.transitions?.filter(
    (tr) => remaining.has(tr.fromId) && remaining.has(tr.toId),
  );
}
export function mergeSelectedTracks(project: Project, ids: string[], sequential = false): string {
  const tracks = selected(project, ids);
  if (tracks.length < 2) throw Error('請選至少兩個圖層');
  if (tracks.some((t) => t.template)) throw Error('膠卷等多格模板需維持整組，請選一般素材圖層');
  const items = tracks.flatMap((t) => t.items).sort((a, b) => a.start - b.start);
  const families = new Set(items.map((it) => itemCategory(it, project)));
  if (families.size > 1 || tracks.some((t) => laneCategory(t, project) !== laneCategory(tracks[0]!, project)))
    throw Error('只能合併同類型的影像、文字、貼紙或音訊圖層');
  if (tracks.some((t) => t.hidden !== tracks[0]!.hidden || !!t.muted !== !!tracks[0]!.muted))
    throw Error('請先統一選取圖層的顯示與靜音狀態');
  let end = 0;
  const combined = items.map((it) => {
    if (!sequential && it.start < end - 1e-6) throw Error('素材時間重疊，可改用「合併並依序接續」');
    const start = sequential ? Math.max(it.start, end) : it.start;
    end = start + it.duration;
    return { ...it, start };
  });
  const target = tracks.find((t) => t.kind === 'main') ?? tracks[0]!;
  target.items = combined;
  project.tracks = project.tracks.filter((t) => t.id === target.id || !ids.includes(t.id));
  project.freeMain = true;
  project.mainOffset = 0;
  return target.id;
}
