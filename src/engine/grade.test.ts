import { expect, it } from 'vitest';
import {
  DEFAULT_ADJUSTMENT as D,
  gradeRGB,
  hasGrade,
  resolveAdjustment,
  TONE_KEYS,
  TONE_PRESETS,
} from './grade';
import {
  addKeyframe,
  animationTarget,
  animationValues,
  editAnimatedValues,
  evaluatedItem,
  trimKeyframes,
} from './keyframes';
import { createClip, createProject } from '../model/defaults';
import type { Asset, Keyframe } from '../model/types';

const patch = (p: Partial<typeof D>) => ({ ...D, ...p });
it('defaults older projects and diamonds to neutral new parameters without introducing NaN', () => {
  const legacy = { brightness: 0.8, saturation: 0.7, temperature: 0.2, tint: '#ffffff' };
  const v = resolveAdjustment(legacy);
  expect(v.exposure).toBe(0);
  expect(v.contrast).toBe(1);
  expect(v.brightness).toBe(0.8);
  const old = { time: 0, values: { ...legacy, x: 0.4, y: 0.6, scale: 1, rotation: 0, opacity: 1 } };
  for (const t of [-1, 0, 1])
    expect(animationValues({ keyframes: [old] }, t)).toEqual({
      ...v,
      x: 0.4,
      y: 0.6,
      scale: 1,
      rotation: 0,
      opacity: 1,
    });
  expect(hasGrade(D)).toBe(false);
  expect(hasGrade({ ...legacy, exposure: 1 })).toBe(true);
});
it('neutral is identity and old saturation then white balance remains compatible', () => {
  expect(gradeRGB([0.3, 0.5, 0.7], D)).toEqual([0.3, 0.5, 0.7]);
  const mono = gradeRGB([0.2, 0.6, 0.4], patch({ saturation: 0, temperature: 0.5, brightness: 0.8 }));
  const l = (0.2 * 0.2126 + 0.6 * 0.7152 + 0.4 * 0.0722) * 0.8;
  expect(mono[0]).toBeCloseTo(l * 1.09);
  expect(mono[1]).toBeCloseTo(l);
  expect(mono[2]).toBeCloseTo(l * 0.91);
});
it('exposure is photographic stops, independently from brightness and contrast', () => {
  expect(gradeRGB([0.1, 0.2, 0.3], patch({ exposure: 1 }))).toEqual([0.2, 0.4, 0.6]);
  gradeRGB([0.2, 0.4, 0.6], patch({ exposure: -1 })).forEach((v, i) =>
    expect(v).toBeCloseTo([0.1, 0.2, 0.3][i]!),
  );
  const high = gradeRGB([0.2, 0.5, 0.8], patch({ contrast: 1.5 }));
  expect(high[0]).toBeLessThan(0.2);
  expect(high[1]).toBeCloseTo(0.5);
  expect(high[2]).toBeGreaterThan(0.8);
});
it('highlight recovery preferentially changes bright values while black point changes dark values', () => {
  const hi = (n: number) => gradeRGB([n, n, n], patch({ highlights: -1 }))[0];
  expect(hi(0.2)).toBeCloseTo(0.2);
  expect(hi(0.85)).toBeLessThan(0.6);
  const black = (n: number) => gradeRGB([n, n, n], patch({ blacks: 0.5 }))[0];
  expect(black(0.85)).toBeCloseTo(0.85);
  expect(black(0.2)).toBeLessThan(0.1);
});
it('vibrance boosts muted colours more than already saturated ones and does not tint neutrals', () => {
  const delta = (c: number[]) => gradeRGB(c, patch({ vibrance: 1 }))[0] - c[0]!;
  expect(delta([0.6, 0.45, 0.45])).toBeGreaterThan(delta([0.9, 0.1, 0.1]));
  expect(gradeRGB([0.4, 0.4, 0.4], patch({ vibrance: 1 }))).toEqual([0.4, 0.4, 0.4]);
});
it('all named combinations are distinct and finite, and black and white really removes chroma', () => {
  expect(TONE_PRESETS.length).toBeGreaterThanOrEqual(13);
  expect(new Set(TONE_PRESETS.map((p) => JSON.stringify(p.values))).size).toBe(TONE_PRESETS.length);
  for (const p of TONE_PRESETS)
    for (const c of [
      [0, 0, 0],
      [1, 1, 1],
      [0.8, 0.3, 0.2],
    ])
      expect(gradeRGB(c, p.values).every((v) => Number.isFinite(v) && v >= 0 && v <= 1)).toBe(true);
  const bw = gradeRGB([0.8, 0.3, 0.2], TONE_PRESETS.find((p) => p.id === 'mono')!.values);
  expect(bw[0]).toBeCloseTo(bw[1]);
  expect(bw[1]).toBeCloseTo(bw[2]);
});
const movie = () => {
  const asset = { id: 'a', kind: 'video', duration: 4 } as Asset;
  const p = createProject('色調測試');
  p.assets.push(asset);
  const item = createClip(asset);
  item.id = 'clip';
  p.tracks[0]!.items = [item];
  return { p, item };
};
it('all tonal parameters interpolate between diamonds while retaining their transform and tint', () => {
  const { p, item } = movie();
  addKeyframe(p, item.id, 0);
  const end = {
    ...D,
    brightness: 1.2,
    exposure: 1,
    contrast: 1.4,
    saturation: 0.4,
    highlights: -0.6,
    shadows: 0.4,
    blacks: 0.3,
    vibrance: 0.5,
    temperature: -0.8,
    fade: 0.2,
  };
  editAnimatedValues(p, item.id, 4, { ...end, x: 0.7, tint: '#0000ff' }, true);
  const mid = animationValues(item, 2);
  for (const k of TONE_KEYS) expect(mid[k]).toBeCloseTo((D[k] + end[k]) / 2);
  expect(mid.x).toBeCloseTo(0.6);
  expect(mid.tint).toBe('#8080ff');
  expect(evaluatedItem(item, 2).adjustment?.exposure).toBeCloseTo(0.5);
  const sliced = trimKeyframes(item, 1, 3)!;
  expect(animationValues({ keyframes: sliced }, 1).exposure).toBeCloseTo(0.5);
});
it('editing one tonal diamond does not rewrite another or remove movement, and neutral reset stays local', () => {
  const { p, item } = movie();
  addKeyframe(p, item.id, 0);
  editAnimatedValues(p, item.id, 3, { exposure: 1, highlights: -0.5, x: 0.8 }, true);
  editAnimatedValues(p, item.id, 3, { ...D });
  expect(item.keyframes).toHaveLength(2);
  expect(item.keyframes![0]!.values.exposure).toBe(0);
  expect(item.keyframes![1]!.values.x).toBe(0.8);
  expect(item.keyframes![1]!.values.exposure).toBe(0);
});
it('legacy diamonds interpolate new neutral fields correctly when the next diamond is graded', () => {
  const old = {
    time: 0,
    values: {
      brightness: 1,
      saturation: 1,
      temperature: 0,
      tint: '#ffffff',
      x: 0.5,
      y: 0.5,
      scale: 1,
      opacity: 1,
      rotation: 0,
    },
  };
  const next: Keyframe = { time: 2, values: { ...old.values, exposure: 1, contrast: 1.2, blacks: 0.2 } };
  const mid = animationValues({ keyframes: [old, next] }, 1);
  expect(mid.exposure).toBeCloseTo(0.5);
  expect(mid.contrast).toBeCloseTo(1.1);
  expect(mid.blacks).toBeCloseTo(0.1);
});
it('template grading writes group diamonds and leaves cell media settings intact', () => {
  const { p, item } = movie();
  const track = p.tracks[0]!;
  track.template = true;
  track.layout = { style: 'photobooth', motion: 'none', start: 0, duration: 4 };
  addKeyframe(p, item.id, 0);
  editAnimatedValues(p, item.id, 2, { exposure: 1, vibrance: 0.4 }, true);
  expect(animationValues(animationTarget(p, item.id).target, 1).exposure).toBeCloseTo(0.5);
  expect(item.keyframes).toBeUndefined();
  expect(item.adjustment).toBeUndefined();
});
