import type { Item, Project } from '../model/types';
/** User labels belong to clip instances, not shared assets. */
export function itemName(project: Project, item: Item): string {
  if (item.name?.trim()) return item.name.trim();
  if (item.type === 'text')
    return item.card.placeholder
      ? '文字'
      : item.card.runs
          .map((r) => r.text)
          .join(' ')
          .replace(/\n/g, ' ')
          .trim() || '圖形';
  if (item.sourceItemId) {
    const source = project.tracks.flatMap((t) => t.items).find((i) => i.id === item.sourceItemId);
    if (source && source.type !== 'audio') return itemName(project, source);
  }
  return project.assets.find((a) => a.id === item.assetId)?.name ?? '素材';
}
