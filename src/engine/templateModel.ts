import type { Asset, Item, Project, Track, TemplateRect, VideoItem, TemplateLane } from '../model/types';
import { createOverlayClip, createTrack, newId } from '../model/defaults';
import { layoutDefaultSize, layoutSlots } from './layouts';
import { mediaSegments, cellMediaTime } from './templateTiming';
export const isTemplateV2 = (t: Track) => t.template && t.layout?.version === 2;
export function isTemplateRoot(track: Track, item: Item) {
  return (
    !!track.template &&
    item.id !== track.layout?.captionText?.id &&
    (track.layout?.version !== 2 || item.templateRole === 'frame')
  );
}
export function syncTemplateFrame(track: Track) {
  const l = track.layout;
  if (!track.template || l?.version !== 2) return;
  if (!l.frameItem)
    l.frameItem = {
      id: `${track.id}-frame`,
      templateRole: 'frame',
      type: 'image',
      assetId: '',
      name: track.name,
      start: l.start,
      duration: l.duration,
      trimIn: 0,
      speed: 1,
      volume: 0,
      audioEnabled: false,
      fit: 'contain',
      transform: { x: 0.5, y: 0.5, scale: 1, rotation: 0, opacity: 1 },
    };
  const frame = l.frameItem;
  if (frame.start !== l.start) frame.start = l.start;
  if (frame.duration !== l.duration) frame.duration = l.duration;
  if (frame.name !== track.name) frame.name = track.name;
}
export function gridCells(rows: number, cols: number): TemplateRect[] {
  const r = Math.min(4, Math.max(1, Math.round(rows))),
    c = Math.min(4, Math.max(1, Math.round(cols)));
  return Array.from({ length: r * c }, (_, i) => ({
    x: (i % c) / c,
    y: Math.floor(i / c) / r,
    w: 1 / c,
    h: 1 / r,
  }));
}
/** Only one set of holes is used by frame artwork, source clips, hit tests and resize handles. */
export function templateCells(track: Track): TemplateRect[] {
  const l = track.layout!;
  if (l.version !== 2) return layoutSlots(l.style, l.count);
  const raw = l.cells ?? gridCells(l.grid?.rows ?? 1, l.grid?.cols ?? 1),
    size = l.size ?? layoutDefaultSize(l.style),
    box = l.box ?? { w: 1, h: 1 };
  const bw = Math.max(1, size.width * box.w),
    bh = Math.max(1, size.height * box.h),
    border = Math.max(0, l.border ?? 32),
    gap = Math.max(0, l.gap ?? 20),
    bottom = 1 - (l.footer ?? 0);
  return raw.map((r) => {
    const left = (r.x < 0.001 ? border : gap / 2) / bw,
      right = (r.x + r.w > 0.999 ? border : gap / 2) / bw,
      top = (r.y < 0.001 ? border : gap / 2) / bh,
      end = (r.y + r.h > 0.999 ? border : gap / 2) / bh;
    return {
      x: r.x + Math.min(left, r.w * 0.45),
      y: r.y * bottom + Math.min(top, r.h * bottom * 0.45),
      w: Math.max(0.005, r.w - Math.min(left, r.w * 0.45) - Math.min(right, r.w * 0.45)),
      h: Math.max(
        0.005,
        r.h * bottom - Math.min(top, r.h * bottom * 0.45) - Math.min(end, r.h * bottom * 0.45),
      ),
    };
  });
}
export function templateLane(track: Track, item: Item) {
  return track.layout?.lanes?.find((l) => l.id === item.templateLane);
}
export function templateMembers(track: Track) {
  const items = [...track.items, ...(track.layout?.captionText ? [track.layout.captionText] : [])],
    order = track.layout?.order ?? [];
  return items.slice().sort((a, b) => {
    const ai = order.indexOf(a.id),
      bi = order.indexOf(b.id);
    return (ai < 0 ? order.length + items.indexOf(a) : ai) - (bi < 0 ? order.length + items.indexOf(b) : bi);
  });
}
export function createFramework(
  project: Project,
  rows: number,
  cols: number,
  start: number,
  duration = 3,
): Track {
  const cells = gridCells(rows, cols),
    r = Math.min(4, Math.max(1, Math.round(rows))),
    c = Math.min(4, Math.max(1, Math.round(cols))),
    track = createTrack('overlay', project.tracks);
  track.template = true;
  track.name = `版型 ${c} × ${r}`;
  track.layout = {
    version: 2,
    style: 'grid',
    motion: 'none',
    start: Math.max(0, start),
    duration: Math.max(0.2, duration),
    count: cells.length,
    grid: { rows: r, cols: c },
    cells,
    size: { width: 1080, height: (1080 * r) / c },
    box: { w: 0.9, h: 0.9 },
    border: 32,
    gap: 20,
    frameColor: '#fff5df',
    gapMode: 'hold',
    gapColor: '#eee6d6',
    playback: 'simultaneous',
    transform: { x: 0.5, y: 0.5, scale: 1 },
    lanes: [],
    order: [],
    cellOffsets: cells.map(() => 0),
    cellDurations: cells.map(() => Math.max(0.2, duration)),
  };
  syncTemplateFrame(track);
  return track;
}
/** Existing media/cuts stay untouched until the user edits the structure; no asset is cropped or discarded. */
export function upgradeFramework(project: Project, track: Track) {
  if (!track.layout || track.layout.version === 2) return;
  const l = track.layout,
    reference = layoutDefaultSize(l.style),
    size = l.size ?? reference,
    oldFit = Math.min(project.width / reference.width, project.height / reference.height),
    newFit = Math.min(project.width / size.width, project.height / size.height),
    count = l.count ?? track.items.filter((i) => i.type !== 'text').length;
  l.version = 2;
  l.size = size;
  l.box = { w: oldFit / newFit, h: oldFit / newFit };
  l.grid = l.style === 'polaroid' ? { rows: 2, cols: 2 } : { rows: Math.max(1, count), cols: 1 };
  l.cells = gridCells(l.grid.rows, l.grid.cols);
  l.border = 32;
  l.gap = 24;
  l.footer = l.captionText?.card.runs.some((r) => r.text.trim()) ? 0.07 : 0;
  l.gapMode = l.playback === 'sequential' ? 'hold' : 'fill';
  l.gapColor = '#000000';
  l.lanes = [];
  l.order = [];
  l.cellOffsets = [];
  l.cellDurations = [];
  let cell = 0;
  for (const item of track.items) {
    const no = item.type === 'text' ? undefined : ++cell,
      slot = item.type !== 'text' ? (item.slot ?? layoutSlots(l.style, l.count)[cell - 1]) : undefined;
    if (slot) {
      item.transform.x = (item.transform.x - slot.x) / slot.w;
      item.transform.y = (item.transform.y - slot.y) / slot.h;
    }
    item.templateRole = no ? 'cell' : 'member';
    item.templateCell = no;
    const lane = {
      id: newId('lane_'),
      name: item.name ?? (no ? `第 ${no} 格` : '文字'),
      kind:
        item.type === 'text'
          ? ('text' as const)
          : item.type === 'audio'
            ? ('audio' as const)
            : ('visual' as const),
      cell: no,
    };
    l.lanes.push(lane);
    item.templateLane = lane.id;
    l.order.push(item.id);
    if (no) {
      l.cellOffsets[no - 1] = item.start - l.start;
      l.cellDurations[no - 1] = item.duration;
    }
  }
  if (l.captionText) {
    l.captionText.templateRole = 'member';
    const lane: TemplateLane = { id: newId('lane_'), name: '版型文字', kind: 'text' };
    l.lanes.push(lane);
    l.captionText.templateLane = lane.id;
    l.order.push(l.captionText.id);
  }
  syncTemplateFrame(track);
}
export function reshapeFramework(project: Project, track: Track, rows: number, cols: number) {
  upgradeFramework(project, track);
  const l = track.layout!,
    cells = gridCells(rows, cols),
    count = cells.length;
  const oldCount = l.count ?? count;
  l.grid = {
    rows: Math.min(4, Math.max(1, Math.round(rows))),
    cols: Math.min(4, Math.max(1, Math.round(cols))),
  };
  l.cells = cells;
  l.count = count;
  for (const item of templateMembers(track))
    if (item.templateCell && item.templateCell > count) item.templateCell = count;
  for (const lane of l.lanes ?? []) if (lane.cell && lane.cell > count) lane.cell = count;
  l.cellDurations = Array.from(
    { length: count },
    (_, i) => l.cellDurations?.[i] ?? Math.max(0.2, l.duration),
  );
  if (oldCount !== count) l.cellOffsets = Array.from({ length: count }, (_, i) => l.cellOffsets?.[i] ?? 0);
  syncTemplateFrame(track);
}
export function addTemplateMember(
  project: Project,
  track: Track,
  item: Item,
  cell?: number,
  kind?: TemplateLane['kind'],
) {
  upgradeFramework(project, track);
  const l = track.layout!;
  const no = cell ? Math.max(1, Math.min(l.count ?? 1, cell)) : undefined;
  item.templateRole = no ? 'cell' : 'member';
  item.templateCell = no;
  const lane: TemplateLane = {
    id: newId('lane_'),
    name: item.name ?? (no ? `第 ${no} 格` : '素材'),
    cell: no,
    kind:
      kind ??
      (item.type === 'text'
        ? 'text'
        : item.type === 'audio'
          ? 'audio'
          : project.assets.find((a) => a.id === item.assetId)?.origin === 'giphy'
            ? 'sticker'
            : 'visual'),
  };
  (l.lanes ??= []).push(lane);
  item.templateLane = lane.id;
  const cellStart = l.start + (no ? (l.cellOffsets?.[no - 1] ?? 0) : 0);
  const cellEnd = no ? cellStart + (l.cellDurations?.[no - 1] ?? l.duration) : l.start + l.duration;
  item.start = item.start < cellStart || item.start >= cellEnd ? cellStart : item.start;
  item.transform = { ...item.transform, x: 0.5, y: 0.5 };
  if (item.type !== 'text') {
    item.fit = 'contain';
    if (no) {
      item.slot = templateCells(track)[no - 1];
      item.cell ??= {
        sourceEnd: project.assets.find((a) => a.id === item.assetId)?.duration || 600,
        offset: 0,
        blanks: [],
        background: l.gapColor ?? '#000000',
      };
    }
  }
  track.items.push(item);
  (l.order ??= []).push(item.id);
  syncTemplateFrame(track);
  return item.id;
}
export function addTemplateAsset(
  project: Project,
  track: Track,
  asset: Asset,
  cell: number | undefined,
  time = track.layout!.start,
) {
  const item = createOverlayClip(asset, time);
  item.transform.scale = 1;
  item.duration =
    asset.kind === 'image'
      ? track.layout!.duration
      : Math.min(
          item.duration,
          (cell ? track.layout!.cellDurations?.[cell - 1] : undefined) ?? track.layout!.duration,
        );
  return addTemplateMember(
    project,
    track,
    item,
    cell,
    asset.kind === 'audio'
      ? 'audio'
      : asset.origin === 'drawing' || asset.origin === 'giphy'
        ? 'sticker'
        : 'visual',
  );
}
export function reorderTemplateMember(track: Track, id: string, direction: -1 | 1) {
  const l = track.layout;
  if (!l || track.locked) return;
  const order = templateMembers(track).map((i) => i.id),
    at = order.indexOf(id),
    to = at + direction;
  if (at < 0 || to < 0 || to >= order.length) return;
  [order[at], order[to]] = [order[to]!, order[at]!];
  l.order = order;
}
export function resizeCellBoundary(
  track: Track,
  index: number,
  edge: 'l' | 'r' | 't' | 'b',
  position: number,
) {
  const l = track.layout,
    raw = l?.cells;
  if (!l || !raw?.[index]) return;
  const old = raw[index]!,
    horizontal = edge === 'l' || edge === 'r',
    before = edge === 'l' || edge === 't',
    start = horizontal ? old.x : old.y,
    length = horizontal ? old.w : old.h,
    boundary = before ? start : start + length;
  const neighbours = raw
    .map((r, i) => ({ r, i }))
    .filter(
      ({ r, i }) =>
        i !== index &&
        Math.abs((horizontal ? (before ? r.x + r.w : r.x) : before ? r.y + r.h : r.y) - boundary) < 0.001 &&
        (horizontal
          ? Math.min(r.y + r.h, old.y + old.h) - Math.max(r.y, old.y)
          : Math.min(r.x + r.w, old.x + old.w) - Math.max(r.x, old.x)) > 0.001,
    );
  const lower = before
    ? Math.max(0, ...neighbours.map(({ r }) => (horizontal ? r.x + 0.04 : r.y + 0.04)))
    : start + 0.04;
  const upper = before
    ? start + length - 0.04
    : Math.min(1, ...neighbours.map(({ r }) => (horizontal ? r.x + r.w - 0.04 : r.y + r.h - 0.04)));
  const value = Math.max(lower, Math.min(upper, position)),
    delta = value - boundary;
  if (horizontal) {
    if (before) {
      old.x += delta;
      old.w -= delta;
    } else old.w += delta;
  } else if (before) {
    old.y += delta;
    old.h -= delta;
  } else old.h += delta;
  for (const { r } of neighbours)
    if (horizontal) {
      if (before) r.w += delta;
      else {
        r.x += delta;
        r.w -= delta;
      }
    } else if (before) r.h += delta;
    else {
      r.y += delta;
      r.h -= delta;
    }
}
export function setFrameBox(
  project: Project,
  track: Track,
  rect: { x: number; y: number; w: number; h: number },
  current?: { x: number; y: number },
) {
  upgradeFramework(project, track);
  const l = track.layout!,
    size = l.size!,
    fit = Math.min(project.width / size.width, project.height / size.height),
    old = l.transform ?? { x: 0.5, y: 0.5, scale: 1 },
    dx = rect.x - (current?.x ?? old.x),
    dy = rect.y - (current?.y ?? old.y);
  l.box = {
    w: Math.max(0.1, (rect.w * project.width) / (size.width * fit)),
    h: Math.max(0.1, (rect.h * project.height) / (size.height * fit)),
  };
  l.transform = { ...old, x: old.x + dx, y: old.y + dy };
  for (const frame of l.keyframes ?? []) {
    frame.values.x += dx;
    frame.values.y += dy;
  }
}
export function templateLayersAt(track: Track, t: number, includeHidden: boolean): Item[] {
  const l = track.layout;
  if (!l || t < l.start || t >= l.start + l.duration) return [];
  const members = templateMembers(track).filter((i) => includeHidden || !templateLane(track, i)?.hidden),
    active = members.filter(
      (i) =>
        t >= i.start &&
        t < i.start + i.duration &&
        (i.type === 'text' ||
          i.type === 'audio' ||
          cellMediaTime(i, t) !== null ||
          i.cell?.cards?.some((c) => t - i.start >= c.start && t - i.start < c.end)),
    );
  if (l.gapMode === 'hold')
    for (let no = 1; no <= (l.count ?? 1); no++) {
      if (active.some((i) => i.templateCell === no && i.type !== 'text' && i.type !== 'audio')) continue;
      const candidates = members
        .filter((i): i is VideoItem => i.templateCell === no && i.type !== 'text' && i.type !== 'audio')
        .flatMap((i) => mediaSegments(i).map((s) => ({ item: i, segment: s })))
        .sort((a, b) => a.segment.start - b.segment.start);
      const previous = candidates
          .filter((c) => c.segment.end <= t)
          .sort((a, b) => b.segment.end - a.segment.end)[0],
        next = candidates.find((c) => c.segment.start > t),
        choice = previous ?? next;
      if (choice) {
        const s = choice.segment,
          it = choice.item,
          source = previous ? s.sourceStart + (s.end - s.start) * it.speed - 0.001 : s.sourceStart;
        active.push({ ...it, heldSourceTime: Math.max(it.trimIn, source), audioEnabled: false });
      }
    }
  const order = members.map((i) => i.id);
  active.sort((a, b) => order.indexOf(a.id) - order.indexOf(b.id));
  return [...(l.frameItem ? [l.frameItem] : []), ...active];
}

export function arrangeFramework(
  track: Track,
  mode: 'simultaneous' | 'sequential' = track.layout?.playback ?? 'simultaneous',
) {
  const l = track.layout;
  if (l?.version !== 2) return;
  const count = l.count ?? 1,
    oldOffsets = l.cellOffsets ?? Array.from({ length: count }, () => 0),
    oldDuration = l.duration;
  const offsets: number[] = [],
    durations = Array.from({ length: count }, (_, i) =>
      Math.max(
        0.2,
        l.cellDurations?.[i] ?? 0.2,
        ...track.items
          .filter((it) => it.templateCell === i + 1)
          .map((it) => it.start - l.start - (oldOffsets[i] ?? 0) + it.duration),
      ),
    );
  let cursor = 0;
  const order = [
    ...new Set([...(l.cellOrder ?? []), ...Array.from({ length: count }, (_, i) => i + 1)]),
  ].filter((n) => n >= 1 && n <= count);
  l.cellOrder = order;
  for (const no of order) {
    offsets[no - 1] = mode === 'sequential' ? cursor : 0;
    cursor += durations[no - 1]!;
  }
  const duration = mode === 'sequential' ? cursor : Math.max(...durations);
  for (const item of track.items) {
    if (item.templateCell) {
      const i = item.templateCell - 1;
      item.start += (offsets[i] ?? 0) - (oldOffsets[i] ?? 0);
    } else if (Math.abs(item.start - l.start) < 0.001 && Math.abs(item.duration - oldDuration) < 0.001)
      item.duration = duration;
  }
  l.playback = mode;
  l.cellOffsets = offsets;
  l.cellDurations = durations;
  l.duration = duration;
  syncTemplateFrame(track);
}

/** Deep-copy group identity and all member/lane references; source trims remain intact. */
export function cloneFramework(track: Track, delta: number): Track {
  const copy = structuredClone(track),
    ids = new Map<string, string>();
  copy.id = newId('t_');
  for (const item of templateMembers(copy)) {
    const id = newId('i_');
    ids.set(item.id, id);
    item.id = id;
    item.start += delta;
  }
  const l = copy.layout!;
  l.start += delta;
  const lanes = new Map<string, string>();
  for (const lane of l.lanes ?? []) {
    const id = newId('lane_');
    lanes.set(lane.id, id);
    lane.id = id;
  }
  for (const item of templateMembers(copy))
    if (item.templateLane) item.templateLane = lanes.get(item.templateLane);
  l.order = l.order?.map((id) => ids.get(id) ?? id);
  delete l.frameItem;
  syncTemplateFrame(copy);
  return copy;
}

export function reorderFrameworkCell(track: Track, cell: number, direction: -1 | 1) {
  const l = track.layout;
  if (l?.version !== 2 || track.locked) return;
  const count = l.count ?? 1;
  const order = [
    ...new Set([...(l.cellOrder ?? []), ...Array.from({ length: count }, (_, i) => i + 1)]),
  ].filter((n) => n >= 1 && n <= count);
  const at = order.indexOf(cell),
    to = at + direction;
  if (at < 0 || to < 0 || to >= order.length) return;
  [order[at], order[to]] = [order[to]!, order[at]!];
  l.cellOrder = order;
  arrangeFramework(track);
}
