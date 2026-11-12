import { createMainTrack, createTrack } from '../model/defaults';
import type { Item, Project, Track } from '../model/types';
import { canPlace, findFreeStart, findItem } from './timeline';

export type LayerFamily = 'visual' | 'text' | 'audio';
export const trackFamily = (track: Track): LayerFamily =>
  track.kind === 'text' ? 'text' : track.kind === 'audio' ? 'audio' : 'visual';
export const itemFamily = (item: Item): LayerFamily =>
  item.type === 'text' ? 'text' : item.type === 'audio' ? 'audio' : 'visual';
export const FAMILY_LABELS: Record<LayerFamily, string> = { visual: '影像', text: '字卡', audio: '音效' };

/** Legacy main is only an import anchor; existing IDs, timing and stack stay intact. */
export function editableProject(project: Project): Project {
  const tracks = project.tracks.map((track, i) => ({
    ...track,
    name: /^(主軌|疊加(?: \d+)?)$/.test(track.name) ? `影像 ${i + 1}` : track.name,
  }));
  if (!tracks.some((t) => t.kind === 'main')) tracks.unshift(createMainTrack());
  return { ...project, tracks, flexibleLayers: true, freeMain: true, mainOffset: 0 };
}

export type LayerDrop = { trackId: string } | { insertAt: number };

/** Validate before touching a draft: rejected drops cannot leave a partial move. */
export function moveLayerItem(project: Project, id: string, desired: number, drop: LayerDrop) {
  const source = findItem(project, id);
  if (!source) throw Error('找不到素材');
  if (source.track.locked) throw Error('請先解鎖這一層');
  const start = Math.max(0, desired);
  if (!Number.isFinite(start)) throw Error('無效的時間位置');
  const family = itemFamily(source.item);
  if ('insertAt' in drop && source.track.template) {
    const index = project.tracks.indexOf(source.track);
    const at = Math.max(0, Math.min(project.tracks.length, drop.insertAt));
    project.tracks.splice(index, 1);
    project.tracks.splice(at > index ? at - 1 : at, 0, source.track);
    const delta = start - source.item.start;
    for (const it of source.track.items) it.start += delta;
    if (source.track.layout) source.track.layout.start += delta;
    return;
  }
  const target = 'trackId' in drop ? project.tracks.find((t) => t.id === drop.trackId) : undefined;
  if ('trackId' in drop && !target) throw Error('找不到目標圖層');
  if (target?.locked) throw Error('目標圖層已鎖定');
  if (target && trackFamily(target) !== family) throw Error('影像、字卡與音效必須放在各自類型的圖層');
  if (source.track.template || target?.template) {
    if (source.track === target) {
      const delta = start - source.item.start;
      for (const it of source.track.items) it.start += delta;
      if (source.track.layout) source.track.layout.start += delta;
      return;
    }
    throw Error('多格群組請拖到圖層之間，保持整組獨立');
  }
  if (target && target !== source.track && !canPlace(target.items, start, source.item.duration))
    throw Error('這個位置已有素材，請移到空位或拖到圖層之間新增一層');
  const placed = {
    ...source.item,
    start: target === source.track ? findFreeStart(target.items, start, source.item.duration, id) : start,
  };
  const destination = target ?? createTrack(family === 'visual' ? 'overlay' : family, project.tracks);
  if (!target) {
    const at = 'insertAt' in drop ? drop.insertAt : project.tracks.length;
    project.tracks.splice(Math.max(0, Math.min(project.tracks.length, at)), 0, destination);
  }
  source.track.items = source.track.items.filter((it) => it.id !== id);
  destination.items.push(placed);
  destination.items.sort((a, b) => a.start - b.start);
  project.freeMain = true;
  project.mainOffset = 0;
}
