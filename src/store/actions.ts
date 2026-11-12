import { sliceCell } from '../engine/templateTiming';
import type { Draft } from 'immer';
import {
  assignAspect,
  createMainTrack,
  createOverlayClip,
  createShapeItem,
  createTextItem,
  createTrack,
  newId,
  pickAspect,
} from '../model/defaults';
import type { Aspect, Asset, Item, TextItem, Track, Transform, VideoItem } from '../model/types';
import {
  duplicateFree,
  duplicateItem,
  findItem,
  findFreeStart,
  firstFreeTrack,
  isVideoItem,
  mainItems,
  mainTrack,
  moveTrack,
  relayout,
  removeItem,
  splitFree,
  splitItem,
} from '../engine/timeline';
import { moveLayerItem, type LayerDrop } from '../engine/layerEditing';
import { useProjectStore } from './projectStore';

const store = () => useProjectStore.getState();

type Opts = { coalesce?: string; select?: string | null };

/** 改某個物件（任何軌道）的欄位。recipe 直接改草稿。 */
export function editItem(id: string, recipe: (it: Draft<Item>) => void, opts?: Opts) {
  store().apply((d) => {
    for (const tr of d.tracks) {
      const it = tr.items.find((x) => x.id === id);
      if (it) {
        recipe(it);
        return;
      }
    }
  }, opts);
}

export function setTransform(id: string, patch: Partial<Transform>, coalesce = `tf:${id}`) {
  store().apply(
    (d) => {
      const f = findItem(d, id);
      if (!f) return;
      if (f.track.template && f.track.layout) {
        const tf = f.track.layout.transform ?? { x: 0.5, y: 0.5, scale: 1 };
        f.track.layout.transform = { x: patch.x ?? tf.x, y: patch.y ?? tf.y, scale: patch.scale ?? tf.scale };
        if (patch.opacity !== undefined) for (const it of f.track.items) it.transform.opacity = patch.opacity;
      } else Object.assign(f.item.transform, patch);
    },
    { coalesce },
  );
}

/** 把一群疊加素材放在 t 秒：各自放進第一條有空位的疊加軌，沒有就新增一條（所以會疊在同一秒） */
export function addOverlayClips(assets: Asset[], t: number): string | null {
  if (assets.length === 0) return null;
  let firstId: string | null = null;
  store().apply((d) => {
    for (const asset of assets) {
      const clip = createOverlayClip(asset, t);
      let ti = firstFreeTrack(d as never, 'overlay', clip.start, clip.duration);
      if (ti < 0) {
        d.tracks.push(createTrack('overlay', d.tracks as Track[]));
        ti = d.tracks.length - 1;
      }
      d.tracks[ti]!.items.push(clip);
      firstId ??= clip.id;
    }
  });
  if (firstId) store().select(firstId);
  return firstId;
}

export function addText(t: number, shape = false): string {
  const item = shape ? createShapeItem(t) : createTextItem(t);
  store().apply((d) => {
    let ti = firstFreeTrack(d as never, 'text', item.start, item.duration);
    if (ti < 0) {
      d.tracks.push(createTrack('text', d.tracks as Track[]));
      ti = d.tracks.length - 1;
    }
    d.tracks[ti]!.items.push(item);
  });
  store().select(item.id);
  return item.id;
}

export function editText(id: string, recipe: (card: Draft<TextItem['card']>) => void, opts?: Opts) {
  editItem(
    id,
    (it) => {
      if (it.type === 'text') recipe(it.card);
    },
    opts,
  );
}

export function removeAnyItem(id: string): boolean {
  const p = store().project;
  const f = p && findItem(p, id);
  if (!p || !f) return false;
  store().apply(
    (d) => {
      const tr = d.tracks[f.trackIndex]!;
      if (tr.template) {
        d.tracks = d.tracks.filter((t) => t.id !== tr.id);
        if (!d.tracks.some((t) => t.template)) delete d.layout;
        return;
      }
      tr.items = (
        f.track.kind === 'main' && !p.freeMain
          ? relayout(removeItem(tr.items as VideoItem[], id), d.mainOffset ?? 0)
          : tr.items.filter((x) => x.id !== id)
      ) as never;
    },
    { select: null },
  );
  return true;
}

export function splitAny(id: string, t: number): string | null {
  const p = store().project;
  const f = p && findItem(p, id);
  if (!p || !f) return null;
  if (f.track.template) {
    const local = t - f.item.start;
    if (local < 0.2 || f.item.duration - local < 0.2) return null;
    let selected = '';
    store().apply((d) => {
      const tr = d.tracks[f.trackIndex]!;
      const copy = structuredClone(p.tracks[f.trackIndex]!);
      copy.id = newId('t_');
      copy.items = copy.items.map((it) => ({
        ...(it.type === 'text' ? it : sliceCell(it, local)),
        id: newId('i_'),
        start: t,
        duration: it.duration - local,
      }));
      for (const it of tr.items) it.duration = local;
      const layout = tr.layout ?? d.layout;
      if (layout) {
        tr.layout = { ...layout, duration: local };
        copy.layout = { ...layout, start: t, duration: copy.items[0]!.duration };
      }
      selected = copy.items[0]!.id;
      d.tracks.splice(f.trackIndex + 1, 0, copy);
    });
    store().select(selected);
    return selected;
  }
  const out =
    f.track.kind === 'main' && !p.freeMain
      ? splitItem(f.track.items as VideoItem[], id, t)
      : splitFree(f.track.items, id, t);
  if (!out) return null;
  const right = out[out.findIndex((x) => x.id === id) + 1]!;
  store().apply(
    (d) => {
      d.tracks[f.trackIndex]!.items = (
        f.track.kind === 'main' && !p.freeMain ? relayout(out as VideoItem[], d.mainOffset ?? 0) : out
      ) as never;
    },
    { select: right.id },
  );
  return right.id;
}

export function duplicateAny(id: string): boolean {
  const p = store().project;
  const f = p && findItem(p, id);
  if (!p || !f) return false;
  if (f.track.template) {
    const copy = structuredClone(f.track);
    const start = Math.max(...copy.items.map((it) => it.start + it.duration));
    const delta = start - f.item.start;
    copy.id = newId('t_');
    copy.items = copy.items.map((it) => ({ ...it, id: newId('i_'), start: it.start + delta }));
    const layout = copy.layout ?? p.layout;
    if (layout) copy.layout = { ...layout, start };
    store().apply(
      (d) => {
        d.tracks.splice(f.trackIndex + 1, 0, copy);
      },
      { select: copy.items[0]!.id },
    );
    return true;
  }
  const r =
    f.track.kind === 'main' && !p.freeMain
      ? duplicateItem(f.track.items as VideoItem[], id)
      : duplicateFree(f.track.items, id);
  if (!r) return false;
  store().apply(
    (d) => {
      d.tracks[f.trackIndex]!.items = (
        f.track.kind === 'main' && !p.freeMain ? relayout(r.items as VideoItem[], d.mainOffset ?? 0) : r.items
      ) as never;
    },
    { select: r.newId },
  );
  return true;
}

export function patchTrack(
  trackId: string,
  patch: Partial<Pick<Track, 'hidden' | 'locked' | 'muted' | 'name'>>,
) {
  store().apply((d) => {
    const tr = d.tracks.find((t) => t.id === trackId);
    if (tr) Object.assign(tr, patch);
  });
}

export function shiftTrackLayer(trackId: string, dir: -1 | 1) {
  store().apply((d) => {
    d.tracks = moveTrack(d.tracks as Track[], trackId, dir) as never;
  });
}

export function removeTrack(trackId: string) {
  store().apply(
    (d) => {
      const i = d.tracks.findIndex((t) => t.id === trackId);
      if (i >= 0) {
        const template = d.tracks[i]!.template;
        if (template) {
          d.tracks = d.tracks.filter((t) => t.id !== trackId);
          if (!d.tracks.some((t) => t.template)) delete d.layout;
        } else d.tracks.splice(i, 1);
        if (!d.tracks.some((t) => t.kind === 'main')) {
          const visual = d.tracks.find((t) => t.kind === 'overlay' && !t.template);
          if (visual) visual.kind = 'main';
          else d.tracks.unshift(createMainTrack());
        }
      }
    },
    { select: null },
  );
}

/** 疊加影片/照片、文字物件放到新位置（自由放置，避開同軌其他物件） */
export function placeItem(id: string, start: number, opts?: Opts) {
  const p = store().project;
  const f = p && findItem(p, id);
  if (!p || !f || (f.track.kind === 'main' && !p.freeMain)) return;
  const s = findFreeStart(f.track.items, start, f.item.duration, id);
  store().apply((d) => {
    const tr = d.tracks.find((t) => t.id === f.track.id)!;
    if (tr.template) {
      const delta = Math.max(0, start) - f.item.start;
      for (const it of tr.items) it.start += delta;
      if (tr.layout) tr.layout.start += delta;
      if (d.layout) d.layout = { ...(tr.layout ?? d.layout), start: tr.items[0]!.start };
    } else {
      const it = tr.items.find((it) => it.id === id)!;
      it.start = s;
    }
  }, opts);
}

export { isVideoItem, mainTrack, relayout };

/**
 * 改專案比例。choice='auto'＝照主軌第一個片段的形狀決定，並維持「自動」（沒有片段就維持現在的比例）。
 * 手動選比例後 aspectAuto 會關掉。可以復原。
 */
export function setProjectAspect(choice: Aspect | 'auto'): Aspect | null {
  const p = store().project;
  if (!p) return null;
  let aspect: Aspect;
  if (choice === 'auto') {
    const first = mainItems(p)[0];
    const asset = first && p.assets.find((a) => a.id === first.assetId);
    aspect = asset ? pickAspect(asset.width, asset.height) : p.aspect;
  } else aspect = choice;
  store().apply((d) => {
    assignAspect(d, aspect, choice === 'auto');
  });
  return aspect;
}

/** 主軌整組延後；字幕與疊加保持原來的全域時間，供開場使用。 */
export function setMainOffset(seconds: number) {
  if (!Number.isFinite(seconds)) return;
  store().apply(
    (d) => {
      d.mainOffset = Math.min(600, Math.max(0, seconds));
      const tr = d.tracks.find((t) => t.kind === 'main');
      if (tr) {
        if (d.freeMain) {
          const first = tr.items.reduce((min, it) => Math.min(min, it.start), Infinity);
          if (Number.isFinite(first)) for (const item of tr.items) item.start += d.mainOffset - first;
          d.mainOffset = 0;
        } else tr.items = relayout(tr.items as VideoItem[], d.mainOffset);
      }
    },
    { coalesce: 'main-offset' },
  );
}

/** Reorder a whole lane; independent clip transfers use dropLayerItem instead. */
export function reorderTrack(id: string, targetId: string) {
  store().apply((d) => {
    const from = d.tracks.findIndex((t) => t.id === id),
      to = d.tracks.findIndex((t) => t.id === targetId);
    if (from < 0 || to < 0 || from === to) return;
    const [track] = d.tracks.splice(from, 1);
    d.tracks.splice(to, 0, track!);
  });
}

export function dropLayerItem(id: string, start: number, drop: LayerDrop) {
  store().apply((project) => moveLayerItem(project as never, id, start, drop), { select: id });
}
