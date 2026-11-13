import type { Project } from '../model/types';
import type { SceneLayer } from './compositor';
export type Effect = NonNullable<Project['effects']>[number];
export const EFFECTS: { id: Effect['preset']; label: string; description: string }[] = [
  { id: 'flash', label: '閃光', description: '白色閃一下，適合接到下一個鏡頭。' },
  { id: 'light-leak', label: '暖光掃過', description: '暖色光從左向右掃過，適合膠卷與月份回顧。' },
  { id: 'fade-black', label: '經黑轉場', description: '先變黑再亮起；將中點對準兩段交接處。' },
  { id: 'fade-white', label: '經白轉場', description: '先變白再亮起；將中點對準兩段交接處。' },
];
const cache = new Map<string, HTMLCanvasElement>();
export function solidCanvas(color: string) {
  if (cache.has(color)) return cache.get(color)!;
  const c = document.createElement('canvas');
  c.width = 256;
  c.height = 2;
  const ctx = c.getContext('2d')!;
  if (color === 'warm') {
    const g = ctx.createLinearGradient(0, 0, 256, 0);
    g.addColorStop(0, '#ff751800');
    g.addColorStop(0.3, '#ff982dcc');
    g.addColorStop(0.5, '#fff3bfff');
    g.addColorStop(0.7, '#ff982dcc');
    g.addColorStop(1, '#ff751800');
    ctx.fillStyle = g;
  } else ctx.fillStyle = color;
  ctx.fillRect(0, 0, 256, 2);
  cache.set(color, c);
  return c;
}
export function effectLayer(effect: Effect, t: number, w: number, h: number): SceneLayer | null {
  if (!['flash', 'light-leak', 'fade-black', 'fade-white'].includes(effect.preset)) return null;
  const p = (t - effect.start) / effect.duration;
  if (p < 0 || p >= 1) return null;
  const warm = effect.preset === 'light-leak',
    source = solidCanvas(warm ? 'warm' : effect.preset === 'fade-black' ? '#000000' : '#ffffff');
  return {
    id: effect.id,
    kind: 'image',
    source,
    ready: true,
    srcW: 256,
    srcH: 2,
    frameW: 256,
    frameH: 2,
    box: { cx: w * (warm ? -0.5 + 2 * p : 0.5), cy: h / 2, w: w * (warm ? 1.5 : 1), h, rotation: 0 },
    opacity: Math.sin(Math.PI * p) ** 2 * effect.strength,
    blend: 'normal',
    cornerRadius: 0,
  };
}
