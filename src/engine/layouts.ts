import { createOverlayClip, createTrack } from '../model/defaults';
import type { Project, Track, VideoItem } from '../model/types';
export type LayoutStyle = NonNullable<Project['layout']>['style'];
export type LayoutMotion = NonNullable<Project['layout']>['motion'];
export const LAYOUTS: { id: LayoutStyle; label: string; count: number }[] = [
  { id: 'photobooth', label: '拍貼三格', count: 3 },
  { id: 'filmstrip', label: '直式膠卷', count: 3 },
  { id: 'polaroid', label: '四格相紙', count: 4 },
];
export function layoutSlots(style: LayoutStyle): NonNullable<VideoItem['slot']>[] {
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
) {
  const slots = layoutSlots(style),
    assets = slots.map((_, i) => project.assets.find((a) => a.id === ids[i] && a.kind !== 'audio'));
  if (assets.some((a) => !a)) throw Error('請為每格選擇影片或照片');
  const duration = Math.min(
    Math.max(0.2, wanted),
    60,
    ...assets.filter((a) => a!.kind === 'video').map((a) => a!.duration),
  );
  if (!Number.isFinite(duration) || duration <= 0) throw Error('素材長度不正確');
  const tracks: Track[] = assets.map((asset, i) => {
    const slot = slots[i]!,
      track = createTrack('overlay', project.tracks),
      item = createOverlayClip(asset!, start);
    Object.assign(item, {
      duration,
      fit: 'cover',
      slot,
      transform: { x: slot.x + slot.w / 2, y: slot.y + slot.h / 2, scale: 1, rotation: 0, opacity: 1 },
    });
    track.name = `${LAYOUTS.find((x) => x.id === style)!.label} ${i + 1}`;
    track.template = true;
    track.muted = i > 0;
    track.items = [item];
    return track;
  });
  return { tracks, layout: { style, motion, start, duration } };
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
  c.fillStyle = style === 'filmstrip' ? '#17171b' : '#fff5df';
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
  c.fillText('LITTLE MOMENTS', w / 2, h * 0.96);
  if (artCache.size >= 4) artCache.delete(artCache.keys().next().value!);
  artCache.set(key, canvas);
  return canvas;
}
