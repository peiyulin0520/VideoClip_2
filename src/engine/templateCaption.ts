import { createTextItem } from '../model/defaults';
import type { Project, Track, TextItem } from '../model/types';
export function createTemplateCaption(track: Track): TextItem {
  const layout = track.layout!;
  const text = createTextItem(layout.start, layout.caption ?? 'LITTLE MOMENTS');
  text.id = `${track.id}-caption`;
  text.name = '版型文字';
  text.duration = layout.duration;
  text.transform = { x: 0.5, y: 0.96, scale: 1, rotation: 0, opacity: 1 };
  text.card.width = (layout.size?.width ?? 1080) * 0.9;
  text.card.align = 'center';
  Object.assign(text.card.runs[0]!, {
    fontId: layout.captionFontId ?? 'system',
    size: layout.captionFontSize ?? 38,
    color: layout.captionColor ?? (layout.style === 'filmstrip' ? '#e3d4bc' : '#7e6c5b'),
    weight: 'normal',
  });
  return text;
}
/** A caption is a real editable text item, outside the list of media cells. */
export function updateTemplateCaption(track: Track) {
  const l = track.layout;
  if (!l || l.style === 'story') return;
  const text = (l.captionText ??= createTemplateCaption(track));
  text.card.runs[0]!.text = l.caption ?? 'LITTLE MOMENTS';
  Object.assign(text.card.runs[0]!, {
    fontId: l.captionFontId ?? 'system',
    size: l.captionFontSize ?? 38,
    color: l.captionColor ?? (l.style === 'filmstrip' ? '#e3d4bc' : '#7e6c5b'),
  });
}
export function captionEdited(track: Track) {
  const l = track.layout,
    text = l?.captionText;
  if (!l || !text) return;
  l.caption = text.card.runs.map((r) => r.text).join('');
  l.captionFontId = text.card.runs[0]?.fontId;
  l.captionFontSize = text.card.runs[0]?.size;
  l.captionColor = text.card.runs[0]?.color;
}
export function hydrateTemplateCaptions(p: Project): Project {
  const tracks = p.tracks.map((t) => {
    if (
      !t.template ||
      !t.layout ||
      t.layout.style === 'story' ||
      t.layout.captionText ||
      t.layout.caption === ''
    )
      return t;
    const next = { ...t, layout: { ...t.layout } };
    next.layout.captionText = createTemplateCaption(next);
    return next;
  });
  return tracks.some((t, i) => t !== p.tracks[i]) ? { ...p, tracks } : p;
}
/** Keep local caption edits when a group moves or changes duration, including sequential playback. */
export function retimeTemplateCaption(track: Track, before: { start: number; duration: number }) {
  const l = track.layout,
    text = l?.captionText;
  if (!l || !text) return;
  if (l.start === before.start && l.duration === before.duration) {
    const start = Math.max(l.start, Math.min(l.start + l.duration - 0.01, text.start));
    const duration = Math.max(0.01, Math.min(text.duration, l.start + l.duration - start));
    if (start !== text.start) text.start = start;
    if (duration !== text.duration) text.duration = duration;
    return;
  }
  const local = Math.max(0, Math.min(l.duration - 0.01, text.start - before.start));
  const followedEnd = Math.abs(text.start + text.duration - (before.start + before.duration)) < 0.01;
  text.start = l.start + local;
  text.duration = Math.max(
    0.01,
    Math.min(followedEnd ? l.duration - local : text.duration, l.duration - local),
  );
}
