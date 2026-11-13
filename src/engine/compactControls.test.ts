import { describe, expect, it } from 'vitest';
import { cropPointer } from './cropPointer';
import { graphiteAlpha } from './pencilBrush';
describe('offset crop aiming in source coordinates', () => {
  const bounds = { left: 40, top: 100, width: 200, height: 400 };
  it('keeps the brush above the finger by a CSS-pixel distance', () => {
    expect(cropPointer(140, 316, bounds, 56)).toEqual({ contact: [0.5, 0.54], target: [0.5, 0.4] });
  });
  it('keeps zero-offset direct editing available', () => {
    expect(cropPointer(140, 260, bounds, 0).target).toEqual([0.5, 0.4]);
  });
  it('clamps the actual target at source edges without moving saved content', () => {
    expect(cropPointer(10, 120, bounds, 56).target).toEqual([0, 0]);
    expect(cropPointer(260, 580, bounds, 56).target).toEqual([1, 1]);
  });
  it('uses CSS pixels consistently at different preview sizes', () => {
    expect(cropPointer(90, 236, { ...bounds, width: 100, height: 200 }, 56).target).toEqual([0.5, 0.4]);
  });
});
describe('broken graphite texture', () => {
  const values = Array.from({ length: 1024 }, (_, i) => graphiteAlpha(i % 32, Math.floor(i / 32)));
  it('leaves paper gaps instead of a continuous ballpoint core', () => {
    const fraction = values.filter((a) => !a).length / values.length;
    expect(fraction).toBeGreaterThan(0.25);
    expect(fraction).toBeLessThan(0.45);
  });
  it('is visible but translucent and varied', () => {
    expect(Math.max(...values)).toBeLessThan(130);
    expect(values.reduce((a, b) => a + b, 0) / values.length).toBeGreaterThan(35);
    expect(new Set(values).size).toBeGreaterThan(60);
  });
  it('anchors grain to source pixels across redraws', () => {
    expect(values).toEqual(Array.from({ length: 1024 }, (_, i) => graphiteAlpha(i % 32, Math.floor(i / 32))));
  });
});
