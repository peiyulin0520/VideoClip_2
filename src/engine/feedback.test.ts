import { describe, expect, it } from 'vitest';
import { createProject, createClip, createTrack } from '../model/defaults';
import type { Asset, VideoItem } from '../model/types';
import { trimStartFree, trimEndFree, visibleLayers } from './timeline';
import { setTimelineItems, trimSourceRange } from './groupTiming';
import { collagePlan, mergeLegacyTemplate } from './layouts';
import { useProjectStore } from '../store/projectStore';
import {
  placeItem,
  removeAnyItem,
  removeTrack,
  reorderTrack,
  splitAny,
  duplicateAny,
} from '../store/actions';
const asset = (id: string, duration = 8): Asset => ({
  id,
  kind: 'video',
  name: id,
  mime: 'video/webm',
  size: 100,
  duration,
  width: 160,
  height: 284,
  hasAudio: true,
  thumbs: [],
});

describe('iPhone 第二輪修剪與群組回歸', () => {
  it('版型分割與複製包含全部格子，框架時間獨立且舊組不受影響', () => {
    const p = createProject('group edits');
    p.assets = [asset('a')];
    const plan = collagePlan(p, ['a', 'a', 'a'], 'photobooth', 'slide', 0, 4);
    p.tracks.push(...plan.tracks);
    p.layout = plan.layout;
    useProjectStore.getState().load(p);
    const right = splitAny(plan.tracks[0]!.items[0]!.id, 2)!;
    let state = useProjectStore.getState().project!;
    expect(state.tracks.filter((t) => t.template)).toHaveLength(2);
    expect(state.tracks[1]!.items.every((it) => it.duration === 2 && it.start === 0)).toBe(true);
    expect(
      state.tracks[2]!.items.every(
        (it) => it.duration === 2 && it.start === 2 && (it as VideoItem).trimIn === 2,
      ),
    ).toBe(true);
    expect(state.tracks[2]!.layout).toMatchObject({ start: 2, duration: 2 });
    expect(duplicateAny(right)).toBe(true);
    state = useProjectStore.getState().project!;
    expect(state.tracks[3]!.items).toHaveLength(3);
    expect(state.tracks[3]!.layout!.start).toBe(4);
    placeItem(state.tracks[3]!.items[0]!.id, 6);
    state = useProjectStore.getState().project!;
    expect(state.tracks[1]!.layout!.start).toBe(0);
    expect(state.tracks[2]!.layout!.start).toBe(2);
    expect(state.tracks[3]!.layout!.start).toBe(6);
    removeTrack(state.tracks[3]!.id);
    expect(useProjectStore.getState().project!.tracks.filter((t) => t.template)).toHaveLength(2);
  });

  it('左端往後切固定右端、保留來源，左右皆可拉回原始區段', () => {
    const p = createProject('trim'),
      a = asset('a');
    p.assets = [a];
    const item = createClip(a);
    p.tracks[0]!.items = [item];
    setTimelineItems(p, p.tracks[0]!.id, trimStartFree([item], item.id, 2));
    const cut = p.tracks[0]!.items[0] as VideoItem;
    expect([cut.start, cut.duration, cut.trimIn]).toEqual([2, 6, 2]);
    expect(p.freeMain).toBe(true);
    expect(visibleLayers(p, 1)).toEqual([]);
    setTimelineItems(p, p.tracks[0]!.id, trimEndFree([cut], item.id, 3, a));
    const shortened = p.tracks[0]!.items[0]!;
    setTimelineItems(p, p.tracks[0]!.id, trimEndFree([shortened], item.id, 99, a));
    expect(p.tracks[0]!.items[0]!.duration).toBe(6);
    trimSourceRange(p, item.id, 0, 8);
    expect(p.tracks[0]!.items[0]).toMatchObject({ start: 0, trimIn: 0, duration: 8 });
  });
  it('來源選區不破壞同軌鄰居，原音片段也能修剪起點', () => {
    const p = createProject('source'),
      a = asset('audio');
    a.kind = 'audio';
    p.assets = [a];
    const it = createClip(a);
    it.trimIn = 2;
    it.start = 2;
    it.duration = 4;
    p.tracks[0]!.items = [it];
    const next = trimStartFree([it], it.id, 1)[0] as VideoItem;
    expect(next.trimIn).toBe(3);
    p.tracks[0]!.items = [it, { ...createClip(a), start: 6, duration: 2 }];
    expect(() => trimSourceRange(p, it.id, 0, 8)).toThrow('重疊');
  });
  it('多格在同一圖層，全部同時可見，時間與音訊選擇一致', () => {
    const p = createProject('group');
    p.assets = [asset('a'), asset('b'), asset('c')];
    const plan = collagePlan(p, ['a', 'b', 'c'], 'photobooth', 'none', 1, 4);
    p.tracks.push(...plan.tracks);
    p.layout = plan.layout;
    const tr = p.tracks[1]!;
    expect(tr.items).toHaveLength(3);
    expect(visibleLayers(p, 2).filter((l) => l.track.template)).toHaveLength(3);
    useProjectStore.getState().load(p);
    placeItem(tr.items[0]!.id, 3);
    const moved = useProjectStore.getState().project!;
    expect(moved.tracks[1]!.items.every((it) => it.start === 3)).toBe(true);
    expect(moved.layout!.start).toBe(3);
    useProjectStore
      .getState()
      .apply((d) => setTimelineItems(d, tr.id, trimStartFree(d.tracks[1]!.items, tr.items[0]!.id, 1)));
    const trimmed = useProjectStore.getState().project!;
    expect(
      trimmed.tracks[1]!.items.every(
        (it) => it.start === 4 && it.duration === 3 && (it as VideoItem).trimIn === 1,
      ),
    ).toBe(true);
    expect(trimmed.layout).toMatchObject({ start: 4, duration: 3 });
  });
  it('刪除版型任何一格或整軌同時移除框架，復原還原整組', () => {
    for (const viaTrack of [true, false]) {
      const p = createProject('delete');
      p.assets = [asset('a')];
      const plan = collagePlan(p, ['a', 'a', 'a'], 'filmstrip', 'none', 0, 3);
      p.tracks.push(...plan.tracks);
      p.layout = plan.layout;
      useProjectStore.getState().load(p);
      if (viaTrack) removeTrack(plan.tracks[0]!.id);
      else removeAnyItem(plan.tracks[0]!.items[1]!.id);
      expect(useProjectStore.getState().project!.layout).toBeUndefined();
      expect(useProjectStore.getState().project!.tracks).toHaveLength(1);
      useProjectStore.getState().undo();
      expect(useProjectStore.getState().project!.tracks[1]!.items).toHaveLength(3);
    }
  });
  it('舊每格一軌合併不丟素材、裁切、隱藏或靜音狀態', () => {
    const p = createProject('old');
    p.assets = [asset('a')];
    const plan = collagePlan(p, ['a', 'a', 'a'], 'filmstrip', 'none', 0, 3);
    p.layout = plan.layout;
    const tracks = plan.tracks[0]!.items.map((it, i) => ({
      ...createTrack('overlay', p.tracks),
      template: true,
      muted: i > 0,
      hidden: i === 2,
      items: [it],
    }));
    p.tracks.push(...tracks);
    const merged = mergeLegacyTemplate(p);
    expect(merged.tracks).toHaveLength(2);
    expect(merged.tracks[1]!.items.map((it) => (it as VideoItem).audioEnabled)).toEqual([true, false, false]);
    expect(merged.tracks[1]!.items[2]!.transform.opacity).toBe(0);
    expect(p.tracks).toHaveLength(4);
  });
  it('圖層拖放維持主軌在底，復原可還原原疊放順序', () => {
    const p = createProject('layers');
    const a = createTrack('text', p.tracks),
      b = createTrack('overlay', p.tracks);
    p.tracks.push(a, b);
    useProjectStore.getState().load(p);
    reorderTrack(a.id, b.id);
    expect(useProjectStore.getState().project!.tracks.map((t) => t.id)).toEqual([
      p.tracks[0]!.id,
      b.id,
      a.id,
    ]);
    reorderTrack(a.id, p.tracks[0]!.id);
    expect(useProjectStore.getState().project!.tracks[0]!.kind).toBe('main');
    useProjectStore.getState().undo();
    expect(useProjectStore.getState().project!.tracks.map((t) => t.id)).toEqual(p.tracks.map((t) => t.id));
  });
});
