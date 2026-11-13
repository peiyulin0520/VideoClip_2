import { evaluatedItem } from '../../engine/keyframes';
import { groupFrame, groupTransform } from '../../engine/templateGeometry';
import { Expand, Minimize, ShieldCheck } from 'lucide-react';
import { useEffect, useMemo, useRef, useState, type PointerEvent as RPointerEvent } from 'react';
import { urlFor } from '../../engine/assetUrls';
import { installDebugHook } from '../../engine/debug';
import { useFonts } from '../../fonts/fontStore';
import {
  itemBox,
  pointInBox,
  snapMove,
  SAFE_BOTTOM,
  SAFE_RIGHT,
  topHit,
  hitLayers,
} from '../../engine/geometry';
import { Player } from '../../engine/player';
import { usePreferences } from '../../store/preferences';
import { layoutMotion } from '../../engine/layouts';
import { geoCtx } from '../../engine/scene';
import { findItem, visibleLayers } from '../../engine/timeline';
import { setTransform } from '../../store/actions';
import { setAssetThumbs, useProjectStore } from '../../store/projectStore';
import { toast, useUI } from '../../store/uiStore';

// v2：改成預設關閉（舊版 'vc-safe-zone' 預設開，會讓使用者誤以為粉紅區是畫面的一部分）
const SAFE_KEY = 'lm2-safe-zone-v2';
const readSafe = () => {
  try {
    return localStorage.getItem(SAFE_KEY) === '1';
  } catch {
    return false;
  }
};

type Pt = { x: number; y: number };
type Gesture =
  | { type: 'move'; id: string; key: string; start: Pt; startX: number; startY: number; moved: boolean }
  | {
      type: 'pinch';
      id: string;
      key: string;
      startDist: number;
      startAngle: number;
      startScale: number;
      startRot: number;
    };

export function Preview({ projectId, width, height }: { projectId: string; width: number; height: number }) {
  const previewCap = usePreferences((s) => s.preview);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const poolRef = useRef<HTMLDivElement>(null);
  const stageRef = useRef<HTMLDivElement>(null);
  const [cssW, setCssW] = useState(1);
  const [expanded, setExpanded] = useState(false);
  const pageScroll = useRef(0);
  const toggleExpanded = () => {
    const page = stageRef.current?.closest<HTMLElement>('.editor');
    if (!expanded) pageScroll.current = page?.scrollTop ?? 0;
    setExpanded(!expanded);
    if (expanded && page)
      requestAnimationFrame(() => {
        page.scrollTop = pageScroll.current;
      });
  };
  const [safe, setSafe] = useState(readSafe);
  const [dragging, setDragging] = useState(false); // 拖移/縮放中：安全區參考線暫時出現
  const [guides, setGuides] = useState<{ x: number | null; y: number | null }>({ x: null, y: null });
  const [selVisible, setSelVisible] = useState(true);
  const [timelineTime, setTimelineTime] = useState(0);
  const project = useProjectStore((s) => s.project)!;
  const selectedId = useProjectStore((s) => s.selectedId);
  const player = useUI((s) => s.player);
  const liftedId = useUI((s) => s.liftedId);
  const [picker, setPicker] = useState<{ ids: string[]; x: number; y: number } | null>(null);
  const holdTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const pendingTap = useRef<{
    id: string | null;
    x: number;
    y: number;
    moved: boolean;
    held: boolean;
  } | null>(null);
  const clearHold = () => {
    if (holdTimer.current) clearTimeout(holdTimer.current);
    holdTimer.current = null;
  };
  useEffect(
    () => () => {
      if (holdTimer.current) clearTimeout(holdTimer.current);
      useUI.setState({ liftedId: null });
    },
    [],
  );
  useEffect(() => {
    player?.refresh();
  }, [liftedId, player]);
  useEffect(() => {
    if (liftedId && selectedId !== liftedId) useUI.setState({ liftedId: null });
  }, [selectedId, liftedId]);
  const fontEpoch = useFonts((s) => s.epoch); // 字體載入完成：字卡大小可能變，選取框要重算

  // ---- 建立 / 銷毀播放引擎（含 Pixi 合成器）----
  // 比例改了（寬高變了）會重建；記住舊的播放時間，重建後回到同一個位置（換專案則歸 0）
  const resumeRef = useRef<{ projectId: string; time: number } | null>(null);
  useEffect(() => {
    let cancelled = false;
    let created: Player | null = null;
    let unsub = () => {};
    void Player.create({
      host: poolRef.current!,
      canvas: canvasRef.current!,
      getProject: () => useProjectStore.getState().project,
      getLiftedId: () => useUI.getState().liftedId,
      urlFor: (id) => urlFor(projectId, id),
      onThumb: setAssetThumbs,
    }).then((player) => {
      if (cancelled) return player.destroy();
      created = player;
      useUI.setState({ player });
      const resume = resumeRef.current;
      player.seek(resume && resume.projectId === projectId ? resume.time : 0);
      const unsubProject = useProjectStore.subscribe((s, prev) => {
        if (s.project !== prev.project) player.refresh();
      });
      const unsubFonts = useFonts.subscribe((s, prev) => {
        if (s.epoch !== prev.epoch) player.refresh(); // 字體載入完成，字卡重畫
      });
      unsub = () => {
        unsubProject();
        unsubFonts();
      };
      installDebugHook(player);
    });
    return () => {
      cancelled = true;
      unsub();
      if (created) resumeRef.current = { projectId, time: created.time };
      created?.destroy();
      useUI.setState({ player: null });
    };
  }, [projectId, width, height, previewCap]); // 比例改了（寬高變了）就重建預覽引擎

  // ---- 舞台大小（CSS px）----
  useEffect(() => {
    const el = stageRef.current!;
    const ro = new ResizeObserver(() => setCssW(el.clientWidth || 1));
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  // 選取的物件目前在不在畫面上（不在就不顯示選取框）
  useEffect(() => {
    if (!player) return;
    const check = (t: number) => {
      setTimelineTime(t);
      const p = useProjectStore.getState().project;
      const id = useProjectStore.getState().selectedId;
      const f = p && findItem(p, id);
      const lifted = p && findItem(p, useUI.getState().liftedId);
      if (
        lifted &&
        (player.isPlaying || t < lifted.item.start || t >= lifted.item.start + lifted.item.duration)
      )
        useUI.setState({ liftedId: null });
      setSelVisible(!!f && t >= f.item.start && t < f.item.start + f.item.duration);
    };
    check(player.time);
    return player.subscribe(check);
  }, [player, selectedId, project]);

  const k = cssW / width; // 專案座標 → CSS px
  const geo = useMemo(() => {
    void fontEpoch; // New font metrics invalidate selection geometry.
    return {
      ...geoCtx(project, width, height, timelineTime),
      layoutMotion: layoutMotion(project.layout, timelineTime),
    };
  }, [project, width, height, fontEpoch, timelineTime]);
  const sel = findItem(project, selectedId);

  const box =
    sel && selVisible
      ? sel.track.template
        ? groupFrame(sel.track, width, height, timelineTime)
        : itemBox(sel.item, geo)
      : null;
  const editableBox = (f: NonNullable<ReturnType<typeof findItem>>) =>
    f.track.template ? groupFrame(f.track, width, height, player?.time ?? 0) : itemBox(f.item, geo);
  const selLocked = !!sel?.track.locked || !!sel?.track.hidden;

  const pointers = useRef(new Map<number, Pt>());
  const gesture = useRef<Gesture | null>(null);

  const toProj = (e: { clientX: number; clientY: number }): Pt => {
    const r = stageRef.current!.getBoundingClientRect();
    return { x: ((e.clientX - r.left) / r.width) * width, y: ((e.clientY - r.top) / r.height) * height };
  };

  const startMove = (id: string, at: Pt) => {
    const f = findItem(useProjectStore.getState().project!, id);
    if (!f) return;
    gesture.current = {
      type: 'move',
      id,
      key: `gesture:move:${id}:${performance.now()}`,
      start: at,
      startX: f.track.template
        ? groupTransform(f.track, player?.time).x
        : evaluatedItem(f.item, player?.time ?? f.item.start).transform.x,
      startY: f.track.template
        ? groupTransform(f.track, player?.time).y
        : evaluatedItem(f.item, player?.time ?? f.item.start).transform.y,
      moved: false,
    };
  };

  const onPointerDown = (e: RPointerEvent) => {
    if ((e.target as HTMLElement).closest('[data-handle]')) return;
    stageRef.current!.setPointerCapture(e.pointerId);
    const pt = toProj(e);
    pointers.current.set(e.pointerId, pt);
    const st = useProjectStore.getState();
    let cur = findItem(st.project!, st.selectedId);
    if (pointers.current.size === 2) {
      const currentBox = cur && editableBox(cur);
      if (
        !currentBox ||
        ![...pointers.current.values()].every((point) => pointInBox(currentBox, point.x, point.y))
      )
        cur = findItem(st.project!, pendingTap.current?.id ?? st.selectedId);
    }

    if (pointers.current.size === 2 && cur && !cur.track.locked && !cur.track.hidden) {
      clearHold();
      if (pendingTap.current) pendingTap.current.moved = true;
      st.select(cur.item.id);
      const [a, b] = [...pointers.current.values()] as [Pt, Pt];
      setDragging(true);
      gesture.current = {
        type: 'pinch',
        id: cur.item.id,
        key: `gesture:pinch:${cur.item.id}:${performance.now()}`,
        startDist: Math.hypot(b.x - a.x, b.y - a.y) || 1,
        startAngle: Math.atan2(b.y - a.y, b.x - a.x),
        startScale: cur.track.template
          ? groupTransform(cur.track, player?.time).scale
          : evaluatedItem(cur.item, player?.time ?? cur.item.start).transform.scale,
        startRot: cur.track.template
          ? 0
          : evaluatedItem(cur.item, player?.time ?? cur.item.start).transform.rotation,
      };
      return;
    }
    if (pointers.current.size > 1) return;

    useUI.getState().player?.pause();
    const t = useUI.getState().player?.time ?? 0;
    const layers = visibleLayers(st.project!, t).filter(
      (layer) =>
        layer.track.template || player?.opaqueAt(layer.item.id, pt.x / width, pt.y / height) !== false,
    );
    const lift = useUI.getState().liftedId;
    const liftIndex = layers.findIndex((l) => l.item.id === lift);
    if (liftIndex >= 0) layers.push(layers.splice(liftIndex, 1)[0]!);
    let hit = topHit(layers, geo, pt.x, pt.y);
    const currentBox = cur && editableBox(cur);
    if (
      cur &&
      !cur.track.locked &&
      !cur.track.hidden &&
      currentBox &&
      !hit &&
      pointInBox(
        { ...currentBox, w: Math.max(currentBox.w, 72 / k), h: Math.max(currentBox.h, 72 / k) },
        pt.x,
        pt.y,
      )
    )
      hit = cur;
    clearHold();
    const ids = hitLayers(layers, geo, pt.x, pt.y).map((l) => l.item.id);
    pendingTap.current = { id: hit?.item.id ?? null, x: e.clientX, y: e.clientY, moved: false, held: false };
    if (ids.length) {
      const wrap = stageRef.current!.parentElement!.getBoundingClientRect();
      const x = Math.max(8, Math.min(wrap.width - 288, e.clientX - wrap.left + 12));
      const y = Math.max(8, Math.min(wrap.height - 240, e.clientY - wrap.top + 12));
      holdTimer.current = setTimeout(() => {
        const pending = pendingTap.current;
        if (!pending || pending.moved || pointers.current.size !== 1) return;
        pending.held = true;
        gesture.current = null;
        st.select(ids[0]!);
        setPicker({ ids, x, y });
      }, 550);
    }
    if (!hit) {
      gesture.current = null;
      return;
    }
    if (hit.item.id !== st.selectedId) {
      if (e.pointerType === 'touch' && !expanded) return;
      st.select(hit.item.id);
    }
    startMove(hit.item.id, pt);
  };

  const onPointerMove = (e: RPointerEvent) => {
    if (!pointers.current.has(e.pointerId)) return;
    const pending = pendingTap.current;
    if (pending && Math.hypot(e.clientX - pending.x, e.clientY - pending.y) > 8) {
      pending.moved = true;
      clearHold();
    }
    const pt = toProj(e);
    pointers.current.set(e.pointerId, pt);
    const g = gesture.current;
    if (!g) return;
    const f = findItem(useProjectStore.getState().project!, g.id);
    if (!f) return;

    if (g.type === 'pinch' && pointers.current.size >= 2) {
      const [a, b] = [...pointers.current.values()] as [Pt, Pt];
      const dist = Math.hypot(b.x - a.x, b.y - a.y) || 1;
      const ang = Math.atan2(b.y - a.y, b.x - a.x);
      setTransform(
        g.id,
        {
          scale: clamp((g.startScale * dist) / g.startDist, 0.05, 10),
          rotation: g.startRot + ((ang - g.startAngle) * 180) / Math.PI,
        },
        g.key,
      );
      return;
    }
    if (g.type === 'move' && pointers.current.size === 1) {
      if (f.track.locked) return;
      const dx = pt.x - g.start.x;
      const dy = pt.y - g.start.y;
      if (!g.moved && Math.hypot(dx, dy) < 4 / k) return; // 小於 4px 當作點擊，不算移動
      g.moved = true;
      setDragging(true);
      const base = editableBox(f);
      if (!base) return;
      let cx = g.startX * width + dx;
      let cy = g.startY * height + dy;
      const snap = snapMove({ ...base, cx, cy }, width, height, 8 / k, true);
      cx += snap.dx;
      cy += snap.dy;
      setGuides({ x: snap.guideX, y: snap.guideY });
      setTransform(g.id, { x: cx / width, y: cy / height }, g.key);
    }
  };

  const onPointerUp = (e: RPointerEvent) => {
    clearHold();
    const pending = pendingTap.current;
    if (
      pointers.current.size === 1 &&
      e.type !== 'pointercancel' &&
      pending &&
      !pending.moved &&
      !pending.held
    )
      useProjectStore.getState().select(pending.id);
    pointers.current.delete(e.pointerId);
    if (pointers.current.size === 0) pendingTap.current = null;
    setGuides({ x: null, y: null });
    if (pointers.current.size === 0) setDragging(false);
    if (pointers.current.size === 0) gesture.current = null;
    else if (pointers.current.size === 1 && gesture.current?.type === 'pinch') {
      // 兩指放掉一指：剩下的那一指接著當移動
      const [pt] = [...pointers.current.values()] as [Pt];
      startMove(gesture.current.id, pt);
    }
  };

  const toggleSafe = () => {
    const v = !safe;
    setSafe(v);
    if (v) toast('粉紅虛線＝IG／抖音按鈕會蓋住的地方，重點別放這裡；匯出的影片不會有這些線');
    try {
      localStorage.setItem(SAFE_KEY, v ? '1' : '0');
    } catch {
      /* 存不了就算了 */
    }
  };

  return (
    <div className={`stage-wrap${expanded ? ' expanded-preview' : ''}`}>
      <div
        ref={stageRef}
        className="stage"
        style={{ ['--ratio' as string]: `${width} / ${height}` }}
        data-testid="stage"
        onContextMenu={(e) => e.preventDefault()}
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={onPointerUp}
        onPointerCancel={onPointerUp}
      >
        {/* key：比例改變就換一個新的 canvas（舊的 WebGL 環境被 Pixi 銷毀後不能在同一個 canvas 上重建） */}
        <canvas key={`${width}x${height}:${previewCap}`} ref={canvasRef} data-testid="preview-canvas" />
        <div ref={poolRef} className="pool" aria-hidden="true" />

        {(safe || dragging) && (
          <div className="safe" aria-hidden="true" data-testid="safe-zone">
            <div className="safe-bottom" style={{ height: `${SAFE_BOTTOM * 100}%` }}>
              <span>IG／抖音按鈕區</span>
            </div>
            <div className="safe-right" style={{ width: `${SAFE_RIGHT * 100}%` }}>
              <span>按鈕</span>
            </div>
          </div>
        )}
        {guides.x !== null && <div className="guide v" style={{ left: guides.x * k }} />}
        {guides.y !== null && <div className="guide h" style={{ top: guides.y * k }} />}

        {box && sel && (
          <div
            className={`selbox${selLocked ? ' locked' : ''}`}
            data-testid="selbox"
            style={{
              left: box.cx * k,
              top: box.cy * k,
              width: box.w * k,
              height: box.h * k,
              transform: `translate(-50%, -50%) rotate(${box.rotation}deg)`,
            }}
          />
        )}
      </div>
      {picker && (
        <div
          role="dialog"
          aria-label="選取被遮住的素材"
          className="preview-picker"
          style={{ left: picker.x, top: picker.y }}
          onPointerDown={(e) => e.stopPropagation()}
        >
          <header>
            <strong>選擇要調整的素材</strong>
            <button className="chip" onClick={() => setPicker(null)}>
              關閉
            </button>
          </header>
          {picker.ids.map((id) => {
            const found = findItem(project, id);
            if (!found) return null;
            const name =
              found.item.type === 'text'
                ? found.item.card.runs[0]?.text || '圖形'
                : project.assets.find((a) => a.id === (found.item.type !== 'text' ? found.item.assetId : ''))
                    ?.name || '影像';
            return (
              <label key={id}>
                <input
                  type="radio"
                  name="preview-layer"
                  aria-label={`暫時編輯 ${name}`}
                  checked={liftedId === id}
                  onChange={() => {
                    useProjectStore.getState().select(id);
                    useUI.setState({ liftedId: id });
                    setPicker(null);
                  }}
                />
                <span>{name}</span>
              </label>
            );
          })}
        </div>
      )}
      {liftedId && (
        <div className="preview-isolation" data-testid="preview-isolation">
          <span>暫時置頂編輯</span>
          <button
            onClick={() => {
              useUI.setState({ liftedId: null });
              setPicker(null);
            }}
          >
            完成
          </button>
        </div>
      )}
      <button
        className="preview-expand"
        aria-label={expanded ? '縮回預覽' : '放大預覽'}
        aria-pressed={expanded}
        onClick={toggleExpanded}
      >
        {expanded ? <Minimize size={18} /> : <Expand size={18} />}
        <span>{expanded ? '返回編輯' : '放大預覽'}</span>
      </button>
      {!expanded && (
        <button
          className="preview-layers"
          aria-label="查看全部圖層"
          onClick={(e) => {
            const page = e.currentTarget.closest('.editor')!,
              toggle = page.querySelector<HTMLButtonElement>('.timeline-toggle')!;
            if (toggle.getAttribute('aria-expanded') === 'false') toggle.click();
            requestAnimationFrame(() => page.querySelector('.timeline')!.scrollIntoView({ block: 'start' }));
          }}
        >
          查看圖層 ↓
        </button>
      )}
      <button
        className={`safe-toggle${safe ? ' on' : ''}`}
        aria-label="安全區參考線"
        aria-pressed={safe}
        onClick={toggleSafe}
      >
        <ShieldCheck size={18} />
        <span>安全區</span>
      </button>
    </div>
  );
}

const clamp = (v: number, lo: number, hi: number) => Math.min(Math.max(v, lo), hi);
