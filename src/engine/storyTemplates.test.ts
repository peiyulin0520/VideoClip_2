import { describe, expect, it } from 'vitest';
import type { Asset, VideoItem } from '../model/types';
import { createProject } from '../model/defaults';
import { collagePlan, carryTemplateEdits } from './layouts';
import { cellMediaTime, mediaSegments, sliceCell } from './templateTiming';
import { cellViewport, groupFrame } from './templateGeometry';
import { audibleClips } from './audio';
import { audioBoundaries, excludeAudio, includeAudio, inverseRanges } from './audioRanges';
import { geoCtx } from './scene';
import { hitLayers, itemBox } from './geometry';
import { trimSourceRange, setTimelineItems } from './groupTiming';
import { sourceTimeAt, totalDuration, visibleLayers } from './timeline';
import { useProjectStore } from '../store/projectStore';
import { setTransform, splitAny } from '../store/actions';
const asset = (id: string, duration = 4): Asset => ({
  id,
  kind: 'video',
  name: id,
  mime: 'video/webm',
  size: 1,
  duration,
  width: 160,
  height: 284,
  hasAudio: true,
  thumbs: [],
});
function group(style: 'filmstrip' | 'story' = 'filmstrip') {
  const p = createProject('group');
  p.flexibleLayers = true;
  p.freeMain = true;
  p.assets = [asset('a', 1), asset('b', 3), asset('c', 4)];
  const plan = collagePlan(p, ['a', 'b', 'c'], style, 'none', 0, 4);
  p.tracks.push(...plan.tracks);
  p.layout = plan.layout;
  return p;
}
describe('group template geometry and source timing', () => {
  it('short cells keep common duration and become solid after source ends', () => {
    const p = group(),
      tr = p.tracks[1]!,
      it = tr.items[0] as VideoItem;
    expect(tr.items.map((i) => i.duration)).toEqual([4, 4, 4]);
    expect(cellMediaTime(it, 0.5)).toBe(0.5);
    expect(cellMediaTime(it, 1.1)).toBeNull();
    expect(audibleClips(p, 1.1)).toEqual([]);
  });
  it('gaps pause source consumption and resume without freezing or consuming hidden voice', () => {
    const p = group(),
      it = p.tracks[1]!.items[2] as VideoItem;
    it.cell!.offset = 0.5;
    it.cell!.blanks = [[1, 2]];
    expect(cellMediaTime(it, 0.3)).toBeNull();
    expect(cellMediaTime(it, 0.8)).toBeCloseTo(0.3);
    expect(cellMediaTime(it, 1.3)).toBeNull();
    expect(cellMediaTime(it, 2.5)).toBe(1);
    expect(sourceTimeAt(it, 2.5)).toBe(1);
    expect(mediaSegments(it)).toEqual([
      { start: 0.5, end: 1, sourceStart: 0 },
      { start: 2, end: 4, sourceStart: 0.5 },
    ]);
  });
  it('each source range can change without retiming other cells or frame', () => {
    const p = group(),
      tr = p.tracks[1]!,
      it = tr.items[1] as VideoItem;
    trimSourceRange(p, it.id, 0.5, 1.5);
    expect(it).toMatchObject({ start: 0, duration: 4, trimIn: 0.5, cell: { sourceEnd: 1.5 } });
    expect(tr.items[0]!.start).toBe(0);
    expect(tr.layout!.duration).toBe(4);
  });
  it('group scaling moves the frame, cell clips and hit geometry as one, not individual transforms', () => {
    const p = group(),
      tr = p.tracks[1]!,
      it = tr.items[1] as VideoItem;
    const before = structuredClone(it.transform);
    useProjectStore.getState().load(p);
    setTransform(it.id, { x: 0.6, y: 0.4, scale: 0.5 });
    const next = useProjectStore.getState().project!,
      g = next.tracks[1]!;
    expect(g.layout!.transform).toEqual({ x: 0.6, y: 0.4, scale: 0.5 });
    expect(g.items[1]!.transform).toEqual(before);
    const ctx = geoCtx(next, 1080, 1920, 1),
      frame = groupFrame(g, 1080, 1920, 1),
      slot = cellViewport(g, g.items[1] as VideoItem, 1, 1)!;
    expect(frame).toMatchObject({ cx: 648, cy: 768, w: 540, h: 960 });
    expect(itemBox(g.items[1]!, ctx)!.cx).toBeCloseTo((slot.x + slot.w / 2) * 1080);
    expect(hitLayers(visibleLayers(next, 1), ctx, frame.cx, frame.cy)[0]!.track.id).toBe(g.id);
  });
  it('left trimming/splitting retains source/gap alignment for every cell', () => {
    const p = group(),
      tr = p.tracks[1]!,
      it = tr.items[2] as VideoItem;
    it.cell!.blanks = [[0.5, 1.5]];
    const cut = sliceCell(it, 1);
    expect(cut.trimIn).toBe(0.5);
    expect(cut.cell!.offset).toBe(0.5);
    expect(cellMediaTime({ ...cut, start: 1, duration: 3 }, 2)).toBe(1);
    useProjectStore.getState().load(p);
    splitAny(it.id, 1);
    const now = useProjectStore.getState().project!;
    expect(now.tracks.filter((t) => t.template)).toHaveLength(2);
    expect(now.tracks[2]!.items.every((i) => i.start === 1 && i.duration === 3)).toBe(true);
  });
  it('group right extension is not clamped by shortest source', () => {
    const p = group(),
      tr = p.tracks[1]!;
    setTimelineItems(
      p,
      tr.id,
      tr.items.map((it, i) => (i === 0 ? { ...it, duration: 7 } : it)),
    );
    expect(tr.items.every((i) => i.duration === 7)).toBe(true);
    expect(tr.layout!.duration).toBe(7);
  });
  it('story opens a single source then fills cells top to bottom', () => {
    const p = group('story'),
      tr = p.tracks[1]!,
      first = tr.items[0] as VideoItem;
    expect(cellViewport(tr, first, 0, 0)!.h).toBeCloseTo(0.2);
    expect(cellViewport(tr, tr.items[1] as VideoItem, 1, 0)).toBeNull();
    expect(cellViewport(tr, first, 0, 0.7)!.h).toBeCloseTo(1);
    expect(cellViewport(tr, tr.items[2] as VideoItem, 2, 2)!.y).toBeCloseTo(2 / 3);
    expect(tr.layout!.story!.fontIds).toHaveLength(3);
  });
  it('audio boundary mapping follows inserted gaps and retained source regions', () => {
    const p = group(),
      it = p.tracks[1]!.items[1] as VideoItem;
    it.cell!.blanks = [[1, 2]];
    it.audioRanges = [[0.5, 1.5]];
    expect(audioBoundaries(it)).toEqual([0, 1, 0.5, 2, 4, 2.5]);
  });
  it('multiple exact mute pairs preserve both sides and can be restored independently', () => {
    let r: [number, number][] = [[0, 4]];
    r = excludeAudio(r, 1, 1.2);
    r = excludeAudio(r, 2, 2.4);
    expect(inverseRanges(r, 4)).toEqual([
      [1, 1.2],
      [2, 2.4],
    ]);
    expect(includeAudio(r, 1, 1.2)).toEqual([
      [0, 2],
      [2.4, 4],
    ]);
  });
  it('reapplying a template keeps edited cuts, gaps and whole-frame placement without mutating the old group', () => {
    const p = group(),
      old = p.tracks[1]!,
      first = old.items[0] as VideoItem;
    first.trimIn = 0.2;
    first.cell!.sourceEnd = 0.8;
    first.cell!.blanks = [[0.3, 0.6]];
    old.layout!.transform = { x: 0.4, y: 0.6, scale: 0.7 };
    const plan = collagePlan(p, ['a', 'b', 'c'], 'filmstrip', 'none', 0, 6);
    carryTemplateEdits(plan.tracks[0]!, old);
    const next = plan.tracks[0]!.items[0] as VideoItem;
    expect(next).toMatchObject({
      start: 0,
      duration: 6,
      trimIn: 0.2,
      cell: { sourceEnd: 0.8, blanks: [[0.3, 0.6]] },
    });
    expect(next.id).not.toBe(first.id);
    expect(first.duration).toBe(4);
    expect(plan.tracks[0]!.layout!.transform).toEqual(old.layout!.transform);
  });
  it('independent effects extend duration without moving or changing media', () => {
    const p = group();
    p.effects = [{ id: 'fx', preset: 'flash', start: 5, duration: 1, strength: 1 }];
    expect(totalDuration(p)).toBe(6);
    expect(p.tracks[1]!.items[0]!.duration).toBe(4);
  });
});
