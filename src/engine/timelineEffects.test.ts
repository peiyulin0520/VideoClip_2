import { expect, it } from 'vitest';
import { createClip, createProject } from '../model/defaults';
import type { Asset } from '../model/types';
import { timelineEffectBadges, effectSymbol, groupTimelineEffectBadges } from './timelineEffects';
import { collagePlan } from './layouts';
const asset: Asset = {
  id: 'media',
  name: 'clip',
  kind: 'video',
  width: 100,
  height: 100,
  duration: 10,
  size: 1,
  mime: 'video/webm',
  hasAudio: true,
  thumbs: [],
};
function fixture() {
  const p = createProject('badges');
  p.assets = [asset];
  p.freeMain = true;
  p.flexibleLayers = true;
  p.tracks[0]!.items = [
    { ...createClip(asset), id: 'A', duration: 10, start: 2 },
    { ...createClip(asset), id: 'B', duration: 10, start: 12 },
  ];
  return p;
}
it('uses the join time for all mixed pair symbols, but the actual start for single entry/exit', () => {
  const p = fixture(),
    a = p.tracks[0]!.items[0]!;
  a.animations = { enter: { preset: 'crossfade', duration: 3 }, exit: { preset: 'push-left', duration: 2 } };
  p.transitions = [{ id: 'tr', fromId: 'A', toId: 'B', preset: 'crossfade', duration: 3 }];
  p.effects = [
    {
      id: 'fx',
      preset: 'flash',
      start: 10,
      duration: 3,
      strength: 1,
      transitionFromId: 'A',
      transitionToId: 'B',
    },
  ];
  const badges = timelineEffectBadges(p);
  expect(badges.map((x) => [x.kind, x.time, x.symbols])).toEqual([
    ['single', 2, ['淡']],
    ['single', 10, ['推']],
    ['pair', 12, ['淡', '閃']],
  ]);
  expect(a.start).toBe(2);
  expect(p.tracks[0]!.items[1]!.start).toBe(12);
});
it('gives a whole template only one badge and follows its moved interval', () => {
  const p = fixture(),
    group = collagePlan(p, ['media', 'media', 'media'], 'photobooth', 'none', 4, 6).tracks[0]!;
  group.layout!.animations = { exit: { preset: 'spin', duration: 2 } };
  p.tracks.push(group);
  const badge = timelineEffectBadges(p).filter((x) => x.trackId === group.id);
  expect(badge).toHaveLength(1);
  expect(badge[0]).toMatchObject({ time: 8, kind: 'single', edge: 'exit', symbols: ['轉'] });
});
it('omits disabled effects and labels non-pair effects at each actual interval start', () => {
  const p = fixture();
  p.tracks[0]!.items[0]!.animations = { enter: { preset: 'crossfade', duration: 2, ranges: [] } };
  p.effects = [
    {
      id: 'fx',
      preset: 'snow',
      start: 3,
      duration: 1,
      strength: 1,
      ranges: [
        [3, 4],
        [7, 8],
      ],
      targetId: 'A',
    },
  ];
  expect(timelineEffectBadges(p).map((x) => [x.kind, x.time])).toEqual([
    ['single', 3],
    ['single', 7],
  ]);
  expect(effectSymbol('wipe-left')).toBe('擦');
});

it('groups a clip entry with a pair effect at the same anchor without moving either time', () => {
  const p = fixture();
  p.tracks[0]!.items[1]!.animations = { enter: { preset: 'spin', duration: 2 } };
  p.transitions = [{ id: 'tr', fromId: 'A', toId: 'B', preset: 'crossfade', duration: 3 }];
  const groups = groupTimelineEffectBadges(timelineEffectBadges(p));
  expect(groups).toHaveLength(1);
  expect(groups[0]!.map((b) => b.kind)).toEqual(['pair', 'single']);
  expect(groups[0]!.every((b) => b.time === 12)).toBe(true);
});
