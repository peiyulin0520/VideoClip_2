import { describe, expect, it } from 'vitest';
import type { MediaMask, Asset } from '../model/types';
import { maskContains } from './mediaMask';
import { audioBoundaries, audioRetained, excludeAudio } from './audioRanges';
import { createClip, createProject } from '../model/defaults';
import { audibleClips } from './audio';

const polygon: MediaMask = {
  points: [
    [0.1, 0.1],
    [0.5, 0.1],
    [0.5, 0.9],
    [0.1, 0.9],
  ],
};
describe('non-destructive mask refinements', () => {
  it('adds missing parts, erases inside, and later keep strokes can restore erased parts', () => {
    const mask: MediaMask = {
      ...polygon,
      strokes: [
        {
          tool: 'keep',
          size: 0.2,
          points: [
            [0.45, 0.5],
            [0.8, 0.5],
          ],
        },
        {
          tool: 'erase',
          size: 0.1,
          points: [
            [0.3, 0.2],
            [0.3, 0.8],
          ],
        },
      ],
    };
    expect(maskContains(mask, 0.75, 0.5, 0.5)).toBe(true);
    expect(maskContains(mask, 0.3, 0.5, 0.5)).toBe(false);
    expect(maskContains(mask, 0.2, 0.5, 0.5)).toBe(true);
    expect(maskContains(mask, 0.8, 0.9, 0.5)).toBe(false);
    mask.strokes!.push({ tool: 'keep', size: 0.04, points: [[0.3, 0.5]] });
    expect(maskContains(mask, 0.3, 0.5, 0.5)).toBe(true);
    expect(maskContains(mask, 0.3, 0.6, 0.5)).toBe(false);
    expect(maskContains(polygon, 0.3, 0.5)).toBe(true);
  });
  it('keeps a circular physical brush on portrait and landscape sources, including taps', () => {
    const m: MediaMask = { points: [], strokes: [{ tool: 'erase', size: 0.2, points: [[0.5, 0.5]] }] };
    expect(maskContains(m, 0.59, 0.5, 0.5)).toBe(false);
    expect(maskContains(m, 0.5, 0.54, 0.5)).toBe(false);
    expect(maskContains(m, 0.5, 0.56, 0.5)).toBe(true);
    expect(maskContains(m, 0.5, 0.68, 2)).toBe(false);
    expect(maskContains(m, 0.5, 0.72, 2)).toBe(true);
  });
  it('survives project JSON without flattening or modifying the original polygon', () => {
    const m: MediaMask = { ...polygon, strokes: [{ tool: 'erase', size: 0.1, points: [[0.25, 0.5]] }] };
    const restored = JSON.parse(JSON.stringify(m)) as MediaMask;
    expect(maskContains(restored, 0.25, 0.5)).toBe(false);
    expect(restored.points).toEqual(polygon.points);
  });
});
const asset: Asset = {
  id: 'a',
  kind: 'video',
  name: 'original',
  mime: 'video/webm',
  duration: 8,
  width: 1080,
  height: 1920,
  size: 1,
  hasAudio: true,
  thumbs: [],
};
describe('retained audio intervals', () => {
  it('removes several middle parts without shifting picture or source times', () => {
    let ranges: [number, number][] = [[0, 8]];
    ranges = excludeAudio(ranges, 2, 3);
    ranges = excludeAudio(ranges, 5, 6);
    expect(ranges).toEqual([
      [0, 2],
      [3, 5],
      [6, 8],
    ]);
    const item = { ...createClip(asset), start: 10, trimIn: 1, speed: 2, duration: 3, audioRanges: ranges };
    const p = createProject('voice');
    p.assets = [asset];
    p.tracks[0]!.items = [item];
    expect(audibleClips(p, 10.6)).toHaveLength(0);
    expect(audibleClips(p, 11.2)).toHaveLength(1);
    expect(audibleClips(p, 12.2)).toHaveLength(0);
    expect(item).toMatchObject({ start: 10, trimIn: 1, speed: 2, duration: 3 });
    expect(audioBoundaries(item)).toEqual([9.5, 10.5, 11, 12, 12.5, 13.5]);
  });
  it('supports fully silent, legacy full sound, and exact half-open boundaries', () => {
    const item = createClip(asset);
    expect(audioRetained(item, 2)).toBe(true);
    item.audioRanges = [];
    expect(audioRetained(item, 2)).toBe(false);
    item.audioRanges = [
      [1, 2],
      [4, 5],
    ];
    expect(audioRetained(item, 1)).toBe(true);
    expect(audioRetained(item, 2)).toBe(false);
    expect(
      excludeAudio(
        [
          [1, 2],
          [4, 5],
        ],
        0,
        8,
      ),
    ).toEqual([]);
  });
});

it('brush-only retention starts empty and erased original starts full; UV coordinates survive zoom', () => {
  const mask: MediaMask = {
    points: [],
    base: 'empty',
    strokes: [{ tool: 'keep', size: 0.1, points: [[0.5, 0.5]] }],
  };
  expect(maskContains(mask, 0.5, 0.5)).toBe(true);
  expect(maskContains(mask, 0.1, 0.1)).toBe(false);
  const restored = JSON.parse(JSON.stringify(mask)) as MediaMask;
  expect(maskContains(restored, 0.5, 0.5)).toBe(true);
  restored.strokes!.push({ tool: 'erase', size: 0.05, points: [[0.5, 0.5]] });
  expect(maskContains(restored, 0.5, 0.5)).toBe(false);
  expect(
    maskContains({ points: [], strokes: [{ tool: 'erase', size: 0.1, points: [[0.5, 0.5]] }] }, 0.1, 0.1),
  ).toBe(true);
});
