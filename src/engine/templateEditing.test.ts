import { expect, it } from 'vitest';
import { createProject } from '../model/defaults';
import type { Asset, VideoItem } from '../model/types';
import { collagePlan, carryTemplateEdits } from './layouts';
import { arrangeTemplate, moveTemplateChild, updateTemplateChild } from './templatePlayback';
import { cellMediaTime, mediaSegments, templateCardAt } from './templateTiming';
import { sourceTimeAt, visibleLayers, totalDuration } from './timeline';
import { audibleClips } from './audio';
const setup = () => {
  const p = createProject('templates');
  p.assets = Array.from({ length: 3 }, (_, i): Asset => ({
    id: `a${i}`,
    name: `source ${i}`,
    kind: 'video',
    mime: 'video/webm',
    size: 1,
    duration: 10,
    width: 160,
    height: 96,
    hasAudio: true,
    thumbs: [],
  }));
  const plan = collagePlan(
    p,
    p.assets.map((a) => a.id),
    'photobooth',
    'none',
    0,
    3,
  );
  p.tracks.push(...plan.tracks);
  p.layout = plan.layout;
  return { p, track: p.tracks[1]! };
};
it('sequential children preserve independent source trims; completed cells hold their last source without sound', () => {
  const { p, track } = setup();
  (track.items[0] as VideoItem).trimIn = 2;
  arrangeTemplate(track, 'sequential');
  expect(track.items.map((i) => i.start)).toEqual([0, 3, 6]);
  expect(totalDuration(p)).toBe(9);
  expect(visibleLayers(p, 7).filter((l) => l.track.template)).toHaveLength(3);
  const first = track.items[0] as VideoItem;
  expect(sourceTimeAt(first, 7)).toBeCloseTo(4.999);
  expect(audibleClips(p, 7).map((c) => c.item.id)).toEqual([track.items[2]!.id]);
  expect(audibleClips(p, 4).map((c) => c.item.id)).toEqual([track.items[1]!.id]);
  arrangeTemplate(track, 'simultaneous');
  expect(track.items.map((i) => i.start)).toEqual([0, 0, 0]);
  expect(totalDuration(p)).toBe(3);
  expect(track.items.map((i) => (i.type !== 'text' ? i.audioEnabled : undefined))).toEqual([
    true,
    false,
    false,
  ]);
});
it('changing a child duration reflows sequence and reordering preserves its physical slot and source', () => {
  const { p, track } = setup();
  arrangeTemplate(track, 'sequential');
  const child = structuredClone(track.items[1]) as VideoItem;
  child.name = '第二格';
  child.trimIn = 5;
  child.duration = 2;
  updateTemplateChild(p, child.id, child);
  expect(track.items.map((i) => i.start)).toEqual([0, 3, 5]);
  expect(track.layout!.duration).toBe(8);
  const slot = structuredClone(child.slot);
  moveTemplateChild(p, track.id, child.id, -1);
  expect(track.items[0]!.id).toBe(child.id);
  expect((track.items[0] as VideoItem).slot).toEqual(slot);
  expect((track.items[0] as VideoItem).trimIn).toBe(5);
  expect(track.items.map((i) => i.start)).toEqual([0, 2, 5]);
});
it('local colour/text blanks pause source consumption, silence only that child and retain custom colour/labels', () => {
  const { p, track } = setup(),
    item = track.items[0] as VideoItem;
  item.cell!.cards = [{ start: 1, end: 2, color: '#42a5f5', text: '當下的回憶' }];
  expect(cellMediaTime(item, 1.5)).toBeNull();
  expect(templateCardAt(item, 1.5)).toMatchObject({ color: '#42a5f5', text: '當下的回憶' });
  expect(cellMediaTime(item, 2.5)).toBeCloseTo(1.5);
  expect(audibleClips(p, 1.5)).toHaveLength(0);
  expect(mediaSegments(item).map((s) => [s.start, s.end])).toEqual([
    [0, 1],
    [2, 3],
  ]);
});
it('short 2.87s cell fits 3s with calculated speed; independent groups retain edits', () => {
  const { p, track } = setup(),
    item = track.items[1] as VideoItem;
  item.cell!.sourceEnd = 2.87;
  item.speed = 2.87 / 3;
  expect(cellMediaTime(item, 2.99)).toBeCloseTo(2.8604333);
  const second = collagePlan(
    p,
    p.assets.map((a) => a.id),
    'filmstrip',
    'none',
    5,
    2,
  );
  p.tracks.push(...second.tracks);
  updateTemplateChild(p, item.id, { ...item, name: '我的片段' });
  expect(p.tracks.filter((t) => t.template)).toHaveLength(2);
  expect(p.tracks[2]!.layout!.start).toBe(5);
  expect(track.items[1]!.name).toBe('我的片段');
});

it('reapplying a template preserves group/child identity, individual ranges, durations and sequential mode', () => {
  const { p, track } = setup();
  track.name = '我的模板';
  arrangeTemplate(track, 'sequential');
  const child = track.items[1] as VideoItem;
  child.duration = 1.5;
  child.name = '中間';
  child.trimIn = 5;
  child.cell!.sourceEnd = 6.5;
  arrangeTemplate(track);
  const replacement = collagePlan(
    p,
    p.assets.map((a) => a.id),
    'photobooth',
    'none',
    0,
    3,
  ).tracks[0]!;
  carryTemplateEdits(replacement, track, true);
  expect(replacement.id).toBe(track.id);
  expect(replacement.name).toBe('我的模板');
  expect(replacement.layout!.playback).toBe('sequential');
  expect(replacement.items.map((i) => i.id)).toEqual(track.items.map((i) => i.id));
  expect(replacement.items.map((i) => i.duration)).toEqual([3, 1.5, 3]);
  expect((replacement.items[1] as VideoItem).trimIn).toBe(5);
});
