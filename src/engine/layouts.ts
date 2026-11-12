import { createOverlayClip, createTrack } from '../model/defaults';
import type { Project, VideoItem } from '../model/types';
export type LayoutStyle = NonNullable<Project['layout']>['style'];
export type LayoutMotion = NonNullable<Project['layout']>['motion'];
export const LAYOUTS: { id: LayoutStyle; label: string; count: number }[] = [
  { id: 'photobooth', label: '拍貼三格', count: 3 },
  { id: 'filmstrip', label: '直式膠卷', count: 3 },
  { id: 'polaroid', label: '四格相紙', count: 4 },
  { id: 'story', label: '展開故事', count: 3 },
];
export function slotLabel(style: LayoutStyle, index: number) {
  return style === 'polaroid' ? ['左上', '右上', '左下', '右下'][index]! : ['上方', '中間', '下方'][index]!;
}
export function layoutSlots(style: LayoutStyle, count = 3): NonNullable<VideoItem['slot']>[] {
  if (style === 'story')
    return Array.from({ length: count }, (_, i) => ({ x: 0, y: i / count, w: 1, h: 1 / count }));
  if (style === 'polaroid')
    return [
      { x: 0.07, y: 0.08, w: 0.4, h: 0.35 },
      { x: 0.53, y: 0.08, w: 0.4, h: 0.35 },
      { x: 0.07, y: 0.49, w: 0.4, h: 0.35 },
      { x: 0.53, y: 0.49, w: 0.4, h: 0.35 },
    ];
  return [0, 1, 2].map((i) => ({
    x: style === 'filmstrip' ? 0.12 : 0.08,
    y: 0.045 + i * 0.3,
    w: style === 'filmstrip' ? 0.76 : 0.84,
    h: 0.27,
  }));
}
export function layoutMotion(layout: Project['layout'], t: number) {
  if (!layout || layout.motion === 'none') return { x: 0, y: 0 };
  const progress = Math.max(0, Math.min(1, (t - layout.start) / layout.duration));
  if (layout.motion === 'drift') return { x: 0, y: 0.35 - 0.7 * progress };
  const enter = Math.min(1, Math.max(0, (t - layout.start) / Math.min(0.8, layout.duration / 3)));
  const exit = Math.min(
    1,
    Math.max(
      0,
      (t - (layout.start + layout.duration - Math.min(0.6, layout.duration / 3))) /
        Math.min(0.6, layout.duration / 3),
    ),
  );
  return { x: (1 - enter) ** 3 - exit ** 3, y: 0 };
}
export function collagePlan(
  project: Project,
  ids: string[],
  style: LayoutStyle,
  motion: LayoutMotion,
  start: number,
  wanted: number,
  sourceItems?: VideoItem[],
) {
  const slots = layoutSlots(style, Math.max(2, Math.min(3, ids.length))),
    assets = slots.map((_, i) => project.assets.find((a) => a.id === ids[i] && a.kind !== 'audio'));
  if (assets.some((a) => !a)) throw Error('請為每格選擇影片或照片');
  const duration = Math.min(Math.max(0.2, wanted), 60);
  if (!Number.isFinite(duration) || duration <= 0) throw Error('素材長度不正確');
  const track = createTrack('overlay', project.tracks);
  track.name = LAYOUTS.find((x) => x.id === style)!.label;
  track.template = true;
  track.items = assets.map((asset, i) => {
    const slot = slots[i]!,
      item = createOverlayClip(asset!, start);
    if (sourceItems?.[i]) Object.assign(item, structuredClone(sourceItems[i]), { id: item.id, start });
    Object.assign(item, {
      duration,
      cell: {
        sourceEnd:
          asset!.kind === 'image'
            ? 600
            : Math.min(
                asset!.duration,
                sourceItems?.[i]
                  ? sourceItems[i]!.trimIn + sourceItems[i]!.duration * sourceItems[i]!.speed
                  : asset!.duration,
              ),
        offset: 0,
        blanks: [],
        background: '#000000',
      },
      fit: 'cover',
      slot,
      // Only the first cell supplies sound by default; a group is one visible timeline layer.
      audioEnabled: i === 0 && sourceItems?.[i]?.audioEnabled !== false,
      transform: { x: slot.x + slot.w / 2, y: slot.y + slot.h / 2, scale: 1, rotation: 0, opacity: 1 },
    });
    return item;
  });
  const layout: NonNullable<Project['layout']> = {
    style,
    motion,
    start,
    duration,
    count: slots.length,
    transform: { x: 0.5, y: 0.5, scale: 1 },
    ...(style === 'story'
      ? {
          motion: 'none',
          story: {
            title: 'NOVEMBER',
            fontIds: ['system', 'noto-serif-tc', 'mantou-sans'],
            fontInterval: 0.12,
            opening: 0.7,
            step: 0.45,
            flash: true,
          },
        }
      : {}),
  };
  track.layout = { ...layout };
  const tracks = [track];
  return { tracks, layout };
}
const artCache = new Map<string, HTMLCanvasElement>();
export function layoutArt(style: LayoutStyle, w: number, h: number) {
  const key = `${style}:${w}:${h}`,
    cached = artCache.get(key);
  if (cached) return cached;
  const canvas = document.createElement('canvas');
  canvas.width = w;
  canvas.height = h;
  const c = canvas.getContext('2d')!;
  c.fillStyle = style === 'filmstrip' || style === 'story' ? '#17171b' : '#fff5df';
  c.fillRect(0, 0, w, h);
  if (style === 'filmstrip') {
    c.fillStyle = '#eee6d6';
    for (let y = 0.02; y < 1; y += 0.055)
      for (const x of [0.025, 0.94]) {
        c.beginPath();
        c.roundRect(x * w, y * h, 0.035 * w, 0.025 * h, w * 0.008);
        c.fill();
      }
  }
  c.fillStyle = style === 'filmstrip' ? '#e3d4bc' : '#7e6c5b';
  c.textAlign = 'center';
  c.font = `${w * 0.035}px sans-serif`;
  if (style !== 'story') c.fillText('LITTLE MOMENTS', w / 2, h * 0.96);
  if (artCache.size >= 4) artCache.delete(artCache.keys().next().value!);
  artCache.set(key, canvas);
  return canvas;
}

/** Earlier versions used one track per slot. Preserve their media and settings in one group. */
export function mergeLegacyTemplate(project: Project): Project {
  const old = project.tracks.filter((t) => t.template);
  if (old.length < 2 || old.some((t) => t.layout)) return project;
  const group = {
    ...old[0]!,
    layout: project.layout ? { ...project.layout } : undefined,
    name: project.layout ? LAYOUTS.find((l) => l.id === project.layout!.style)!.label : '多格版型',
    hidden: old.every((t) => t.hidden),
    locked: old.every((t) => t.locked),
    muted: false,
    items: old.flatMap((tr) =>
      tr.items.map((it) => ({
        ...it,
        ...(it.type !== 'text' ? { audioEnabled: !tr.muted && it.audioEnabled !== false } : {}),
        transform: { ...it.transform, opacity: tr.hidden ? 0 : it.transform.opacity },
      })),
    ),
  };
  const first = project.tracks.findIndex((t) => t.template);
  const tracks = project.tracks.filter((t) => !t.template);
  tracks.splice(first, 0, group);
  return { ...project, tracks };
}
