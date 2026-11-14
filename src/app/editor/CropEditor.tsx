import { MediaPlayback } from '../../ui/MediaPlayback';
import { useEffect, useRef, useState, type PointerEvent } from 'react';
import { Undo2, Redo2, ZoomIn, ZoomOut } from 'lucide-react';
import { paintMask } from '../../engine/mediaMask';
import type { VideoItem, Crop, MediaMask } from '../../model/types';
import { useProjectStore } from '../../store/projectStore';
import { useUI } from '../../store/uiStore';
import { editItem } from '../../store/actions';
import { previewUrlFor as urlFor } from '../../engine/assetUrls';
import { sourceTimeAt } from '../../engine/timeline';
import { Sheet } from '../../ui/Sheet';
import { Slider } from '../../ui/Slider';
import { cropPointer } from '../../engine/cropPointer';
import { useDraftHistory } from '../../ui/useDraftHistory';

/** Persistent canvas: no data URLs, CSS mask replacement, pixel readback or decoder remounts. */
export function CropEditor({ item, onClose }: { item: VideoItem; onClose: () => void }) {
  const video = useRef<HTMLVideoElement>(null),
    image = useRef<HTMLImageElement>(null),
    canvas = useRef<HTMLCanvasElement>(null),
    maskCanvas = useRef<HTMLCanvasElement | null>(null),
    content = useRef<HTMLDivElement>(null);
  const project = useProjectStore((s) => s.project)!,
    asset = project.assets.find((a) => a.id === item.assetId)!;
  const history = useDraftHistory<{ crop: Crop; mask: MediaMask }>({
    crop: item.crop ?? { l: 0, t: 0, r: 0, b: 0 },
    mask: item.mask ?? { points: [], strokes: [] },
  });
  const { crop, mask } = history.value;
  const [mode, setMode] = useState<'crop' | 'lasso' | 'keep' | 'erase'>('crop');
  const [preview, setPreview] = useState(false),
    [brushSize, setBrushSize] = useState(8),
    [offset, setOffset] = useState(56),
    [zoom, setZoom] = useState(1),
    [pan, setPan] = useState({ x: 0, y: 0 });
  const drawing = useRef(false),
    pointers = useRef(new Map<number, { x: number; y: number }>()),
    gesture = useRef<{
      distance: number;
      zoom: number;
      x: number;
      y: number;
      pan: { x: number; y: number };
    } | null>(null);
  const [aim, setAim] = useState<(ReturnType<typeof cropPointer> & { width: number; height: number }) | null>(
    null,
  );
  const [ready, setReady] = useState(0);
  const ratio = asset.width / asset.height;
  useEffect(() => {
    const c = canvas.current;
    if (!c) return;
    const cap = 720 * Math.min(zoom, 3);
    const w = Math.min(asset.width, cap, cap * ratio),
      h = Math.max(1, Math.round(w / ratio));
    if (c.width !== w || c.height !== h) {
      c.width = w;
      c.height = h;
    }
    const m = (maskCanvas.current ??= document.createElement('canvas'));
    if (m.width !== w || m.height !== h) {
      m.width = w;
      m.height = h;
    }
    paintMask(m.getContext('2d')!, mask, w, h);
    const ctx = c.getContext('2d')!;
    let raf = 0,
      last = -Infinity;
    const draw = (now: number) => {
      if (now - last >= 30 || video.current?.paused !== false) {
        last = now;
        ctx.clearRect(0, 0, w, h);
        const source = video.current ?? image.current;
        if (
          source &&
          (source instanceof HTMLImageElement
            ? source.complete && source.naturalWidth > 0
            : source.readyState >= 2)
        ) {
          ctx.drawImage(source, 0, 0, w, h);
          ctx.globalCompositeOperation = 'destination-in';
          ctx.drawImage(m, 0, 0);
          ctx.globalCompositeOperation = 'source-over';
          if (preview) {
            ctx.clearRect(0, 0, w, crop.t * h);
            ctx.clearRect(0, (1 - crop.b) * h, w, crop.b * h);
            ctx.clearRect(0, 0, crop.l * w, h);
            ctx.clearRect((1 - crop.r) * w, 0, crop.r * w, h);
          }
        }
      }
      if (video.current && !video.current.paused) raf = requestAnimationFrame(draw);
    };
    const element = video.current;
    const schedule = () => {
      cancelAnimationFrame(raf);
      last = -Infinity;
      raf = requestAnimationFrame(draw);
    };
    element?.addEventListener('play', schedule);
    element?.addEventListener('seeked', schedule);
    element?.addEventListener('loadeddata', schedule);
    schedule();
    return () => {
      cancelAnimationFrame(raf);
      element?.removeEventListener('play', schedule);
      element?.removeEventListener('seeked', schedule);
      element?.removeEventListener('loadeddata', schedule);
    };
  }, [mask, crop, preview, ready, asset.width, ratio, zoom]);
  const point = (e: PointerEvent<HTMLElement | SVGSVGElement>): [number, number] =>
    cropPointer(
      e.clientX,
      e.clientY,
      e.currentTarget.closest('.crop-stage')!.getBoundingClientRect(),
      mode === 'crop' ? 0 : offset,
    ).target;
  const change = (patch: Partial<Crop>) => history.set((v) => ({ ...v, crop: { ...v.crop, ...patch } }));
  const finish = () => {
    drawing.current = false;
    setAim(null);
    history.end();
  };
  const apply = () => {
    editItem(item.id, (it) => {
      if (it.type === 'text') return;
      it.crop = crop;
      if (mask.points.length >= 3 || mask.strokes?.length) it.mask = mask;
      else delete it.mask;
    });
    onClose();
  };
  const dragCorner = (corner: string, e: PointerEvent<HTMLButtonElement>) => {
    const [x, y] = point(e),
      patch: Partial<Crop> = {};
    if (corner.includes('l')) patch.l = Math.min(x, 0.95 - crop.r);
    if (corner.includes('r')) patch.r = Math.min(1 - x, 0.95 - crop.l);
    if (corner.includes('t')) patch.t = Math.min(y, 0.95 - crop.b);
    if (corner.includes('b')) patch.b = Math.min(1 - y, 0.95 - crop.t);
    change(patch);
  };
  return (
    <Sheet open title="裁切／手動去背" onClose={onClose}>
      <div className="crop-tools">
        {(
          [
            ['crop', '一般裁切'],
            ['lasso', '自由裁切'],
            ['keep', '筆刷'],
            ['erase', '橡皮擦'],
          ] as const
        ).map(([key, label]) => (
          <button
            key={key}
            className={`chip${mode === key ? ' active' : ''}`}
            aria-pressed={mode === key}
            onClick={() => {
              finish();
              setMode(key);
              setPreview(false);
            }}
          >
            {label}
          </button>
        ))}
      </div>
      <div className="crop-actions">
        {item.type === 'video' && <MediaPlayback media={video} label="裁切預覽" />}
        <button className="icon-btn" aria-label="undo" disabled={!history.canUndo} onClick={history.undo}>
          <Undo2 size={18} />
        </button>
        <button className="icon-btn" aria-label="redo" disabled={!history.canRedo} onClick={history.redo}>
          <Redo2 size={18} />
        </button>
        <button
          className={`chip${preview ? ' active' : ''}`}
          aria-pressed={preview}
          onClick={() => setPreview(!preview)}
        >
          {preview ? '繼續調整裁切' : '檢查裁切結果'}
        </button>
        <button className="chip primary" onClick={apply}>
          套用裁切
        </button>
      </div>
      <div className="crop-zoom-controls">
        <button
          className="icon-btn"
          aria-label="縮小裁切預覽"
          onClick={() => {
            const next = Math.max(1, zoom / 1.25);
            setZoom(next);
            if (next === 1) setPan({ x: 0, y: 0 });
          }}
        >
          <ZoomOut size={18} />
        </button>
        <span>{Math.round(zoom * 100)}%</span>
        <button
          className="icon-btn"
          aria-label="放大裁切預覽"
          onClick={() => setZoom((v) => Math.min(8, v * 1.25))}
        >
          <ZoomIn size={18} />
        </button>
        <span className="hint">雙指縮放、移動檢視</span>
      </div>
      <div
        className="crop-viewport"
        style={{ aspectRatio: `${asset.width}/${asset.height}`, width: `min(100%,${45 * ratio}dvh)` }}
        onPointerDown={(e) => {
          pointers.current.set(e.pointerId, { x: e.clientX, y: e.clientY });
          if (pointers.current.size === 2) {
            drawing.current = false;
            setAim(null);
            history.cancel();
            const [a, b] = [...pointers.current.values()];
            gesture.current = {
              distance: Math.hypot(a!.x - b!.x, a!.y - b!.y),
              zoom,
              x: (a!.x + b!.x) / 2,
              y: (a!.y + b!.y) / 2,
              pan,
            };
          }
        }}
        onPointerMove={(e) => {
          if (!pointers.current.has(e.pointerId)) return;
          pointers.current.set(e.pointerId, { x: e.clientX, y: e.clientY });
          if (pointers.current.size === 2 && gesture.current) {
            const [a, b] = [...pointers.current.values()],
              g = gesture.current;
            const next = Math.max(
                1,
                Math.min(8, (g.zoom * Math.hypot(a!.x - b!.x, a!.y - b!.y)) / Math.max(1, g.distance)),
              ),
              bounds = e.currentTarget.getBoundingClientRect();
            setZoom(next);
            const limitX = (bounds.width * (next - 1)) / 2,
              limitY = (bounds.height * (next - 1)) / 2;
            setPan({
              x: Math.max(-limitX, Math.min(limitX, g.pan.x + (a!.x + b!.x) / 2 - g.x)),
              y: Math.max(-limitY, Math.min(limitY, g.pan.y + (a!.y + b!.y) / 2 - g.y)),
            });
          }
        }}
        onPointerUp={(e) => {
          pointers.current.delete(e.pointerId);
          gesture.current = null;
          finish();
        }}
        onPointerCancel={(e) => {
          pointers.current.delete(e.pointerId);
          gesture.current = null;
          finish();
        }}
        onContextMenu={(e) => e.preventDefault()}
      >
        <div
          ref={content}
          className="crop-stage"
          data-testid="crop-stage"
          style={{
            width: '100%',
            height: '100%',
            transform: `translate(${pan.x}px,${pan.y}px) scale(${zoom})`,
          }}
        >
          {item.type === 'image' ? (
            <img
              ref={image}
              src={urlFor(project.id, asset.id)}
              alt="裁切素材"
              className="crop-decoder"
              onLoad={() => setReady((v) => v + 1)}
            />
          ) : (
            <video
              ref={video}
              src={urlFor(project.id, asset.id)}
              playsInline
              className="crop-decoder"
              onLoadedData={() => setReady((v) => v + 1)}
              onLoadedMetadata={(e) => {
                e.currentTarget.currentTime = Math.min(
                  sourceTimeAt(item, useUI.getState().player?.time ?? item.start),
                  Math.max(0, asset.duration - 0.02),
                );
              }}
            />
          )}
          <canvas ref={canvas} className="crop-result" aria-label="裁切結果" />
          {!preview && (
            <svg
              data-testid="crop-surface"
              viewBox="0 0 1 1"
              preserveAspectRatio="none"
              onPointerDown={(e) => {
                if (mode === 'crop' || pointers.current.size > 0) return;
                e.preventDefault();
                history.begin();
                e.currentTarget.setPointerCapture(e.pointerId);
                const b = e.currentTarget.closest('.crop-stage')!.getBoundingClientRect();
                setAim({ ...cropPointer(e.clientX, e.clientY, b, offset), width: b.width, height: b.height });
                const p = point(e);
                drawing.current = true;
                history.set((v) => ({
                  ...v,
                  mask:
                    mode === 'lasso'
                      ? { ...v.mask, points: [p] }
                      : {
                          ...v.mask,
                          base:
                            mode === 'keep' && v.mask.points.length < 3 && !v.mask.strokes?.length
                              ? 'empty'
                              : v.mask.base,
                          strokes: [
                            ...(v.mask.strokes ?? []),
                            { tool: mode, size: brushSize / 100, points: [p] },
                          ],
                        },
                }));
              }}
              onPointerMove={(e) => {
                if (!drawing.current || pointers.current.size > 1) return;
                const b = e.currentTarget.closest('.crop-stage')!.getBoundingClientRect();
                setAim({ ...cropPointer(e.clientX, e.clientY, b, offset), width: b.width, height: b.height });
                const p = point(e);
                history.set((v) => ({
                  ...v,
                  mask:
                    mode === 'lasso'
                      ? { ...v.mask, points: [...v.mask.points, p] }
                      : {
                          ...v.mask,
                          strokes: v.mask.strokes?.map((s, i) =>
                            i === v.mask.strokes!.length - 1 ? { ...s, points: [...s.points, p] } : s,
                          ),
                        },
                }));
              }}
              onPointerUp={finish}
              onPointerCancel={finish}
            >
              <path
                d={`M0 0H1V1H0Z M${crop.l} ${crop.t}V${1 - crop.b}H${1 - crop.r}V${crop.t}Z`}
                fill="#000"
                fillOpacity=".55"
                fillRule="evenodd"
              />
              <rect
                x={crop.l}
                y={crop.t}
                width={1 - crop.l - crop.r}
                height={1 - crop.t - crop.b}
                stroke="#fff"
                strokeWidth=".005"
                fill="none"
              />
              {mode === 'lasso' && !!mask.points.length && (
                <polygon
                  points={mask.points.map((p) => p.join(',')).join(' ')}
                  fill="#85ebd533"
                  stroke="#85ebd5"
                  strokeWidth=".007"
                />
              )}
              {aim && mode !== 'crop' && (
                <g
                  data-testid="crop-offset-guide"
                  data-target-x={aim.target[0]}
                  data-target-y={aim.target[1]}
                  pointerEvents="none"
                >
                  <line
                    x1={aim.contact[0]}
                    y1={aim.contact[1]}
                    x2={aim.target[0]}
                    y2={aim.target[1]}
                    stroke="#fff"
                    strokeWidth="1"
                    vectorEffect="non-scaling-stroke"
                    strokeDasharray="3 3"
                  />
                  <ellipse
                    data-testid="crop-contact-circle"
                    cx={aim.contact[0]}
                    cy={aim.contact[1]}
                    rx={11 / aim.width}
                    ry={11 / aim.height}
                    fill="#1118"
                    stroke="#fff"
                    strokeWidth="2"
                    vectorEffect="non-scaling-stroke"
                  />
                  <ellipse
                    data-testid="crop-target-circle"
                    cx={aim.target[0]}
                    cy={aim.target[1]}
                    rx={mode === 'lasso' ? 6 / aim.width : brushSize / 200}
                    ry={mode === 'lasso' ? 6 / aim.height : (brushSize * ratio) / 200}
                    fill="none"
                    stroke={mode === 'erase' ? '#ffb3b3' : '#85ebd5'}
                    strokeWidth="2"
                    vectorEffect="non-scaling-stroke"
                  />
                </g>
              )}
            </svg>
          )}
          {!preview &&
            mode === 'crop' &&
            ['tl', 'tr', 'bl', 'br', 'l', 'r', 't', 'b'].map((corner) => (
              <button
                key={corner}
                className="crop-handle"
                aria-label={`裁切拖曳 ${corner}`}
                style={{
                  left: `${(corner.includes('l') ? crop.l : corner.includes('r') ? 1 - crop.r : (crop.l + 1 - crop.r) / 2) * 100}%`,
                  top: `${(corner.includes('t') ? crop.t : corner.includes('b') ? 1 - crop.b : (crop.t + 1 - crop.b) / 2) * 100}%`,
                }}
                onPointerDown={(e) => {
                  history.begin();
                  e.currentTarget.setPointerCapture(e.pointerId);
                  dragCorner(corner, e);
                }}
                onPointerMove={(e) => {
                  if (e.buttons) dragCorner(corner, e);
                }}
                onPointerUp={finish}
                onPointerCancel={finish}
              />
            ))}
        </div>
      </div>
      {(mode === 'keep' || mode === 'erase') && (
        <Slider
          label={mode === 'keep' ? '筆刷粗細' : '橡皮擦粗細'}
          value={brushSize}
          min={1}
          max={40}
          step={1}
          format={(v) => `${v}% 素材寬`}
          onChange={setBrushSize}
        />
      )}
      {mode !== 'crop' && (
        <Slider
          label="瞄準偏移"
          value={offset}
          min={0}
          max={120}
          step={2}
          format={(v) => `${v} px`}
          onChange={setOffset}
        />
      )}
      <p className="hint">
        四種工具可合用；筆刷保留刷過的部位、橡皮擦移除刷過的部位。雙指放大移動不改變原素材座標。
      </p>
      {mode === 'crop' &&
        (
          [
            ['l', '左'],
            ['r', '右'],
            ['t', '上'],
            ['b', '下'],
          ] as const
        ).map(([side, name]) => (
          <Slider
            key={side}
            label={`${name}側裁切`}
            value={Math.round(crop[side] * 100)}
            min={0}
            max={90}
            step={1}
            format={(v) => `${v}%`}
            onChange={(v) =>
              change({
                [side]: Math.min(
                  v / 100,
                  0.95 - crop[side === 'l' ? 'r' : side === 'r' ? 'l' : side === 't' ? 'b' : 't'],
                ),
              })
            }
          />
        ))}
    </Sheet>
  );
}
