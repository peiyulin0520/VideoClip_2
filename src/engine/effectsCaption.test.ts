import { afterEach, expect, it } from 'vitest';
import { createClip, createProject, createTrack } from '../model/defaults';
import type { Asset, Project } from '../model/types';
import { removeAnyItem, removeTrack, editText, duplicateAny, placeItem } from '../store/actions';
import { useProjectStore } from '../store/projectStore';
import { deleteSelectedTracks } from './batchLayers';
import { timelineEffectBadges } from './timelineEffects';
import { collagePlan, carryTemplateEdits } from './layouts';
import { findItem, visibleLayers } from './timeline';
import { animationTarget } from './keyframes';
import { arrangeTemplate } from './templatePlayback';
import { templateContexts } from './templateGeometry';
const asset = (id: string): Asset => ({
  id,
  name: id,
  kind: 'video',
  mime: 'video/webm',
  size: 1,
  duration: 10,
  width: 320,
  height: 568,
  hasAudio: true,
  thumbs: [],
});
const state = () => useProjectStore.getState();
afterEach(() => state().close());
function project() {
  const p = createProject('effects');
  p.assets = [asset('a'), asset('b')];
  p.tracks[0]!.items = p.assets.map((a) => createClip(a));
  p.tracks[0]!.items[1]!.start = 10;
  const [a, b] = p.tracks[0]!.items;
  p.effects = [
    { id: 'owned', preset: 'mono', start: 0, duration: 3, strength: 1, ownerId: a!.id },
    { id: 'legacy', preset: 'grain', start: 1, duration: 3, strength: 1 },
    {
      id: 'pair',
      preset: 'light-leak',
      start: 9.7,
      duration: 0.6,
      strength: 1,
      transitionFromId: a!.id,
      transitionToId: b!.id,
    },
    { id: 'keep', preset: 'mono', start: 11, duration: 2, strength: 1, ownerId: b!.id },
  ];
  p.transitions = [{ id: 'tr', fromId: a!.id, toId: b!.id, preset: 'crossfade', duration: 1 }];
  return p;
}
it('deleting a clip removes owned, legacy-at-time and pair effects in the same undo/redo transaction', () => {
  const p = project();
  state().load(p);
  removeAnyItem(p.tracks[0]!.items[0]!.id);
  expect(state().project!.effects!.map((e) => e.id)).toEqual(['keep']);
  expect(state().project!.transitions).toHaveLength(0);
  state().undo();
  expect(state().project!.effects).toHaveLength(4);
  expect(state().project!.transitions).toHaveLength(1);
  state().redo();
  expect(state().project!.effects!.map((e) => e.id)).toEqual(['keep']);
});
it('lane and batch deletions share the same cleanup and do not remove unrelated effects', () => {
  for (const batch of [false, true]) {
    const p = project(),
      other = createTrack('overlay', p.tracks);
    other.items = [p.tracks[0]!.items.pop()!];
    p.tracks.push(other);
    state().load(p);
    if (batch) state().apply((d) => deleteSelectedTracks(d, [p.tracks[0]!.id]));
    else removeTrack(p.tracks[0]!.id);
    expect(state().project!.effects!.map((e) => e.id)).toEqual(['keep']);
  }
});
it('orphan legacy effects still have a clickable timeline badge on the empty main lane', () => {
  const p = createProject('orphan');
  p.effects = [{ id: 'orphan', preset: 'flash', start: 4, duration: 1, strength: 1 }];
  expect(timelineEffectBadges(p)).toContainEqual(
    expect.objectContaining({ effectId: 'orphan', time: 4, trackId: p.tracks[0]!.id }),
  );
});
function template(): Project {
  const p = createProject('caption');
  p.assets = [asset('source')];
  const plan = collagePlan(p, ['source', 'source', 'source'], 'photobooth', 'none', 1, 4);
  p.tracks.push(...plan.tracks);
  p.layout = plan.layout;
  return p;
}
it('caption is selectable editable text, independent of media count and sequential duration', () => {
  const p = template();
  state().load(p);
  const group = state().project!.tracks[1]!,
    id = group.layout!.captionText!.id;
  expect(group.items).toHaveLength(3);
  expect(findItem(state().project!, id)?.item.type).toBe('text');
  editText(id, (c) => {
    c.runs[0]!.text = '我的回憶';
    c.runs[0]!.fontId = 'noto-serif-tc';
    c.runs[0]!.size = 84;
  });
  expect(state().project!.tracks[1]!.layout).toMatchObject({
    caption: '我的回憶',
    captionFontId: 'noto-serif-tc',
    captionFontSize: 84,
  });
  state().apply((d) => arrangeTemplate(d.tracks[1]!, 'sequential'));
  const next = state().project!.tracks[1]!;
  expect(next.layout!.duration).toBe(12);
  expect(next.layout!.captionText!.duration).toBe(12);
  expect(animationTarget(state().project!, id).target).toBe(next.layout!.captionText);
  expect(visibleLayers(state().project!, 2).filter((l) => l.item.type === 'text')).toHaveLength(1);
});
it('caption follows group timing, keeps stable text raster scale during group animation and copies to a unique ID', () => {
  const p = template();
  state().load(p);
  const group = p.tracks[1]!;
  placeItem(group.items[0]!.id, 3);
  expect(state().project!.tracks[1]!.layout!.captionText!.start).toBe(3);
  const current = state().project!,
    tr = current.tracks[1]!,
    caption = tr.layout!.captionText!;
  const a = templateContexts(current, 304, 540, 3)[caption.id]!;
  const enlarged = structuredClone(current);
  enlarged.tracks[1]!.layout!.transform!.scale = 2;
  const b = templateContexts(enlarged, 304, 540, 3)[caption.id]!;
  expect(a.textScale).toBeCloseTo(b.textScale!);
  expect(b.groupScale).toBe(2);
  enlarged.tracks[1]!.layout!.transform!.scale = 0.01;
  expect(templateContexts(enlarged, 304, 540, 3)[caption.id]!.textScale).toBeCloseTo(a.textScale!);
  duplicateAny(tr.items[0]!.id);
  const copies = state().project!.tracks.filter((t) => t.template);
  expect(new Set(copies.map((t) => t.layout!.captionText!.id)).size).toBe(2);
});
it('reapplying and deleting caption keep media settings intact; undo restores the caption', () => {
  const p = template(),
    old = p.tracks[1]!,
    next = collagePlan(p, ['source', 'source', 'source'], 'filmstrip', 'none', 1, 4).tracks[0]!;
  old.layout!.captionText!.card.runs[0]!.size = 84;
  carryTemplateEdits(next, old, true);
  expect(next.layout!.captionText!.id).toBe(old.layout!.captionText!.id);
  expect(next.layout!.captionText!.card.runs[0]!.size).toBe(84);
  state().load(p);
  const id = old.layout!.captionText!.id;
  removeAnyItem(id);
  expect(state().project!.tracks[1]!.items).toHaveLength(3);
  expect(state().project!.tracks[1]!.layout!.captionText).toBeUndefined();
  state().undo();
  expect(findItem(state().project!, id)?.item.type).toBe('text');
});
