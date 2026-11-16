import { expect, it } from 'vitest';
import { createProject, createTextItem } from '../model/defaults';
import type { Asset, VideoItem } from '../model/types';
import {
  createFramework,
  addTemplateAsset,
  addTemplateMember,
  templateCells,
  resizeCellBoundary,
  templateLayersAt,
  reorderTemplateMember,
  arrangeFramework,
  setFrameBox,
  templateMembers,
} from './templateModel';
import { layersAt, totalDuration, findItem } from './timeline';
import { itemBox } from './geometry';
import { geoCtx } from './scene';
import { groupFrame } from './templateGeometry';
import { animationTarget } from './keyframes';
import { itemCategory } from './batchLayers';
import { composeAdjustment } from './templateTone';
import { DEFAULT_ADJUSTMENT } from './grade';
import { audioWindowAt, windowGain } from './audioEnvelope';
function setup() {
  const p = createProject('frame');
  p.flexibleLayers = true;
  p.assets = [
    {
      id: 'red',
      name: 'red',
      kind: 'video',
      width: 320,
      height: 568,
      duration: 10,
      hasAudio: true,
      mime: 'video/webm',
      size: 1,
      thumbs: [],
    },
    {
      id: 'green',
      name: 'green',
      kind: 'image',
      width: 320,
      height: 568,
      duration: 0,
      hasAudio: false,
      mime: 'image/png',
      size: 1,
      thumbs: [],
    },
  ];
  const group = createFramework(p, 2, 1, 0, 4);
  p.tracks.push(group);
  return { p, group };
}
it('empty framework is selectable, has one frame, and determines the output interval without fake source assets', () => {
  const { p, group } = setup();
  expect(group.items).toHaveLength(0);
  expect(findItem(p, group.layout!.frameItem!.id)?.index).toBe(-2);
  expect(totalDuration(p)).toBe(4);
  expect(layersAt(p, 2, false)).toHaveLength(1);
  expect(itemBox(group.layout!.frameItem!, geoCtx(p, 1080, 1920, 2))).toEqual(
    groupFrame(group, 1080, 1920, 2),
  );
});
it('one canonical cell boundary moves both neighbours and frame holes, with no duplicate old divider', () => {
  const { group } = setup();
  const before = templateCells(group);
  resizeCellBoundary(group, 0, 'b', 0.65);
  const after = templateCells(group);
  expect(group.layout!.cells![0]!.h).toBeCloseTo(0.65);
  expect(group.layout!.cells![1]!.y).toBeCloseTo(0.65);
  expect(after[0]!.h).toBeGreaterThan(before[0]!.h);
  expect(after[1]!.y).toBeGreaterThan(before[1]!.y);
  expect(after).toHaveLength(2);
  resizeCellBoundary(group, 0, 'b', 1);
  expect(group.layout!.cells![1]!.h).toBeGreaterThanOrEqual(0.0399);
});
it('frame resizing keeps opposite edges fixed and remains independent of a later project aspect change', () => {
  const { p, group } = setup();
  const frame = groupFrame(group, p.width, p.height, 0);
  setFrameBox(p, group, { x: 0.4, y: 0.5, w: (frame.w / p.width) * 0.8, h: (frame.h / p.height) * 0.7 });
  const resized = groupFrame(group, p.width, p.height, 0),
    aspect = resized.w / resized.h;
  p.width = 1920;
  p.height = 1080;
  const other = groupFrame(group, p.width, p.height, 0);
  expect(other.w / other.h).toBeCloseTo(aspect);
  expect(group.layout!.frameItem!.id).toBe(`${group.id}-frame`);
});
it('media keep original source and crop, and scale/move inside a cell using their own transform', () => {
  const { p, group } = setup();
  const id = addTemplateAsset(p, group, p.assets[0]!, 1),
    item = group.items[0]! as VideoItem;
  expect(item.fit).toBe('contain');
  expect(item.crop).toBeUndefined();
  const ctx = geoCtx(p, 1080, 1920, 1),
    before = itemBox(item, ctx)!;
  item.transform.scale *= 2;
  item.transform.x = 0.7;
  const after = itemBox(item, ctx)!;
  expect(after.w).toBeCloseTo(before.w * 2);
  expect(after.cx).toBeGreaterThan(before.cx);
  expect(animationTarget(p, id).group).toBe(false);
  expect(animationTarget(p, group.layout!.frameItem!.id).group).toBe(true);
});
it('multiple rows in one cell and image/text/image order are independent of category navigation', () => {
  const { p, group } = setup();
  const a = addTemplateAsset(p, group, p.assets[0]!, 1),
    text = createTextItem(0, '夾心');
  text.duration = 4;
  addTemplateMember(p, group, text);
  const b = addTemplateAsset(p, group, p.assets[1]!, 1);
  expect(templateLayersAt(group, 1, false).map((i) => i.id)).toEqual([
    group.layout!.frameItem!.id,
    a,
    text.id,
    b,
  ]);
  reorderTemplateMember(group, text.id, 1);
  expect(templateMembers(group).map((i) => i.id)).toEqual([a, b, text.id]);
  expect(group.layout!.lanes!.filter((l) => l.cell === 1)).toHaveLength(2);
});
it('cell gaps hold one preceding/first source silently, and never cover an active row with a stale held row', () => {
  const { p, group } = setup();
  addTemplateAsset(p, group, p.assets[0]!, 1);
  const a = group.items[0]! as VideoItem;
  a.start = 1;
  a.duration = 1;
  addTemplateAsset(p, group, p.assets[1]!, 1, 3);
  const b = group.items[1]!;
  const first = templateLayersAt(group, 0.5, false).find((i) => i.id === a.id) as VideoItem;
  expect(first.heldSourceTime).toBe(0);
  expect(first.audioEnabled).toBe(false);
  const held = templateLayersAt(group, 2.5, false).find((i) => i.id === a.id) as VideoItem;
  expect(held.heldSourceTime).toBeCloseTo(0.999);
  expect(templateLayersAt(group, 3.2, false).map((i) => i.id)).toEqual([group.layout!.frameItem!.id, b.id]);
  group.layout!.gapMode = 'transparent';
  expect(templateLayersAt(group, 2.5, false)).toHaveLength(1);
  group.layout!.gapMode = 'fill';
  expect(templateLayersAt(group, 2.5, false)).toHaveLength(1);
});
it('sequential playback reflows cells together and keeps overlapping rows parallel', () => {
  const { p, group } = setup();
  addTemplateAsset(p, group, p.assets[0]!, 1);
  addTemplateAsset(p, group, p.assets[1]!, 1);
  addTemplateAsset(p, group, p.assets[0]!, 2);
  arrangeFramework(group, 'sequential');
  expect(group.items.map((i) => i.start)).toEqual([0, 0, 4]);
  expect(group.layout!.duration).toBe(8);
  arrangeFramework(group, 'simultaneous');
  expect(group.items.map((i) => i.start)).toEqual([0, 0, 0]);
  expect(group.layout!.duration).toBe(4);
});
it('uploaded media remain imagery while drawings/GIPHY retain sticker classification, hidden child lane does not render', () => {
  const { p, group } = setup();
  p.assets[0]!.origin = 'upload';
  const id = addTemplateAsset(p, group, p.assets[0]!, 1);
  expect(itemCategory(group.items[0]!, p)).toBe('visual');
  group.layout!.lanes![0]!.hidden = true;
  expect(templateLayersAt(group, 1, false).some((i) => i.id === id)).toBe(false);
  expect(templateLayersAt(group, 1, true).some((i) => i.id === id)).toBe(true);
  const a = { ...p.assets[0]!, origin: 'giphy' } as Asset;
  p.assets[0] = a;
  expect(itemCategory(group.items[0]!, p)).toBe('sticker');
});
it('member and group tone compose in one neutral-relative pass; a group trim is an actual audio fade boundary', () => {
  expect(
    composeAdjustment(
      { ...DEFAULT_ADJUSTMENT, brightness: 1.2, saturation: 0.5 },
      { ...DEFAULT_ADJUSTMENT, brightness: 0.5, saturation: 0.5 },
    ),
  ).toMatchObject({ brightness: 0.6, saturation: 0.25 });
  const { p, group } = setup();
  addTemplateAsset(p, group, p.assets[0]!, 1);
  const item = group.items[0]! as VideoItem;
  const window = audioWindowAt(item, 1.995, { start: 1, duration: 1 })!;
  expect(window).toEqual({ start: 1, end: 2 });
  expect(windowGain(window, 1.999, 1)).toBeLessThan(0.1);
});

it('cloning a framework gives frame, lanes, member order and caption independent identity without changing trims', async () => {
  const { cloneFramework } = await import('./templateModel');
  const { p, group } = setup();
  addTemplateAsset(p, group, p.assets[0]!, 1);
  (group.items[0] as VideoItem).trimIn = 2;
  const copy = cloneFramework(group, 4);
  expect(copy.id).not.toBe(group.id);
  expect(copy.layout!.frameItem!.id).toBe(`${copy.id}-frame`);
  expect(copy.items[0]!.templateLane).not.toBe(group.items[0]!.templateLane);
  expect(copy.layout!.lanes![0]!.id).toBe(copy.items[0]!.templateLane);
  expect(copy.layout!.order).toEqual([copy.items[0]!.id]);
  expect((copy.items[0] as VideoItem).trimIn).toBe(2);
  expect(copy.items[0]!.start).toBe(4);
});
it('member split/delete/duplicate never resurrect removed source or remove the empty parent; group split caps output at its own bounds', async () => {
  const { useProjectStore } = await import('../store/projectStore');
  const { useUI } = await import('../store/uiStore');
  const { splitAny, removeAnyItem, duplicateAny, placeItem } = await import('../store/actions');
  const { p, group } = setup();
  const id = addTemplateAsset(p, group, p.assets[0]!, 1);
  (group.items[0] as VideoItem).trimIn = 2;
  (group.items[0] as VideoItem).cell!.sourceEnd = 6;
  useUI.setState({ player: null, templateDestination: null });
  useProjectStore.getState().load(p);
  const right = splitAny(id, 2)!;
  expect(right).toBeTruthy();
  let tr = useProjectStore.getState().project!.tracks.find((t) => t.id === group.id)!;
  expect(tr.items).toHaveLength(2);
  expect((tr.items[1] as VideoItem).trimIn).toBe(4);
  removeAnyItem(id);
  placeItem(right, 0);
  duplicateAny(right);
  tr = useProjectStore.getState().project!.tracks.find((t) => t.id === group.id)!;
  expect(tr.items.every((i) => i.type === 'text' || i.trimIn === 4)).toBe(true);
  for (const it of [...tr.items]) removeAnyItem(it.id);
  expect(useProjectStore.getState().project!.tracks.find((t) => t.id === group.id)?.items).toHaveLength(0);
  const root = group.layout!.frameItem!.id;
  const second = splitAny(root, 2)!;
  expect(second).toBeTruthy();
  expect(totalDuration(useProjectStore.getState().project!)).toBe(4);
  removeAnyItem(second);
  expect(totalDuration(useProjectStore.getState().project!)).toBe(2);
  useProjectStore.getState().close();
});

it('cell playback order moves time without swapping cell content or overlapping-row relationships', async () => {
  const { reorderFrameworkCell } = await import('./templateModel');
  const { p, group } = setup();
  addTemplateAsset(p, group, p.assets[0]!, 1);
  addTemplateAsset(p, group, p.assets[1]!, 1);
  addTemplateAsset(p, group, p.assets[0]!, 2);
  arrangeFramework(group, 'sequential');
  const ids = group.items.map((i) => i.id);
  reorderFrameworkCell(group, 2, -1);
  expect(group.layout!.cellOrder).toEqual([2, 1]);
  expect(group.items.map((i) => i.start)).toEqual([4, 4, 0]);
  expect(group.items.map((i) => i.id)).toEqual(ids);
  expect(group.items.map((i) => i.templateCell)).toEqual([1, 1, 2]);
});

it('adding a member after choosing sequential mode inserts it at the chosen cell time, not zero', () => {
  const { p, group } = setup();
  arrangeFramework(group, 'sequential');
  addTemplateAsset(p, group, p.assets[0]!, 2);
  expect(group.items[0]!.start).toBe(4);
  expect(group.items[0]!.templateCell).toBe(2);
});
it('resizing a keyframed frame at its animated position does not apply the old base position twice', async () => {
  const { animationValues } = await import('./keyframes');
  const { p, group } = setup();
  const values = animationValues(group.layout!, 0);
  group.layout!.keyframes = [{ time: 0, values: { ...values, x: 0.7, y: 0.6 } }];
  const f = groupFrame(group, p.width, p.height, 0);
  setFrameBox(
    p,
    group,
    { x: f.cx / p.width, y: f.cy / p.height, w: (f.w / p.width) * 0.8, h: f.h / p.height },
    { x: f.cx / p.width, y: f.cy / p.height },
  );
  expect(groupFrame(group, p.width, p.height, 0).cx).toBeCloseTo(f.cx);
  expect(groupFrame(group, p.width, p.height, 0).cy).toBeCloseTo(f.cy);
});
