export type BrushPoint = [number, number, number, number]; // x/y normalized, pressure, milliseconds

/** Hardware pressure where available; otherwise speed and tapered ends for finger/mouse input. */
export function dynamicWidths(points: BrushPoint[], size: number): number[] {
  const pressures = points.map((p) => p[2]).filter((p) => p > 0);
  const hardware = pressures.length > 1 && Math.max(...pressures) - Math.min(...pressures) > 0.03;
  return points.map((point, i) => {
    if (hardware) return size * (0.15 + 0.85 * Math.max(0, Math.min(1, point[2])));
    const before = points[Math.max(0, i - 1)]!;
    const speed =
      (Math.hypot(point[0] - before[0], point[1] - before[1]) * 1000) / Math.max(8, point[3] - before[3]);
    const taper = 0.3 + 0.7 * Math.sin((Math.PI * i) / Math.max(1, points.length - 1));
    return size * Math.max(0.12, taper / (1 + speed * 0.5));
  });
}
