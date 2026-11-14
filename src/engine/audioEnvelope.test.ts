import { expect, it } from 'vitest';
import { audioWindows, windowGain, softLimit } from './audioEnvelope';
import type { VideoItem } from '../model/types';
it('maps retained audio and source gaps through trim and speed to actual audible boundaries', () => {
  const item = {
    start: 5,
    duration: 4,
    trimIn: 2,
    speed: 2,
    audioRanges: [
      [3, 5],
      [7, 10],
    ],
    sourceRanges: [
      [2, 4],
      [6, 10],
    ],
  } as VideoItem;
  expect(audioWindows(item)).toEqual([
    { start: 5.5, end: 6 },
    { start: 7.5, end: 9 },
  ]);
});
it('fades only true clip/range boundaries, so decoded chunk boundaries remain continuous', () => {
  const w = { start: 0, end: 3 };
  expect(windowGain(w, 0, 1)).toBe(0);
  expect(windowGain(w, 3, 1)).toBe(0);
  expect(windowGain(w, 0.006, 1)).toBeCloseTo(0.5);
  expect(windowGain(w, 1, 1)).toBe(1);
  expect(windowGain(w, 2.999, 1)).toBeCloseTo(1 / 12);
  expect(windowGain({ start: 0, end: 0.004 }, 0.002, 1)).toBe(1);
});
it('keeps quiet audio unchanged and smoothly bounds mixed peaks without a hard clipped plateau', () => {
  expect(softLimit(0.5)).toBe(0.5);
  expect(softLimit(-0.5)).toBe(-0.5);
  expect(softLimit(2)).toBeLessThanOrEqual(1);
  expect(softLimit(-2)).toBeGreaterThanOrEqual(-1);
  expect(softLimit(0.95)).toBeLessThan(softLimit(1));
  expect(Math.abs((softLimit(0.90001) - softLimit(0.9)) / 0.00001 - 1)).toBeLessThan(0.001);
});
