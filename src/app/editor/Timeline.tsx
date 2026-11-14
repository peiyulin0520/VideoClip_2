import { itemCategory, laneCategory, LANE_NAMES, type LaneCategory } from '../../engine/batchLayers';
import { BatchLayerBar } from './BatchLayerBar';
import { HoldButton } from '../../ui/HoldButton';
import { Eye, EyeOff, Film, Layers, Lock, Plus, Type, Volume2, VolumeX } from 'lucide-react';
import {
  useCallback,
  useEffect,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
  type PointerEvent as RPointerEvent,
} from 'react';
import { isVideoItem, itemEnd, totalDuration, trimEndFree, trimStartFree } from '../../engine/timeline';
import type { Asset, Item, Track, VideoItem } from '../../model/types';
import { patchTrack, dropLayerItem, removeTrack, shiftTrackLayer } from '../../store/actions';
import { useProjectStore } from '../../store/projectStore';
import { toast, useUI } from '../../store/uiStore';
import { setTimelineItems } from '../../engine/groupTiming';
import { trackFamily, itemFamily, FAMILY_LABELS, type LayerDrop } from '../../engine/layerEditing';
import { canPlace, findFreeStart } from '../../engine/timeline';
import { Sheet } from '../../ui/Sheet';
import {
  groupTimelineEffectBadges,
  timelineEffectBadges,
  type TimelineEffectBadge,
} from '../../engine/timelineEffects';
import { filmstripSegments } from '../../engine/filmstrip';
import { transitionPairs } from '../../engine/transitions';

const ROW_H = 44;
const ROW_GAP = 2;
const RULER_H = 24;
const LONG_PRESS_MS = 400;
export const MIN_PPS = 20;
export const MAX_PPS = 300;

function tickStep(pps: number): number {
  for (const s of [0.5, 1, 2, 5, 10, 30, 60, 120]) if (s * pps >= 64) return s;
  return 300;
}

function Tiles({
  item,
  asset,
  pps,
  from,
  to,
}: {
  item: VideoItem;
  asset: Asset | undefined;
  pps: number;
  from: number;
  to: number;
}) {
  if (item.type === 'image')
    return (
      <div className="tiles">
        <span
          style={{
            width: '100%',
            backgroundImage: `url(${asset?.thumbs[0] ?? ''})`,
            backgroundSize: 'auto 100%',
            backgroundRepeat: 'repeat-x',
          }}
        />
      </div>
    );
  const strip = asset?.filmstrip;
  if (!strip)
    return (
      <div className="tiles no-thumb" data-testid="clip-name">
        {asset?.name ?? ''} · 建立縮圖中
      </div>
    );
  const tiles = filmstripSegments(item, strip, from, to);
  return (
    <div className="tiles timestamped-tiles">
      {tiles.map((frame) => (
        <span
          key={frame.time}
          data-source-time={frame.time}
          data-missing={!frame.src || undefined}
          style={{
            position: 'absolute',
            left: frame.start * pps,
            width: frame.duration * pps,
            backgroundImage: frame.src ? `url(${frame.src})` : undefined,
            backgroundSize: 'auto 100%',
            backgroundRepeat: 'repeat-x',
          }}
        >
          {!frame.src && '縮圖未就緒'}
        </span>
      ))}
    </div>
  );
}

type Drag = {
  id: string;
  dx: number;
  dy: number;
  snapX: number | null;
  drop: LayerDrop;
  targetId?: string;
  insertTop?: number;
  invalid: boolean;
  label: string;
};

export function Timeline({
  pps,
  setPps,
  onAdd,
}: {
  pps: number;
  setPps: (v: number) => void;
  onAdd: (trackId?: string) => void;
}) {
  const project = useProjectStore((s) => s.project)!;
  const selectedId = useProjectStore((s) => s.selectedId);
  const player = useUI((s) => s.player);
  const scrollRef = useRef<HTMLDivElement>(null);
  const lastSet = useRef(-100);
  const half = 56;
  const [viewportWidth, setViewportWidth] = useState(360);
  const [scrollBucket, setScrollBucket] = useState(0);
  const bucketWidth = Math.max(200, viewportWidth / 2);
  const [drag, setDrag] = useState<Drag | null>(null);
  const [menuTrackId, setMenuTrackId] = useState<string | null>(null);

  const [batch, setBatch] = useState<string[]>([]);
  const [collapsed, setCollapsed] = useState<LaneCategory[]>(['visual', 'text', 'sticker', 'audio']);
  useEffect(
    () =>
      useProjectStore.subscribe((next, previous) => {
        const current = next.project;
        if (!current) return;
        const added = current.tracks.filter(
          (track) => track.items.length && !previous.project?.tracks.some((before) => before.id === track.id),
        );
        const selected =
          next.selectedId !== previous.selectedId
            ? current.tracks.find((track) => track.items.some((item) => item.id === next.selectedId))
            : undefined;
        const categories = new Set(
          [...added, ...(selected ? [selected] : [])].map((track) => laneCategory(track, current)),
        );
        if (categories.size) setCollapsed((before) => before.filter((category) => !categories.has(category)));
      }),
    [],
  );
  const total = totalDuration(project);
  const badges = useMemo(() => timelineEffectBadges(project), [project]);
  const [badgeChoice, setBadgeChoice] = useState<TimelineEffectBadge[] | null>(null);
  const badgeScope = (badge: TimelineEffectBadge) =>
    badge.kind === 'pair' ? '銜接' : badge.kind === 'screen' ? '畫面' : '單素材';
  const openBadge = (badge: TimelineEffectBadge, request: number) => {
    player?.pause();
    player?.seek(badge.time);
    if (badge.kind === 'pair' && badge.toId)
      useUI.setState({
        effectsSingle: null,
        effectsJoin: { fromId: badge.itemId, toId: badge.toId, request },
      });
    else
      useUI.setState({
        effectsJoin: null,
        effectsSingle: {
          id: badge.itemId,
          edge: badge.edge ?? 'enter',
          mode: badge.effectId ? 'effect' : 'transition',
          effectId: badge.effectId,
          request,
        },
      });
  };
  const badgeButton = (group: TimelineEffectBadge[]) => {
    const badge = group[0]!,
      scope = group.every((b) => b.kind === badge.kind) ? badge.kind : 'mixed';
    const glyphs = group.flatMap((b) => b.symbols.map((symbol) => ({ symbol, kind: b.kind })));
    return (
      <button
        key={group.map((b) => b.id).join('|')}
        className={`timeline-effect-badge ${scope}`}
        data-testid="timeline-effect-badge"
        data-time={badge.time}
        data-scope={scope}
        aria-label={`${group.map((b) => `${badgeScope(b)}特效 ${b.names.join('、')}`).join('、')} ${badge.time.toFixed(2)}秒`}
        title={group.flatMap((b) => b.names).join('、')}
        style={{ left: half + badge.time * pps }}
        onPointerDown={(e) => e.stopPropagation()}
        onClick={(e) => {
          e.stopPropagation();
          player?.pause();
          player?.seek(badge.time);
          if (group.length === 1) openBadge(badge, performance.now());
          else setBadgeChoice(group);
        }}
      >
        {glyphs.slice(0, 3).map((g, i) => (
          <span key={i} data-scope={g.kind} aria-hidden="true">
            {g.symbol}
          </span>
        ))}
        {glyphs.length > 3 && <span aria-hidden="true">+{glyphs.length - 3}</span>}
      </button>
    );
  };

  // Track array is bottom-to-top; every media lane can occupy any stack position.
  const rowLayout = useMemo(() => {
    const rows: { track: Track; index: number; top: number; h: number }[] = [];
    const groups: { category: LaneCategory; top: number; tracks: Track[] }[] = [];
    let top = RULER_H + ROW_GAP;
    for (const { track, index } of project.tracks.map((track, index) => ({ track, index })).reverse()) {
      const category = laneCategory(track, project);
      if (!groups.some((g) => g.category === category)) {
        groups.push({
          category,
          top,
          tracks: project.tracks.filter((t) => laneCategory(t, project) === category),
        });
        top += ROW_H + ROW_GAP;
      }
      if (!collapsed.includes(category)) {
        rows.push({ track, index, top, h: ROW_H });
        top += ROW_H + ROW_GAP;
      }
    }
    return { rows, groups, contentH: top + 24 };
  }, [project, collapsed]);
  const { rows, groups, contentH } = rowLayout;

  useLayoutEffect(() => {
    const el = scrollRef.current!;
    const ro = new ResizeObserver(() => setViewportWidth(el.clientWidth));
    ro.observe(el);
    setViewportWidth(el.clientWidth);
    return () => ro.disconnect();
  }, []);

  const syncScroll = useCallback(
    (t: number) => {
      const el = scrollRef.current;
      if (!el) return;
      const target = t * pps;
      if (Math.abs(el.scrollLeft - target) >= 0.5) {
        lastSet.current = target;
        el.scrollLeft = target;
      }
      // Zoom/seek must refresh the visible images before paint, not a later scroll event.
      setScrollBucket(Math.floor(el.scrollLeft / bucketWidth));
    },
    [pps, bucketWidth],
  );

  useLayoutEffect(() => {
    if (player) syncScroll(player.time);
  }, [player, total, pps, half, viewportWidth, syncScroll]);

  useEffect(() => {
    if (!player) return;
    return player.subscribe((t) => syncScroll(t));
  }, [player, syncScroll]);

  // All rows participate in the editor page flow; selecting/editing must not scroll fields away.

  const onScroll = () => {
    const el = scrollRef.current!;
    setScrollBucket(Math.floor(el.scrollLeft / bucketWidth));
    const programmatic = Math.abs(el.scrollLeft - lastSet.current) < 1.5;
    lastSet.current = -100;
    if (drag || programmatic) return;
    player?.seek(el.scrollLeft / pps);
  };

  // 雙指縮放時間軸
  useEffect(() => {
    const el = scrollRef.current!;
    let startDist = 0;
    let startPps = pps;
    const dist = (e: TouchEvent) =>
      Math.hypot(
        e.touches[0]!.clientX - e.touches[1]!.clientX,
        e.touches[0]!.clientY - e.touches[1]!.clientY,
      );
    const onStart = (e: TouchEvent) => {
      if (e.touches.length === 2) {
        startDist = dist(e);
        startPps = pps;
      }
    };
    const onMove = (e: TouchEvent) => {
      if (e.touches.length === 2 && startDist > 0) {
        e.preventDefault();
        setPps(Math.min(Math.max((startPps * dist(e)) / startDist, MIN_PPS), MAX_PPS));
      }
    };
    const onEnd = () => (startDist = 0);
    const onWheel = (e: WheelEvent) => {
      if (e.ctrlKey || e.metaKey) {
        e.preventDefault();
        setPps(Math.min(Math.max(pps * (e.deltaY < 0 ? 1.15 : 0.87), MIN_PPS), MAX_PPS));
      }
    };
    el.addEventListener('touchstart', onStart, { passive: true });
    el.addEventListener('touchmove', onMove, { passive: false });
    el.addEventListener('touchend', onEnd);
    el.addEventListener('wheel', onWheel, { passive: false });
    return () => {
      el.removeEventListener('touchstart', onStart);
      el.removeEventListener('touchmove', onMove);
      el.removeEventListener('touchend', onEnd);
      el.removeEventListener('wheel', onWheel);
    };
  }, [pps, setPps]);

  // A held clip moves independently across compatible lanes and time positions.
  const startItemGesture = (e: RPointerEvent, item: Item, track: Track) => {
    if (drag || (e.pointerType === 'mouse' && e.button !== 0)) return;
    e.stopPropagation();
    const startX = e.clientX,
      startY = e.clientY;
    const startScroll = scrollRef.current!.scrollLeft;
    const startPageScroll = scrollRef.current!.closest<HTMLElement>('.editor')!.scrollTop;
    let mode: 'pending' | 'drag' | 'cancelled' = 'pending';
    let last: Drag | null = null;
    player?.pause();
    const blockScroll = (ev: TouchEvent) => ev.cancelable && ev.preventDefault();
    const resolve = (ev: PointerEvent): Drag => {
      const el = scrollRef.current!,
        page = el.closest<HTMLElement>('.editor')!;
      const bounds = page.getBoundingClientRect(),
        header = page.querySelector('.ed-top')!.getBoundingClientRect();
      if (ev.clientY < header.bottom + 12) page.scrollTop -= 12;
      else if (ev.clientY > bounds.bottom - 12) page.scrollTop += 12;
      const horizontal = el.getBoundingClientRect();
      if (ev.clientX > horizontal.right - 12) el.scrollLeft += 8;
      else if (ev.clientX < horizontal.left + 12) el.scrollLeft -= 8;
      const dx = ev.clientX - startX + el.scrollLeft - startScroll;
      let desired = Math.max(0, item.start + dx / pps),
        snapX: number | null = null;
      let distance = 8 / pps;
      const points = [
        0,
        player?.time ?? 0,
        ...project.tracks.flatMap((tr) =>
          tr.items.filter((it) => it.id !== item.id).flatMap((it) => [it.start, itemEnd(it)]),
        ),
      ];
      for (const point of points) {
        for (const edge of [desired, desired + item.duration]) {
          const offset = point - edge;
          if (Math.abs(offset) < distance && desired + offset >= 0) {
            desired += offset;
            distance = Math.abs(offset);
            snapX = point;
          }
        }
      }
      let drop: LayerDrop = { trackId: track.id },
        targetId: string | undefined = track.id;
      let insertTop: number | undefined;
      if (Math.abs(ev.clientY - startY) > 16) {
        const candidates = rows.map((row) => ({
          ...row,
          rect: el.querySelector(`[data-track-id="${row.track.id}"]`)!.getBoundingClientRect(),
        }));
        const first = candidates[0]!,
          last = candidates[candidates.length - 1]!;
        const over = candidates.find(
          (row) => ev.clientY >= row.rect.top - ROW_GAP && ev.clientY <= row.rect.bottom,
        );
        if (ev.clientY < first.rect.top || ev.clientY > last.rect.bottom) {
          const above = ev.clientY < first.rect.top;
          drop = { insertAt: above ? project.tracks.length : 0 };
          insertTop = above ? RULER_H + 1 : contentH - 6;
          targetId = undefined;
        } else if (over) {
          const above = ev.clientY < over.rect.top + 7,
            below = ev.clientY > over.rect.bottom - 7;
          if (above || below) {
            drop = { insertAt: over.index + (above ? 1 : 0) };
            insertTop = over.top + (above ? -1 : over.h + 1);
            targetId = undefined;
          } else {
            drop = { trackId: over.track.id };
            targetId = over.track.id;
          }
        }
      }
      const destination = targetId ? project.tracks.find((tr) => tr.id === targetId) : undefined;
      if (destination === track && !track.template)
        desired = findFreeStart(track.items, desired, item.duration, item.id);
      const invalid =
        !!destination &&
        (destination.locked ||
          itemFamily(item) !== trackFamily(destination) ||
          (!!destination.items.length &&
            itemCategory(item, project) !== laneCategory(destination, project)) ||
          (destination !== track &&
            (destination.template ||
              track.template ||
              !canPlace(destination.items, desired, item.duration))));
      return {
        id: item.id,
        dx: (desired - item.start) * pps,
        dy: ev.clientY - startY + page.scrollTop - startPageScroll,
        snapX,
        drop,
        targetId,
        insertTop,
        invalid,
        label: invalid
          ? '此處不能放置：請選同類型的空位，或拖到圖層之間'
          : `${targetId ? '移入' : '新增'}${FAMILY_LABELS[itemFamily(item)]}層 · ${desired.toFixed(1)} 秒`,
      };
    };
    const timer = setTimeout(() => {
      if (mode !== 'pending' || track.locked) return;
      mode = 'drag';
      window.addEventListener('touchmove', blockScroll, { passive: false });
      useProjectStore.getState().select(item.id);
      last = {
        id: item.id,
        dx: 0,
        dy: 0,
        snapX: null,
        drop: { trackId: track.id },
        targetId: track.id,
        invalid: false,
        label: '拖曳調整時間與圖層',
      };
      setDrag(last);
      navigator.vibrate?.(15);
    }, LONG_PRESS_MS);
    const move = (ev: PointerEvent) => {
      if (ev.pointerId !== e.pointerId) return;
      if (mode === 'pending' && Math.hypot(ev.clientX - startX, ev.clientY - startY) > 8) {
        mode = 'cancelled';
        clearTimeout(timer);
      }
      if (mode !== 'drag') return;
      last = resolve(ev);
      setDrag(last);
    };
    const finish = (_ev: PointerEvent, cancelled: boolean) => {
      clearTimeout(timer);
      window.removeEventListener('pointermove', move);
      window.removeEventListener('pointerup', up);
      window.removeEventListener('pointercancel', cancel);
      window.removeEventListener('touchmove', blockScroll);
      if (mode === 'pending' && !cancelled) {
        useProjectStore.getState().select(item.id);
        player?.seek(Math.max(item.start, Math.min(player.time, itemEnd(item) - 0.01)));
      } else if (mode === 'drag') {
        setDrag(null);
        if (!cancelled && last) {
          if (last.invalid) return toast(last.label);
          try {
            dropLayerItem(item.id, item.start + last.dx / pps, last.drop);
          } catch (error) {
            toast((error as Error).message);
          }
        }
      }
    };
    const up = (ev: PointerEvent) => {
        if (ev.pointerId === e.pointerId) finish(ev, false);
      },
      cancel = (ev: PointerEvent) => {
        if (ev.pointerId === e.pointerId) finish(ev, true);
      };
    window.addEventListener('pointermove', move);
    window.addEventListener('pointerup', up);
    window.addEventListener('pointercancel', cancel);
  };

  // ---- 修剪把手 ----
  const startTrim = (e: RPointerEvent, item: Item, track: Track, side: 'start' | 'end') => {
    e.stopPropagation();
    e.preventDefault();
    player?.pause();
    const startX = e.clientX;
    const startItems = track.items;
    const asset = isVideoItem(item) ? project.assets.find((a) => a.id === item.assetId) : undefined;
    const trimKey = `gesture:trim:${item.id}:${e.timeStamp}:${e.pointerId}`;
    const target = e.currentTarget as HTMLElement;
    target.setPointerCapture(e.pointerId);
    const move = (ev: PointerEvent) => {
      const delta = (ev.clientX - startX) / pps;
      const next =
        side === 'start'
          ? trimStartFree(startItems, item.id, delta)
          : trimEndFree(startItems, item.id, item.duration + delta, asset);
      useProjectStore.getState().apply((d) => setTimelineItems(d, track.id, next), { coalesce: trimKey });
      const cur = next.find((x) => x.id === item.id)!;
      player?.peek(side === 'start' ? cur.start : cur.start + cur.duration - 0.05);
    };
    const up = () => {
      target.removeEventListener('pointermove', move);
      target.removeEventListener('pointerup', up);
      target.removeEventListener('pointercancel', up);
      player?.refresh();
    };
    target.addEventListener('pointermove', move);
    target.addEventListener('pointerup', up);
    target.addEventListener('pointercancel', up);
  };

  const ticks: number[] = [];
  const step = tickStep(pps);
  for (let t = 0; t <= total + 1e-6; t += step) ticks.push(t);

  const menuTrack = project.tracks.find((t) => t.id === menuTrackId) ?? null;
  const menuIndex = menuTrack ? project.tracks.indexOf(menuTrack) : -1;
  const viewH = Math.max(contentH, 106);

  return (
    <>
      <Sheet
        open={!!badgeChoice}
        title="此秒數的特效"
        className="effect-badge-choices"
        onClose={() => setBadgeChoice(null)}
      >
        {badgeChoice?.map((b) => {
          const item = project.tracks.flatMap((t) => t.items).find((it) => it.id === b.itemId);
          const name =
            item?.name ||
            (item && 'assetId' in item ? project.assets.find((a) => a.id === item.assetId)?.name : '素材');
          return (
            <button
              className="btn"
              key={b.id}
              onClick={() => {
                openBadge(b, performance.now());
                setBadgeChoice(null);
              }}
            >
              {badgeScope(b)}特效 · {name} · {b.names.join('、')}
            </button>
          );
        })}
      </Sheet>
      {!!batch.length && <BatchLayerBar ids={batch} onChange={setBatch} />}
      <div className="timeline" style={{ height: viewH }} onContextMenu={(event) => event.preventDefault()}>
        <div
          className="tl-scroll"
          ref={scrollRef}
          onScroll={onScroll}
          onPointerDown={() => player?.pause()}
          onClick={(e) => {
            if (e.target === e.currentTarget || (e.target as HTMLElement).dataset.bg)
              useProjectStore.getState().select(null);
          }}
          data-testid="timeline-scroll"
        >
          <div
            className="tl-content"
            data-bg="1"
            style={{ width: viewportWidth + total * pps, height: contentH }}
          >
            <div className="ruler" style={{ height: RULER_H }}>
              {ticks.map((t) => (
                <span key={t} className="tick" style={{ left: half + t * pps }}>
                  {Math.floor(t / 60)}:{String(Math.round(t % 60)).padStart(2, '0')}
                </span>
              ))}
            </div>

            {groups.map(({ category, top, tracks }) => (
              <div key={category} className="family-row" style={{ top, height: ROW_H }}>
                <button
                  className="family-toggle"
                  aria-label={`${collapsed.includes(category) ? '展開' : '收合'}${LANE_NAMES[category]}群組`}
                  aria-expanded={!collapsed.includes(category)}
                  onClick={() =>
                    setCollapsed((before) =>
                      before.includes(category)
                        ? before.filter((c) => c !== category)
                        : [...before, category],
                    )
                  }
                >
                  {collapsed.includes(category) ? '▸' : '▾'} {LANE_NAMES[category]}
                  <small>
                    ×{tracks.length}
                    {tracks.some((t) => t.hidden) ? ` · ${tracks.filter((t) => t.hidden).length} 隱藏` : ''}
                  </small>
                </button>
                {collapsed.includes(category) &&
                  groupTimelineEffectBadges(
                    badges.filter((b) => tracks.some((t) => t.id === b.trackId)),
                    true,
                  ).map(badgeButton)}
                {collapsed.includes(category) &&
                  tracks.flatMap((tr) =>
                    tr.items.map((it) => (
                      <span
                        key={it.id}
                        className={`family-summary${tr.hidden ? ' off' : ''}`}
                        style={{ left: half + it.start * pps, width: Math.max(3, it.duration * pps) }}
                      />
                    )),
                  )}
              </div>
            ))}
            {rows.map(({ track, top, h }) => (
              <div
                key={track.id}
                className={`track${track.hidden ? ' off' : ''}${drag?.targetId === track.id ? (drag.invalid ? ' drop-invalid' : ' layer-drop') : ''}`}
                data-testid="track"
                data-kind={track.kind}
                data-track-id={track.id}
                data-bg="1"
                style={{ top, height: h }}
              >
                <HoldButton
                  className={`track-chip${batch.includes(track.id) ? ' batch-selected' : ''}`}
                  aria-pressed={batch.includes(track.id)}
                  onHold={() => {
                    setBatch((ids) => (ids.includes(track.id) ? ids : [...ids, track.id]));
                    setMenuTrackId(null);
                  }}
                  aria-label={`${track.name} 軌道設定`}
                  data-testid="track-chip"
                  title="點選開啟軌道設定"
                  onClick={() => {
                    if (batch.length)
                      setBatch((ids) =>
                        ids.includes(track.id) ? ids.filter((id) => id !== track.id) : [...ids, track.id],
                      );
                    else setMenuTrackId(track.id);
                  }}
                >
                  {track.kind === 'main' || track.kind === 'overlay' ? (
                    <Film size={16} />
                  ) : track.kind === 'text' ? (
                    <Type size={16} />
                  ) : (
                    <Layers size={16} />
                  )}
                  {track.locked ? (
                    <Lock size={11} />
                  ) : track.hidden ? (
                    <EyeOff size={11} />
                  ) : track.muted ? (
                    <VolumeX size={11} />
                  ) : null}
                </HoldButton>

                {!project.flexibleLayers && track.kind === 'main' && (project.mainOffset ?? 0) > 0 && (
                  <div
                    className="intro-gap"
                    data-testid="intro-gap"
                    style={{
                      left: half,
                      width: project.mainOffset! * pps,
                      height: h,
                      background: project.background ?? '#000000',
                      color: project.background === '#ffffff' ? '#111' : '#fff',
                    }}
                  >
                    開場 {project.mainOffset}s
                  </div>
                )}
                {groupTimelineEffectBadges(badges.filter((b) => b.trackId === track.id)).map(badgeButton)}
                {transitionPairs(project)
                  .filter((pair) => pair.track.id === track.id)
                  .map((pair) => (
                    <button
                      key={pair.from.id}
                      className="transition-join"
                      aria-label={`新增轉場 ${pair.from.name ?? project.assets.find((a) => a.id === ('assetId' in pair.from ? pair.from.assetId : ''))?.name ?? 'A'} 到 ${pair.to.name ?? project.assets.find((a) => a.id === ('assetId' in pair.to ? pair.to.assetId : ''))?.name ?? 'B'}`}
                      style={{ left: half + pair.to.start * pps, top: h + 1 }}
                      onPointerDown={(e) => e.stopPropagation()}
                      onClick={(e) => {
                        e.stopPropagation();
                        player?.pause();
                        player?.seek(pair.to.start);
                        useUI.setState({
                          effectsSingle: null,
                          effectsJoin: { fromId: pair.from.id, toId: pair.to.id, request: performance.now() },
                        });
                      }}
                    >
                      <Plus size={14} />
                    </button>
                  ))}
                {(track.template ? track.items.slice(0, 1) : track.items).map((it) => {
                  const asset = isVideoItem(it) ? project.assets.find((a) => a.id === it.assetId) : undefined;
                  const selected =
                    it.id === selectedId ||
                    !!(track.template && track.items.some((x) => x.id === selectedId));
                  const dragging = drag?.id === it.id;
                  const dx = dragging ? drag!.dx : 0;
                  return (
                    <div
                      key={it.id}
                      className={`clip${selected ? ' selected' : ''}${dragging ? ' dragging' : ''}${it.type === 'text' ? ' is-text' : it.type === 'audio' ? ' is-audio' : ''}${it.duration * pps < 80 ? ' short' : ''}`}
                      data-testid="clip"
                      data-selected={selected}
                      data-item-id={it.id}
                      data-kind={it.type}
                      role="button"
                      tabIndex={0}
                      aria-label={`選取${it.name ?? (it.type === 'text' ? '文字' : (asset?.name ?? '素材'))}`}
                      onClick={(e) => e.stopPropagation()}
                      onKeyDown={(e) => {
                        if (e.target !== e.currentTarget) return;
                        if (e.key === 'Enter' || e.key === ' ') {
                          e.preventDefault();
                          useProjectStore.getState().select(it.id);
                          player?.pause();
                          player?.seek(Math.max(it.start, Math.min(player.time, itemEnd(it) - 0.01)));
                        }
                      }}
                      style={{
                        left: half + it.start * pps,
                        width: Math.max(it.duration * pps, 4),
                        transform: dragging ? `translate(${dx}px, ${drag!.dy}px)` : undefined,
                      }}
                      onPointerDown={(e) => startItemGesture(e, it, track)}
                    >
                      {isVideoItem(it) ? (
                        <Tiles
                          item={it}
                          asset={asset}
                          pps={pps}
                          from={(scrollBucket * bucketWidth - half - it.start * pps - viewportWidth) / pps}
                          to={
                            (scrollBucket * bucketWidth +
                              bucketWidth +
                              2 * viewportWidth -
                              half -
                              it.start * pps) /
                            pps
                          }
                        />
                      ) : null}
                      <div className="clip-label">
                        {it.name
                          ? `${it.name} · ${it.duration.toFixed(1)}s`
                          : track.template
                            ? `${track.name} · ${track.items.length} 格`
                            : it.type === 'text'
                              ? it.card.runs[0]?.text === ''
                                ? '圖形'
                                : `Aa ${it.card.runs[0]?.text.replace(/\n/g, ' ') ?? ''}`
                              : `${asset?.generated ? '留白' : (asset?.name ?? (it.type === 'audio' ? '♫ 音訊' : '素材'))} ${it.duration.toFixed(1)}s`}
                        {isVideoItem(it) && it.speed !== 1 && ` · ${it.speed}x`}
                        {isVideoItem(it) && it.type === 'video' && it.volume === 0 && ' · 靜音'}
                      </div>
                      {(track.template ? track.layout?.keyframes : it.keyframes)?.map((frame, i) => (
                        <button
                          key={frame.time}
                          className="timeline-keyframe"
                          aria-label={`第${i + 1}個定格 ${frame.time.toFixed(2)}秒`}
                          style={{ left: Math.min(it.duration * pps - 4, frame.time * pps) }}
                          onPointerDown={(e) => e.stopPropagation()}
                          onClick={(e) => {
                            e.stopPropagation();
                            useProjectStore.getState().select(it.id);
                            player?.seek(it.start + Math.min(it.duration - 0.001, frame.time));
                          }}
                        >
                          ◆
                        </button>
                      ))}
                      {asset?.hasAudio && it.type === 'video' && (
                        <div className="clip-audio">
                          {it.audioEnabled === false || it.volume === 0 || track.muted
                            ? '原音已關閉'
                            : '♫ 原音'}
                        </div>
                      )}
                      {selected && !dragging && !track.locked && (
                        <>
                          <div
                            className="handle left"
                            data-testid="trim-start"
                            onPointerDown={(e) => startTrim(e, it, track, 'start')}
                          />
                          <div
                            className="handle right"
                            data-testid="trim-end"
                            onPointerDown={(e) => startTrim(e, it, track, 'end')}
                          />
                        </>
                      )}
                    </div>
                  );
                })}

                {trackFamily(track) === 'visual' && !track.template && (
                  <>
                    <button
                      className="add-clip"
                      aria-label="加入素材"
                      style={{ left: half + Math.max(0, ...track.items.map(itemEnd)) * pps + 8 }}
                      onClick={() => onAdd(track.id)}
                      onPointerDown={(e) => e.stopPropagation()}
                    >
                      <Plus size={22} />
                    </button>
                  </>
                )}
              </div>
            ))}
            {drag && (
              <div
                className={`item-drop-hint${drag.invalid ? ' invalid' : ''}`}
                role="status"
                data-testid="item-drop-hint"
                data-valid={!drag.invalid}
                style={{
                  top: drag.insertTop ?? rows.find((row) => row.track.id === drag.targetId)?.top ?? RULER_H,
                }}
              >
                {drag.label}
              </div>
            )}
            {drag && drag.snapX !== null && (
              <div className="snap-line" style={{ left: half + drag.snapX * pps }} />
            )}
          </div>
        </div>
        <div className="playhead" />

        <Sheet open={!!menuTrack} title={menuTrack?.name ?? ''} onClose={() => setMenuTrackId(null)}>
          {menuTrack && (
            <>
              <label className="field">
                圖層名稱
                <input
                  aria-label="圖層名稱"
                  defaultValue={menuTrack.name}
                  onBlur={(e) => {
                    const name = e.target.value.trim();
                    if (name) patchTrack(menuTrack.id, { name });
                  }}
                />
              </label>
              <button
                className="menu-item"
                onClick={() => {
                  setBatch([menuTrack.id]);
                  setMenuTrackId(null);
                }}
              >
                開始多選圖層
              </button>
              <button
                className="menu-item"
                onClick={() => {
                  patchTrack(menuTrack.id, { hidden: !menuTrack.hidden });
                  setMenuTrackId(null);
                }}
              >
                {menuTrack.hidden ? <Eye size={20} /> : <EyeOff size={20} />}
                {menuTrack.hidden ? '顯示這條軌道' : '隱藏這條軌道'}
              </button>
              <button
                className="menu-item"
                onClick={() => {
                  patchTrack(menuTrack.id, { locked: !menuTrack.locked });
                  setMenuTrackId(null);
                }}
              >
                <Lock size={20} /> {menuTrack.locked ? '解除鎖定' : '鎖定（不能選取、移動）'}
              </button>
              {menuTrack.kind !== 'text' && (
                <button
                  className="menu-item"
                  onClick={() => {
                    patchTrack(menuTrack.id, { muted: !menuTrack.muted });
                    setMenuTrackId(null);
                  }}
                >
                  {menuTrack.muted ? <Volume2 size={20} /> : <VolumeX size={20} />}
                  {menuTrack.muted ? '取消靜音' : '這條軌道靜音'}
                </button>
              )}
              {menuTrack && (
                <>
                  <button
                    className="menu-item"
                    onClick={() => {
                      if (menuIndex >= project.tracks.length - 1) toast('已經在最上層');
                      else shiftTrackLayer(menuTrack.id, 1);
                      setMenuTrackId(null);
                    }}
                  >
                    ▲ 往上一層
                  </button>
                  <button
                    className="menu-item"
                    onClick={() => {
                      if (menuIndex <= 0) toast('已經在最下層');
                      else shiftTrackLayer(menuTrack.id, -1);
                      setMenuTrackId(null);
                    }}
                  >
                    ▼ 往下一層
                  </button>
                  <button
                    className="menu-item danger"
                    onClick={() => {
                      removeTrack(menuTrack.id);
                      setMenuTrackId(null);
                    }}
                  >
                    刪除這條軌道（含裡面的物件）
                  </button>
                </>
              )}
            </>
          )}
        </Sheet>
      </div>
    </>
  );
}
