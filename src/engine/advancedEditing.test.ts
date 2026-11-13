import { useProjectStore } from '../store/projectStore';
import { useUI } from '../store/uiStore';
import { setTransform } from '../store/actions';
import type { Player } from './player';
import { describe, expect, it } from 'vitest';
import type { Asset, Project, VideoItem } from '../model/types';
import { createClip, createProject, createTextItem, createTrack } from '../model/defaults';
import { addSourceSelection } from './sourceSelections';
import { cellMediaTime, mediaSegments } from './templateTiming';
import { audibleClips } from './audio';
import { audioBoundaries } from './audioRanges';
import { visibleLayers, splitFree } from './timeline';
import { deleteSelectedTracks, mergeSelectedTracks, shiftSelectedTracks } from './batchLayers';
import {
  addKeyframe,
  animationValues,
  animationTarget,
  editAnimatedValues,
  trimKeyframes,
} from './keyframes';
import { collagePlan } from './layouts';
import { groupFrame, cellViewport } from './templateGeometry';
import { applyTransitions, renderLayers, transitionPairs } from './transitions';
import { applyVideoEffects } from './videoEffects';
import type { SceneLayer } from './compositor';
const asset = (id: string, origin?: Asset['origin']): Asset => ({
  id,
  name: id,
  origin,
  kind: 'video',
  mime: 'video/webm',
  size: 1,
  duration: 4,
  width: 160,
  height: 96,
  hasAudio: true,
  thumbs: [],
});
function project(): Project {
  const p = createProject('edit');
  p.freeMain = true;
  p.flexibleLayers = true;
  p.assets = [asset('a'), asset('b'), asset('s', 'giphy')];
  p.tracks[0]!.items = [
    { ...createClip(p.assets[0]!), id: 'a', start: 0, duration: 4 },
    { ...createClip(p.assets[1]!), id: 'b', start: 4, duration: 4 },
  ];
  return p;
}
function scene(id: string): SceneLayer {
  return {
    id,
    kind: 'video',
    source: {} as HTMLCanvasElement,
    ready: true,
    srcW: 160,
    srcH: 96,
    box: { cx: 80, cy: 48, w: 160, h: 96, rotation: 0 },
    opacity: 1,
    blend: 'normal',
    cornerRadius: 0,
  };
}
describe('multiple source selections keep timeline and original source intact', () => {
  it('adds a second explicit pair without changing the existing pair', () => {
    const original: [number, number][] = [[0, 0.5]];
    expect(addSourceSelection(original, 1, 3)).toEqual([
      [0, 0.5],
      [1, 1.5],
    ]);
    expect(original).toEqual([[0, 0.5]]);
    expect(() => addSourceSelection(original, 0.2, 3)).toThrow();
  });
  it('clamps a new pair to the next selected start and rejects insufficient space', () => {
    expect(addSourceSelection([[2, 3]], 1.8, 4, 0.2)).toEqual([
      [1.8, 2],
      [2, 3],
    ]);
    expect(() => addSourceSelection([[2, 3]], 1.9, 4, 0.2)).toThrow();
  });
  it('unselected middle picture and its sound disappear without shortening the clip', () => {
    const p = project(),
      it = p.tracks[0]!.items[0] as VideoItem;
    it.sourceRanges = [
      [0, 0.5],
      [2, 3],
    ];
    expect(visibleLayers(p, 1)).toEqual([]);
    expect(audibleClips(p, 1)).toEqual([]);
    expect(cellMediaTime(it, 2.4)).toBe(2.4);
    expect(visibleLayers(p, 2.4)).toHaveLength(1);
    expect(it.duration).toBe(4);
    expect(mediaSegments(it)).toEqual([
      { start: 0, end: 0.5, sourceStart: 0 },
      { start: 2, end: 3, sourceStart: 2 },
    ]);
  });
  it('source selections intersect template pauses and speed instead of concatenating time', () => {
    const it = {
      ...createClip(asset('a')),
      start: 5,
      duration: 4,
      speed: 2,
      sourceRanges: [
        [1, 2],
        [3, 4],
      ] as [number, number][],
      cell: {
        sourceEnd: 4,
        offset: 0,
        blanks: [[0.5, 1.5]] as [number, number][],
        background: '#000000' as const,
      },
    };
    expect(mediaSegments(it)).toEqual([
      { start: 6.5, end: 7, sourceStart: 1 },
      { start: 7.5, end: 8, sourceStart: 3 },
    ]);
    expect(cellMediaTime(it, 6)).toBeNull();
    expect(cellMediaTime(it, 7.75)).toBe(3.5);
    expect(audioBoundaries(it)).toContain(7.5);
  });
});
describe('batch layer operations', () => {
  it('keeps selection relative order when moving a discontiguous set both ways', () => {
    const p = project();
    p.tracks = [0, 1, 2, 3, 4].map((i) => ({ ...createTrack('overlay', []), id: String(i) }));
    shiftSelectedTracks(p, ['1', '3'], 1);
    expect(p.tracks.map((t) => t.id)).toEqual(['0', '2', '1', '4', '3']);
    shiftSelectedTracks(p, ['1', '3'], -1);
    expect(p.tracks.map((t) => t.id)).toEqual(['0', '1', '2', '3', '4']);
  });
  it('merges same-type nonoverlapping clips without changing IDs, source or timing', () => {
    const p = project();
    p.tracks.push({ ...createTrack('overlay', p.tracks), items: [p.tracks[0]!.items.pop()!] });
    const before = p.tracks.flatMap((t) => t.items).map((it) => ({ ...it }));
    mergeSelectedTracks(
      p,
      p.tracks.map((t) => t.id),
    );
    expect(p.tracks).toHaveLength(1);
    expect(p.tracks[0]!.items).toEqual(before);
  });
  it('rejects overlap before mutation, but offers explicit sequential packing', () => {
    const p = project();
    const it = { ...p.tracks[0]!.items[1]!, start: 1 };
    p.tracks[0]!.items.pop();
    p.tracks.push({ ...createTrack('overlay', p.tracks), items: [it] });
    const ids = p.tracks.map((t) => t.id),
      before = structuredClone(p);
    expect(() => mergeSelectedTracks(p, ids)).toThrow('重疊');
    expect(p).toEqual(before);
    mergeSelectedTracks(p, ids, true);
    expect(p.tracks[0]!.items.map((i) => i.start)).toEqual([0, 4]);
  });
  it('rejects mixed sticker, picture, text and audio lanes', () => {
    const p = project();
    p.tracks.push({
      ...createTrack('overlay', p.tracks),
      items: [{ ...createClip(p.assets[2]!), start: 8 }],
    });
    expect(() =>
      mergeSelectedTracks(
        p,
        p.tracks.map((t) => t.id),
      ),
    ).toThrow('同類型');
    p.tracks[1] = { ...createTrack('text', p.tracks), items: [createTextItem(8)] };
    expect(() =>
      mergeSelectedTracks(
        p,
        p.tracks.map((t) => t.id),
      ),
    ).toThrow('同類型');
  });
  it('locked operations reject atomically; deleting every layer restores an empty import lane', () => {
    const p = project();
    p.tracks[0]!.locked = true;
    expect(() => deleteSelectedTracks(p, [p.tracks[0]!.id])).toThrow('解鎖');
    p.tracks[0]!.locked = false;
    deleteSelectedTracks(p, [p.tracks[0]!.id]);
    expect(p.tracks).toHaveLength(1);
    expect(p.tracks[0]!.kind).toBe('main');
    expect(p.tracks[0]!.items).toEqual([]);
  });
});
describe('linear keyframes', () => {
  it('transform editing and reset write only the current diamond and remain undoable', () => {
    const p = project();
    addKeyframe(p, 'a', 0);
    editAnimatedValues(p, 'a', 2, { x: 0.75, scale: 0.5 }, true);
    useProjectStore.getState().load(p);
    useUI.setState({ player: { time: 2, pause: () => {} } as unknown as Player });
    try {
      setTransform('a', { x: 0.5, y: 0.5, scale: 1, rotation: 0 });
      const target = useProjectStore.getState().project!.tracks[0]!.items[0]!;
      expect(target.keyframes).toHaveLength(2);
      expect(target.keyframes![0]!.values.scale).toBe(1);
      expect(target.keyframes![1]!.values.scale).toBe(1);
      expect(useProjectStore.getState().undo()).toBe(true);
      expect(useProjectStore.getState().project!.tracks[0]!.items[0]!.keyframes![1]!.values.scale).toBe(0.5);
    } finally {
      useUI.setState({ player: null });
      useProjectStore.getState().close();
    }
  });

  it('interpolates transform, opacity, brightness and actual RGB at the midpoint', () => {
    const p = project();
    addKeyframe(p, 'a', 0);
    editAnimatedValues(p, 'a', 2, { x: 0.75, scale: 0.5, brightness: 0.5, tint: '#0000ff' }, true);
    const v = animationValues(animationTarget(p, 'a').target, 1);
    expect(v.x).toBe(0.625);
    expect(v.scale).toBe(0.75);
    expect(v.brightness).toBe(0.75);
    expect(v.tint).toBe('#8080ff');
    expect(animationValues(animationTarget(p, 'a').target, 3).scale).toBe(0.5);
  });
  it('updates an existing diamond instead of making duplicates and rejects out-of-clip insertion', () => {
    const p = project();
    addKeyframe(p, 'a', 0);
    addKeyframe(p, 'a', 0.005);
    expect(p.tracks[0]!.items[0]!.keyframes).toHaveLength(1);
    expect(() => addKeyframe(p, 'a', 8)).toThrow('時間範圍');
  });
  it('splitting preserves the curve on either side using sampled boundary keys', () => {
    const p = project();
    addKeyframe(p, 'a', 0);
    editAnimatedValues(p, 'a', 4, { x: 1, scale: 0.5 }, true);
    const it = p.tracks[0]!.items[0]!,
      split = splitFree([it], it.id, 2)!;
    expect(animationValues(split[0]!, 2).x).toBe(0.75);
    expect(animationValues(split[1]!, 0).x).toBe(0.75);
    expect(animationValues(split[1]!, 1).x).toBe(0.875);
    expect(trimKeyframes(it, 1, 3)![0]!.values.x).toBe(0.625);
  });
  it('a template keyframe transforms the frame and every cell without modifying individual positions', () => {
    const p = project(),
      plan = collagePlan(p, ['a', 'b', 'a'], 'filmstrip', 'none', 0, 4);
    p.tracks.push(...plan.tracks);
    p.layout = plan.layout;
    const tr = p.tracks[1]!,
      before = structuredClone(tr.items.map((it) => it.transform));
    addKeyframe(p, tr.items[0]!.id, 0);
    editAnimatedValues(p, tr.items[0]!.id, 2, { x: 0.7, scale: 0.5 }, true);
    const frame = groupFrame(tr, 160, 96, 1),
      slot = cellViewport(tr, tr.items[0] as VideoItem, 0, 1)!;
    expect(frame.cx).toBe(96);
    expect(frame.w).toBe(120);
    expect(slot.w).toBeCloseTo(0.76 * 0.75);
    expect(tr.items.map((it) => it.transform)).toEqual(before);
  });
});
describe('actual A/B transitions and video effects', () => {
  it('decodes both sides of the join and exposes only real adjacent pairs', () => {
    const p = project();
    p.transitions = [{ id: 'tr', preset: 'crossfade', fromId: 'a', toId: 'b', duration: 1 }];
    expect(transitionPairs(p)).toHaveLength(1);
    expect(renderLayers(p, 3.75).map((l) => l.item.id)).toEqual(['a', 'b']);
    expect(renderLayers(p, 4.25).map((l) => l.item.id)).toEqual(['a', 'b']);
    expect(audibleClips(p, 3.75).map((l) => l.item.id)).toEqual(['a']);
    p.tracks[0]!.items[1]!.start = 5;
    expect(transitionPairs(p)).toEqual([]);
    expect(renderLayers(p, 3.75).map((l) => l.item.id)).toEqual(['a']);
  });
  it('push transforms A and B in opposite on-screen halves while preserving their source', () => {
    const p = project();
    p.transitions = [{ id: 'tr', preset: 'push-left', fromId: 'a', toId: 'b', duration: 1 }];
    const [a, b] = applyTransitions([scene('a'), scene('b')], p, 4, 160, 96);
    expect(a!.box.cx).toBe(0);
    expect(b!.box.cx).toBe(160);
    expect(a!.box.w).toBe(160);
  });
  it('wipe and grid reveal different portions of B instead of just tinting the cut', () => {
    const p = project();
    p.transitions = [{ id: 'tr', preset: 'wipe-right', fromId: 'a', toId: 'b', duration: 1 }];
    expect(applyTransitions([scene('a'), scene('b')], p, 4, 160, 96)[1]!.viewport).toEqual({
      x: 0,
      y: 0,
      w: 80,
      h: 96,
    });
    p.transitions[0]!.preset = 'grid9';
    const grid = applyTransitions([scene('a'), scene('b')], p, 4, 160, 96);
    expect(grid).toHaveLength(11);
    expect(grid[1]!.opacity).toBe(0);
    expect(grid[2]!.viewport!.w).toBeCloseTo(160 / 6);
  });
  it('removing a transition leaves the original scene untouched', () => {
    const p = project(),
      layers = [scene('a')];
    expect(applyTransitions(layers, p, 4, 160, 96)).toBe(layers);
  });
  it('video monochrome and shake affect evaluated geometry/color only within the effect interval', () => {
    const p = project(),
      layer = scene('a');
    p.effects = [{ id: 'fx', preset: 'mono', start: 1, duration: 1, strength: 1 }];
    expect(applyVideoEffects([layer], p, 1.5, 160, 96)[0]!.adjustment!.saturation).toBe(0);
    expect(applyVideoEffects([layer], p, 0, 160, 96)[0]).toBe(layer);
    p.effects[0]!.preset = 'shake';
    expect(applyVideoEffects([layer], p, 1.5, 160, 96)[0]!.box).not.toEqual(layer.box);
    expect(layer.box.cx).toBe(80);
  });
});
