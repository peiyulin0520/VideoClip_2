import { expect, it } from 'vitest';
import { createClip, createProject } from '../model/defaults';
import type { Asset } from '../model/types';
import { createFramework, addTemplateAsset } from './templateModel';
import { decoderBudget } from './decoderBudget';
const asset: Asset = {
  id: 'a',
  name: 'a',
  kind: 'video',
  width: 160,
  height: 284,
  duration: 1,
  hasAudio: false,
  mime: 'video/webm',
  size: 1,
  thumbs: [],
};
it('reserves all 16 cells, holds, a visible base and prefetch without counting thousands of sequential files', () => {
  const p = createProject('pool');
  p.assets = [asset];
  p.tracks[0]!.items = Array.from({ length: 1000 }, (_, i) => ({ ...createClip(asset), start: i }));
  expect(decoderBudget(p)).toBe(3);
  const group = createFramework(p, 4, 4, 0);
  p.tracks.push(group);
  for (let i = 1; i <= 16; i++) addTemplateAsset(p, group, asset, i);
  expect(decoderBudget(p)).toBe(35);
  group.layout!.gapMode = 'transparent';
  expect(decoderBudget(p)).toBe(19);
  group.hidden = true;
  expect(decoderBudget(p)).toBe(3);
});
