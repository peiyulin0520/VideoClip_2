import type { TextItem } from '../model/types';
import type { TextRender } from './textRender';
export const TEXT_FXS = [
  { id: 'shimmer', name: '閃爍' },
  { id: 'sparkle', name: '發光閃亮' },
  { id: 'pixel', name: '方格字' },
  { id: 'shake', name: '震動' },
] as const;
type Buffers = { out: HTMLCanvasElement; aux: HTMLCanvasElement; small: HTMLCanvasElement; key: string };
const buffers = new Map<string, Buffers>();
const canvas = () => document.createElement('canvas');
export function applyTextFx(
  base: TextRender,
  fx: NonNullable<TextItem['textFx']>,
  time: number,
  id: string,
  color: string,
): TextRender {
  let b = buffers.get(id);
  if (!b) {
    b = { out: canvas(), aux: canvas(), small: canvas(), key: '' };
    buffers.set(id, b);
    if (buffers.size > 16) buffers.delete(buffers.keys().next().value!);
  }
  const w = base.canvas.width,
    h = base.canvas.height,
    cycle = Math.max(0.4, fx.duration ?? 2),
    held = fx.playback === 'hold' && time >= cycle;
  const step = held ? -1 : Math.floor(((Math.max(0, time) % cycle) / cycle) * 60 + 1e-6),
    key = `${base.key}|${fx.kind}|${step}|${color}`;
  if (b.key === key) return { ...base, canvas: b.out, key };
  b.key = key;
  for (const c of [b.out, b.aux])
    if (c.width !== w || c.height !== h) {
      c.width = w;
      c.height = h;
    }
  const g = b.out.getContext('2d')!,
    a = b.aux.getContext('2d')!;
  g.setTransform(1, 0, 0, 1, 0, 0);
  g.globalAlpha = 1;
  g.globalCompositeOperation = 'source-over';
  g.shadowBlur = 0;
  g.clearRect(0, 0, w, h);
  a.globalCompositeOperation = 'source-over';
  a.clearRect(0, 0, w, h);
  const t = step / 60;
  if (held) g.drawImage(base.canvas, 0, 0);
  else if (fx.kind === 'shimmer') {
    g.globalAlpha = 0.5;
    g.drawImage(base.canvas, 0, 0);
    g.globalAlpha = 1;
    a.drawImage(base.canvas, 0, 0);
    const x = t * (w * 1.6) - w * 0.3,
      gradient = a.createLinearGradient(x - w * 0.3, 0, x + w * 0.3, 0);
    gradient.addColorStop(0, '#0000');
    gradient.addColorStop(0.5, '#000');
    gradient.addColorStop(1, '#0000');
    a.globalCompositeOperation = 'destination-in';
    a.fillStyle = gradient;
    a.fillRect(0, 0, w, h);
    g.drawImage(b.aux, 0, 0);
  } else if (fx.kind === 'sparkle') {
    g.shadowColor = color;
    g.shadowBlur = (0.1 + 0.1 * Math.sin(t * Math.PI * 2)) * Math.min(w, h);
    g.drawImage(base.canvas, 0, 0);
    g.shadowBlur = 0;
    g.drawImage(base.canvas, 0, 0);
    g.fillStyle = '#fff';
    for (let i = 0; i < 5; i++) {
      g.globalAlpha = Math.max(0, Math.sin(t * Math.PI * 2 + i * 2));
      const x = ((i * 0.193 + 0.1) % 1) * w,
        y = ((i * 0.317 + 0.2) % 1) * h,
        r = Math.max(2, Math.min(w, h) * 0.04);
      g.fillRect(x - r, y - 1, r * 2, 2);
      g.fillRect(x - 1, y - r, 2, r * 2);
    }
    g.globalAlpha = 1;
  } else if (fx.kind === 'pixel') {
    const width = Math.max(4, Math.round(w / 10)),
      height = Math.max(4, Math.round(h / 10));
    if (b.small.width !== width || b.small.height !== height) {
      b.small.width = width;
      b.small.height = height;
    }
    const small = b.small.getContext('2d')!;
    small.clearRect(0, 0, width, height);
    small.drawImage(base.canvas, Math.sin(t * 9), Math.cos(t * 9), width, height);
    g.imageSmoothingEnabled = false;
    g.drawImage(b.small, 0, 0, w, h);
    g.imageSmoothingEnabled = true;
  } else {
    const dx = Math.sin(step * 7.3) * Math.min(w, h) * 0.025,
      dy = Math.sin(step * 11.7) * Math.min(w, h) * 0.012;
    g.drawImage(base.canvas, dx, dy);
  }
  return { ...base, canvas: b.out, key };
}
