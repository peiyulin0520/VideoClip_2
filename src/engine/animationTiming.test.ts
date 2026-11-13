import { describe, expect, it } from 'vitest';
import { createClip, createProject } from '../model/defaults';
import type { Asset, VideoItem } from '../model/types';
import {
  activeAnimation,
  animationRanges,
  effectAtTime,
  transitionRanges,
  resizeTimeRange,
} from './animationTiming';
import { activeTransitions, renderLayers, transitionSingle } from './transitions';
import { sourceTimeAt, totalDuration } from './timeline';
import { audibleClips } from './audio';
import { applyVideoEffects } from './videoEffects';
import type { SceneLayer } from './compositor';
const asset: Asset = {
  id: 'asset',
  name: 'moving',
  kind: 'video',
  mime: 'video/webm',
  width: 100,
  height: 100,
  duration: 10,
  size: 1,
  hasAudio: true,
  thumbs: [],
};
const layer: SceneLayer = {
  id: 'A',
  kind: 'video',
  source: {} as HTMLCanvasElement,
  srcW: 100,
  srcH: 100,
  ready: true,
  box: { cx: 50, cy: 50, w: 100, h: 100, rotation: 0 },
  opacity: 1,
  blend: 'normal',
  cornerRadius: 0,
};
function fixture() {
  const p = createProject('timing');
  p.freeMain = true;
  p.flexibleLayers = true;
  p.assets = [asset];
  const a = { ...createClip(asset), id: 'A', start: 0, duration: 10 },
    b = { ...createClip(asset), id: 'B', start: 10, duration: 10 };
  p.tracks[0]!.items = [a, b];
  return { p, a, b };
}
describe('effect windows use native clip time', () => {
  it('three seconds of effect consume three of a ten-second clip, with no half-length clamp', () => {
    const { a } = fixture();
    const animation = { preset: 'crossfade' as const, duration: 8 };
    expect(animationRanges(animation, 'enter', 10)).toEqual([[0, 8]]);
    expect(activeAnimation(animation, 'enter', 10, 6)?.progress).toBe(0.75);
    a.animations = { enter: { preset: 'crossfade', duration: 3, ranges: [[4, 7]] } };
    expect(activeAnimation(a.animations.enter, 'enter', 10, 3)).toBeNull();
    expect(activeAnimation(a.animations.enter, 'enter', 10, 5)?.progress).toBeCloseTo(1 / 3);
    expect(sourceTimeAt(a, 5)).toBe(5);
    expect(sourceTimeAt(a, 6)).toBe(6);
    expect(a.duration).toBe(10);
  });
  it('supports separate arbitrary windows, empty lists and legacy opening/ending defaults', () => {
    const animation = {
      preset: 'push-left' as const,
      duration: 3,
      ranges: [
        [1, 2],
        [5, 8],
      ] as [number, number][],
    };
    expect(activeAnimation(animation, 'exit', 10, 6)?.progress).toBeCloseTo(1 / 3);
    expect(activeAnimation(animation, 'exit', 10, 4)).toBeNull();
    expect(animationRanges({ ...animation, ranges: [] }, 'enter', 10)).toEqual([]);
    expect(animationRanges({ preset: 'crossfade', duration: 3 }, 'exit', 10)).toEqual([[7, 10]]);
  });
  it('duration edits keep endings anchored and distribute A/B around their join', () => {
    expect(resizeTimeRange([9.4, 10], 3, 0, 10)).toEqual([7, 10]);
    expect(resizeTimeRange([9.7, 10.3], 3, 0, 20, 10)).toEqual([8.5, 11.5]);
    expect(resizeTimeRange([4, 7], 20, 3, 9)).toEqual([4, 9]);
  });
  it('incoming B and outgoing A move in the preset direction instead of reversing the same path', () => {
    expect(transitionSingle(layer, 'push-left', 0.5, 'enter', 100, 100, 'tr')[0]!.box.cx).toBe(100);
    expect(transitionSingle(layer, 'push-left', 0.5, 'exit', 100, 100, 'tr')[0]!.box.cx).toBe(0);
    expect(transitionSingle(layer, 'wipe-right', 0.5, 'exit', 100, 100, 'tr')[0]!.viewport).toEqual({
      x: 50,
      y: 0,
      w: 50,
      h: 100,
    });
  });
  it('A tail and B head share a three-second window but retain twenty seconds and advancing sound/picture', () => {
    const { p, a, b } = fixture();
    const tr = { id: 'tr', preset: 'crossfade' as const, fromId: 'A', toId: 'B', duration: 3 };
    p.transitions = [tr];
    expect(transitionRanges(tr, a, b)).toEqual([[8.5, 11.5]]);
    expect(totalDuration(p)).toBe(20);
    for (const t of [8.75, 9.25, 10.25, 10.75]) {
      const target = t < 10 ? a : b;
      expect(renderLayers(p, t).map((l) => l.item.id)).toEqual([target.id]);
      expect(audibleClips(p, t).map((l) => l.item.id)).toEqual([target.id]);
      expect(sourceTimeAt(target, t)).toBeCloseTo(t - target.start);
      expect(activeTransitions(p, t)).toHaveLength(1);
    }
    tr.duration = 5;
    expect(totalDuration(p)).toBe(20);
    expect([a.start, b.start]).toEqual([0, 10]);
  });
  it('asymmetric A start/B end anchors persist without moving clips or changing speed', () => {
    const { p, a, b } = fixture();
    p.transitions = [
      { id: 'tr', preset: 'push-left', fromId: 'A', toId: 'B', duration: 3, ranges: [[8, 11]] },
    ];
    expect(activeTransitions(p, 7)).toEqual([]);
    expect(activeTransitions(p, 8.5)[0]!.range).toEqual([8, 11]);
    expect(sourceTimeAt(b, 10.5)).toBe(0.5);
    expect(totalDuration(p)).toBe(20);
    expect((a as VideoItem).speed).toBe(1);
  });
  it('explicit join anchors follow moved clips instead of staying at an unrelated project second', () => {
    const { a, b } = fixture();
    const tr = {
      id: 'tr',
      preset: 'crossfade' as const,
      fromId: 'A',
      toId: 'B',
      duration: 3,
      ranges: [[8, 11]] as [number, number][],
      anchor: 10,
    };
    a.start = 5;
    b.start = 15;
    expect(transitionRanges(tr, a, b)).toEqual([[13, 16]]);
  });
  it('screen and video effects honor all windows including removal, rather than a stale legacy start', () => {
    const effect = {
      id: 'fx',
      preset: 'mono' as const,
      start: 0,
      duration: 1,
      strength: 1,
      ranges: [
        [2, 3],
        [6, 8],
      ] as [number, number][],
    };
    expect(effectAtTime(effect, 0.5)).toBeNull();
    expect(effectAtTime(effect, 7)).toMatchObject({ start: 6, duration: 2 });
    const { p } = fixture();
    p.effects = [effect];
    expect(applyVideoEffects([layer], p, 7, 100, 100)[0]!.adjustment?.saturation).toBe(0);
    expect(applyVideoEffects([layer], p, 5, 100, 100)[0]).toBe(layer);
    p.effects[0]!.ranges = [];
    expect(effectAtTime(p.effects[0]!, 7)).toBeNull();
  });
});
