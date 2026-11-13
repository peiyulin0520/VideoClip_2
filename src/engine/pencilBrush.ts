import type { BrushPoint } from './brushDynamics';

/** Paper grain is anchored to source pixels, so repeated strokes darken graphite without filling every gap. */
export function graphiteAlpha(x: number, y: number): number {
  let n = Math.imul(x + 173, 374761393) ^ Math.imul(y + 719, 668265263);
  n = Math.imul(n ^ (n >>> 13), 1274126177);
  const grain = ((n ^ (n >>> 16)) >>> 0) / 4294967296;
  if (grain < 0.34) return 0;
  return Math.round(24 + 100 * ((grain - 0.34) / 0.66));
}

/** Rasterize only the stroke bounds, then replace its solid core with broken graphite texture. */
export function paintPencil(
  ctx: CanvasRenderingContext2D,
  points: BrushPoint[],
  size: number,
  color: string,
  w: number,
  h: number,
) {
  if (!points.length) return;
  const xs = points.map((p) => p[0] * w),
    ys = points.map((p) => p[1] * h);
  const left = Math.max(0, Math.floor(Math.min(...xs) - size / 2 - 1));
  const top = Math.max(0, Math.floor(Math.min(...ys) - size / 2 - 1));
  const right = Math.min(w, Math.ceil(Math.max(...xs) + size / 2 + 1));
  const bottom = Math.min(h, Math.ceil(Math.max(...ys) + size / 2 + 1));
  const c = document.createElement('canvas');
  c.width = Math.max(1, right - left);
  c.height = Math.max(1, bottom - top);
  const ink = c.getContext('2d')!;
  ink.strokeStyle = ink.fillStyle = color;
  ink.lineWidth = size;
  ink.lineCap = ink.lineJoin = 'round';
  ink.beginPath();
  if (points.length === 1) {
    ink.arc(xs[0]! - left, ys[0]! - top, size / 2, 0, Math.PI * 2);
    ink.fill();
  } else {
    points.forEach((_, i) =>
      i ? ink.lineTo(xs[i]! - left, ys[i]! - top) : ink.moveTo(xs[i]! - left, ys[i]! - top),
    );
    ink.stroke();
  }
  const pixels = ink.getImageData(0, 0, c.width, c.height);
  for (let y = 0; y < c.height; y++)
    for (let x = 0; x < c.width; x++) {
      const a = (y * c.width + x) * 4 + 3;
      pixels.data[a] = Math.round((pixels.data[a]! * graphiteAlpha(left + x, top + y)) / 255);
    }
  ink.putImageData(pixels, 0, 0);
  ctx.drawImage(c, left, top);
}
