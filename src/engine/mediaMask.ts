import type { MediaMask } from '../model/types';

/** Source UV coordinates; brush diameter is a fraction of source width. */
export function maskContains(mask: MediaMask, x: number, y: number, aspect = 1) {
  let inside = mask.points.length < 3 && mask.base !== 'empty';
  for (let a = 0, b = mask.points.length - 1; a < mask.points.length; b = a++) {
    const [ax, ay] = mask.points[a]!,
      [bx, by] = mask.points[b]!;
    if (ay > y !== by > y && x < ((bx - ax) * (y - ay)) / (by - ay) + ax) inside = !inside;
  }
  for (const s of mask.strokes ?? []) {
    for (let i = 0; i < s.points.length; i++) {
      const a = s.points[Math.max(0, i - 1)]!,
        b = s.points[i]!;
      const dx = b[0] - a[0],
        dy = (b[1] - a[1]) / aspect;
      const u = Math.max(
        0,
        Math.min(1, ((x - a[0]) * dx + ((y - a[1]) / aspect) * dy) / (dx * dx + dy * dy || 1)),
      );
      if (Math.hypot(x - a[0] - u * dx, (y - a[1]) / aspect - u * dy) <= s.size / 2) {
        inside = s.tool === 'keep';
        break;
      }
    }
  }
  return inside;
}

/** Used by crop preview and compositor/export; independent of item transforms. */
export function paintMask(ctx: CanvasRenderingContext2D, mask: MediaMask, w: number, h: number) {
  ctx.clearRect(0, 0, w, h);
  ctx.fillStyle = ctx.strokeStyle = '#fff';
  if (mask.points.length < 3) {
    if (mask.base !== 'empty') ctx.fillRect(0, 0, w, h);
  } else {
    ctx.beginPath();
    mask.points.forEach(([x, y], i) => (i ? ctx.lineTo(x * w, y * h) : ctx.moveTo(x * w, y * h)));
    ctx.closePath();
    ctx.fill();
  }
  for (const s of mask.strokes ?? []) {
    ctx.save();
    ctx.globalCompositeOperation = s.tool === 'keep' ? 'source-over' : 'destination-out';
    ctx.lineWidth = s.size * w;
    ctx.lineCap = ctx.lineJoin = 'round';
    ctx.beginPath();
    s.points.forEach(([x, y], i) => (i ? ctx.lineTo(x * w, y * h) : ctx.moveTo(x * w, y * h)));
    if (s.points.length === 1) {
      const [x, y] = s.points[0]!;
      ctx.arc(x * w, y * h, (s.size * w) / 2, 0, Math.PI * 2);
      ctx.fill();
    } else ctx.stroke();
    ctx.restore();
  }
}
