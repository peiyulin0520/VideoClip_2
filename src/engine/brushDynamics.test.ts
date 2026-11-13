import { describe, it, expect } from 'vitest';
import { dynamicWidths, type BrushPoint } from './brushDynamics';
describe('pressure and finger brush dynamics', () => {
  it('uses measured pressure for visibly different widths', () => {
    const widths = dynamicWidths(
      [
        [0, 0, 0.1, 0],
        [0.3, 0, 0.9, 100],
        [0.6, 0, 0.1, 200],
      ],
      100,
    );
    expect(widths[1]!).toBeGreaterThan(widths[0]! * 3);
  });
  it('tapers constant-pressure finger and mouse input instead of drawing a uniform line', () => {
    const points: BrushPoint[] = Array.from({ length: 9 }, (_, i) => [i / 20, 0, 0.5, i * 50]);
    const widths = dynamicWidths(points, 100);
    expect(widths[4]!).toBeGreaterThan(widths[0]! * 2);
    expect(widths[4]!).toBeGreaterThan(widths[8]! * 2);
  });
  it('makes fast finger motion thinner while preserving a visible minimum', () => {
    const points = (dt: number): BrushPoint[] =>
      Array.from({ length: 5 }, (_, i) => [i / 20, 0, 0.5, i * dt]);
    const slow = dynamicWidths(points(100), 100),
      fast = dynamicWidths(points(10), 100);
    expect(slow[2]!).toBeGreaterThan(fast[2]! * 2);
    expect(Math.min(...fast)).toBeGreaterThanOrEqual(12);
  });
  it('clamps pressure values and handles a single dot', () => {
    expect(dynamicWidths([[0, 0, 0, 0]], 10)[0]).toBeGreaterThan(0);
    const values = dynamicWidths(
      [
        [0, 0, -1, 0],
        [0.1, 0, 0.2, 20],
        [0.2, 0, 2, 40],
      ],
      10,
    );
    expect(values.every((v) => v > 0 && v <= 10)).toBe(true);
  });
});
