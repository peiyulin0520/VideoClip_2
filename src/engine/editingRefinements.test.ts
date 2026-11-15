import { afterEach, expect, it } from 'vitest';
import { createClip, createProject, createTextItem } from '../model/defaults';
import type { Asset, VideoItem } from '../model/types';
import {
  addKeyframe,
  animationTarget,
  animationValues,
  editAnimatedValues,
  keyframeAt,
  toggleKeyframe,
  trimKeyframes,
} from './keyframes';
import { LOCAL_MOTIONS } from './keyframeMotion';
import { useProjectStore } from '../store/projectStore';
import { removeAnyItem, splitAny, placeItem } from '../store/actions';
import { itemName } from './itemName';
import { sourceTimeAt } from './timeline';
import { transitionRanges } from './animationTiming';
const asset: Asset = {
  id: 'source',
  name: 'original',
  kind: 'video',
  mime: 'video/webm',
  size: 1,
  duration: 12,
  width: 160,
  height: 96,
  hasAudio: true,
  thumbs: [],
};
const setup = () => {
  const p = createProject('regression');
  p.freeMain = true;
  p.assets = [asset];
  p.tracks[0]!.items = [{ ...createClip(asset), id: 'clip' }];
  return p;
};
afterEach(() => useProjectStore.getState().close());
it('paused nearby editing updates the nearest selected anchor; explicit add can create 5ms neighbors', () => {
  const p = setup();
  addKeyframe(p, 'clip', 1);
  addKeyframe(p, 'clip', 1.005);
  editAnimatedValues(p, 'clip', 1.006, { scale: 2 }, false, 0.1);
  const { target } = animationTarget(p, 'clip');
  expect(target.keyframes).toHaveLength(2);
  expect(target.keyframes![0]!.values.scale).toBe(1);
  expect(target.keyframes![1]!.values.scale).toBe(2);
  expect(keyframeAt(target, 1.006, 0.1)?.time).toBe(1.005);
  toggleKeyframe(p, 'clip', 1.005);
  expect(target.keyframes).toHaveLength(1);
  toggleKeyframe(p, 'clip', 1.01);
  expect(target.keyframes).toHaveLength(2);
});
it('four short motions are identity at boundaries, nonzero inside, and survive source slicing', () => {
  for (const m of LOCAL_MOTIONS) {
    const p = setup();
    addKeyframe(p, 'clip', 1);
    const { target } = animationTarget(p, 'clip');
    target.keyframes![0]!.motion = { kind: m.kind, duration: 1, strength: 1 };
    const initial = animationValues(target, 1),
      mid = animationValues(target, 1.3),
      end = animationValues(target, 2);
    expect(initial).toEqual(end);
    expect(mid).not.toEqual(initial);
    const cut = { ...target, keyframes: trimKeyframes(target, 1.2, 2.2) };
    const sliced = animationValues(cut, 0.1),
      original = animationValues(target, 1.3);
    for (const key of ['x', 'y', 'scale', 'rotation'] as const)
      expect(sliced[key]).toBeCloseTo(original[key], 12);
  }
});
it('split ABC, delete B, move C then edit A/C transition preserves C source clock and total duration', () => {
  useProjectStore.getState().load(setup());
  const b = splitAny('clip', 4)!;
  const c = splitAny(b, 8)!;
  removeAnyItem(b);
  placeItem(c, 4);
  const before = structuredClone(useProjectStore.getState().project!);
  useProjectStore.getState().apply((d) => {
    d.transitions = [
      {
        id: 'join',
        fromId: 'clip',
        toId: c,
        preset: 'crossfade',
        duration: 3,
        ranges: [[2.5, 5.5]],
        anchor: 4,
      },
    ];
  });
  let p = useProjectStore.getState().project!;
  const [a, last] = p.tracks[0]!.items as VideoItem[];
  expect(last!.id).toBe(c);
  expect(last!.trimIn).toBe(8);
  expect(last!.duration).toBe(4);
  expect(p.tracks[0]!.items).toEqual(before.tracks[0]!.items);
  expect(transitionRanges(p.transitions![0]!, a!, last!)).toEqual([[2.5, 5.5]]);
  useProjectStore.getState().apply((d) => {
    d.transitions![0]!.ranges = [[3, 6]];
    d.transitions![0]!.duration = 3;
  });
  p = useProjectStore.getState().project!;
  expect(p.tracks[0]!.items).toEqual(before.tracks[0]!.items);
  expect(sourceTimeAt(last!, 4)).toBe(8);
  expect(sourceTimeAt(last!, 5.5)).toBe(9.5);
  expect(p.tracks[0]!.items.some((i) => i.id === b)).toBe(false);
});

it('real text placeholders do not become export text; renamed media and detached audio labels follow instance names', () => {
  const p = setup(),
    t = createTextItem(0);
  expect(t.card.runs[0]!.text).toBe('');
  expect(t.card.placeholder).toBe(true);
  expect(itemName(p, t)).toBe('文字');
  t.name = '字幕名稱';
  expect(itemName(p, t)).toBe('字幕名稱');
  const video = p.tracks[0]!.items[0] as VideoItem;
  video.name = '晚餐';
  const audio: VideoItem = { ...video, id: 'audio', type: 'audio', name: undefined, sourceItemId: video.id };
  p.tracks[0]!.items.push(audio);
  expect(itemName(p, audio)).toBe('晚餐');
  video.name = '演唱會';
  expect(itemName(p, audio)).toBe('演唱會');
  audio.name = '現場原音';
  expect(itemName(p, audio)).toBe('現場原音');
});
