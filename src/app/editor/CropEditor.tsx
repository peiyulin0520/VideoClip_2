import { useMemo, useState, type PointerEvent } from 'react';
import { paintMask } from '../../engine/mediaMask';
import type { MaskStroke, VideoItem, Crop } from '../../model/types';
import { useProjectStore } from '../../store/projectStore';
import { useUI } from '../../store/uiStore';
import { editItem } from '../../store/actions';
import { urlFor } from '../../engine/assetUrls';
import { sourceTimeAt } from '../../engine/timeline';
import { Sheet } from '../../ui/Sheet';
import { Slider } from '../../ui/Slider';
import { cropPointer } from '../../engine/cropPointer';

export function CropEditor({ item, onClose }: { item: VideoItem; onClose: () => void }) {
  const project = useProjectStore((s) => s.project)!,
    asset = project.assets.find((a) => a.id === item.assetId)!;
  const [crop, setCrop] = useState<Crop>(item.crop ?? { l: 0, t: 0, r: 0, b: 0 }),
    [points, setPoints] = useState<[number, number][]>(item.mask?.points ?? []);
  const [mode, setMode] = useState<'crop' | 'lasso' | 'keep' | 'erase'>('crop'),
    [drawing, setDrawing] = useState(false),
    [preview, setPreview] = useState(false);
  const [strokes, setStrokes] = useState<MaskStroke[]>(item.mask?.strokes ?? []);
  const [brushSize, setBrushSize] = useState(8);
  const [offset, setOffset] = useState(56);
  const [aim, setAim] = useState<(ReturnType<typeof cropPointer> & { width: number; height: number }) | null>(
    null,
  );
  const [snapshots, setSnapshots] = useState<{ points: [number, number][]; strokes: MaskStroke[] }[]>([]);
  const maskUrl = useMemo(() => {
    if (points.length < 3 && !strokes.length) return undefined;
    const c = document.createElement('canvas');
    c.width = Math.min(asset.width, 1000);
    c.height = (c.width * asset.height) / asset.width;
    paintMask(c.getContext('2d')!, { points, strokes }, c.width, c.height);
    return `url(${c.toDataURL()})`;
  }, [points, strokes, asset.width, asset.height]);
  const source = urlFor(project.id, asset.id),
    ratio = asset.width / asset.height;
  const pointer = (e: PointerEvent<HTMLElement | SVGSVGElement>) => {
    const box = e.currentTarget.closest('.crop-stage')!.getBoundingClientRect();
    return {
      ...cropPointer(e.clientX, e.clientY, box, mode === 'crop' ? 0 : offset),
      width: box.width,
      height: box.height,
    };
  };
  const point = (e: PointerEvent<HTMLElement | SVGSVGElement>): [number, number] => pointer(e).target;
  const change = (side: keyof Crop, value: number) =>
    setCrop((c) => ({
      ...c,
      [side]: Math.max(
        0,
        Math.min(0.95 - c[side === 'l' ? 'r' : side === 'r' ? 'l' : side === 't' ? 'b' : 't'], value),
      ),
    }));
  const dragCorner = (corner: string, e: PointerEvent<HTMLButtonElement>) => {
    const [x, y] = point(e);
    if (corner.includes('l')) change('l', x);
    if (corner.includes('r')) change('r', 1 - x);
    if (corner.includes('t')) change('t', y);
    if (corner.includes('b')) change('b', 1 - y);
  };
  const outside = `M0 0H1V1H0Z M${crop.l} ${crop.t}V${1 - crop.b}H${1 - crop.r}V${crop.t}Z`;
  return (
    <Sheet open title="裁切／手動去背" onClose={onClose}>
      <div className="chips">
        <button
          className={`chip${mode === 'crop' ? ' active' : ''}`}
          onClick={() => {
            setMode('crop');
            setPreview(false);
            setAim(null);
          }}
        >
          四邊與角落裁切
        </button>
        <button
          className={`chip${mode === 'lasso' ? ' active' : ''}`}
          onClick={() => {
            setMode('lasso');
            setPreview(false);
            setAim(null);
          }}
        >
          自由描邊保留區域
        </button>
        {(['keep', 'erase'] as const).map((tool) => (
          <button
            key={tool}
            className={`chip${mode === tool ? ' active' : ''}`}
            onClick={() => {
              setMode(tool);
              setPreview(false);
            }}
          >
            {tool === 'keep' ? '保留筆刷' : '裁切橡皮擦'}
          </button>
        ))}
      </div>
      {(mode === 'keep' || mode === 'erase') && (
        <Slider
          label={mode === 'keep' ? '保留筆刷粗細' : '裁切橡皮擦粗細'}
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
      <div
        className="crop-stage"
        onContextMenu={(event) => event.preventDefault()}
        style={{ aspectRatio: `${asset.width}/${asset.height}`, width: `min(100%,${52 * ratio}dvh)` }}
        data-testid="crop-stage"
      >
        <div
          className="crop-media"
          style={
            preview
              ? { clipPath: `inset(${crop.t * 100}% ${crop.r * 100}% ${crop.b * 100}% ${crop.l * 100}%)` }
              : undefined
          }
        >
          <div
            className="crop-media"
            style={
              preview || mode === 'keep' || mode === 'erase'
                ? {
                    maskImage: maskUrl,
                    maskSize: '100% 100%',
                    WebkitMaskImage: maskUrl,
                    WebkitMaskSize: '100% 100%',
                  }
                : undefined
            }
          >
            {item.type === 'image' ? (
              <img src={source} alt="裁切素材" />
            ) : (
              <video
                src={source}
                playsInline
                muted
                onLoadedMetadata={(e) => {
                  e.currentTarget.currentTime = Math.min(
                    sourceTimeAt(item, useUI.getState().player?.time ?? item.start),
                    Math.max(0, asset.duration - 0.02),
                  );
                }}
              />
            )}
          </div>
        </div>
        {!preview && (
          <svg
            data-testid="crop-surface"
            viewBox="0 0 1 1"
            preserveAspectRatio="none"
            onPointerDown={(e) => {
              if (mode === 'crop') return;
              setAim(pointer(e));
              setSnapshots((h) => [...h, { points, strokes }]);
              if (mode === 'keep' || mode === 'erase') {
                const first = point(e);
                e.currentTarget.setPointerCapture(e.pointerId);
                setStrokes((s) => [...s, { tool: mode, size: brushSize / 100, points: [first] }]);
                setDrawing(true);
                return;
              }
              setStrokes([]);
              e.currentTarget.setPointerCapture(e.pointerId);
              setPoints([point(e)]);
              setDrawing(true);
            }}
            onPointerMove={(e) => {
              if (!drawing) return;
              const next = pointer(e);
              setAim(next);
              const p = next.target;
              if (mode === 'keep' || mode === 'erase') {
                setStrokes((s) =>
                  s.map((v, i) => (i === s.length - 1 ? { ...v, points: [...v.points, p] } : v)),
                );
                return;
              }
              setPoints((a) =>
                a.length < 500 && Math.hypot(p[0] - a.at(-1)![0], p[1] - a.at(-1)![1]) > 0.003
                  ? [...a, p]
                  : a,
              );
            }}
            onPointerUp={() => {
              setDrawing(false);
              setAim(null);
            }}
            onPointerCancel={() => {
              setDrawing(false);
              setAim(null);
            }}
          >
            <path d={outside} fill="#000" fillOpacity=".55" fillRule="evenodd" />
            <rect
              x={crop.l}
              y={crop.t}
              width={1 - crop.l - crop.r}
              height={1 - crop.t - crop.b}
              stroke="#fff"
              strokeWidth=".005"
              fill="none"
            />
            {!!points.length && (
              <polygon
                points={points.map((p) => p.join(',')).join(' ')}
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
                  stroke="#ffffff"
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
                <path
                  d={`M${aim.target[0] - 4 / aim.width} ${aim.target[1]}h${8 / aim.width} M${aim.target[0]} ${aim.target[1] - 4 / aim.height}v${8 / aim.height}`}
                  stroke="#fff"
                  strokeWidth="1"
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
                e.currentTarget.setPointerCapture(e.pointerId);
                dragCorner(corner, e);
              }}
              onPointerMove={(e) => {
                if (e.buttons) dragCorner(corner, e);
              }}
            />
          ))}
      </div>
      <div className="chips">
        <button
          className={`chip${preview ? ' active' : ''}`}
          aria-pressed={preview}
          onClick={() => setPreview(!preview)}
        >
          {preview ? '繼續調整裁切' : '檢查裁切結果'}
        </button>
        <button
          className="chip"
          disabled={!snapshots.length}
          onClick={() => {
            const previous = snapshots.at(-1)!;
            setPoints(previous.points);
            setStrokes(previous.strokes);
            setSnapshots((s) => s.slice(0, -1));
            setPreview(false);
          }}
        >
          復原描邊
        </button>
      </div>
      <p className="hint">
        {mode === 'keep' || mode === 'erase'
          ? '按住下方控制圈，移動上方瞄準圈來保留或擦除；可調粗細與偏移距離，復原可退回上一筆。'
          : mode === 'lasso'
            ? '按住下方控制圈，用上方瞄準圈沿想保留的部位畫一圈。框外會透明，偏移距離可調。'
            : '拖曳四邊或角落，決定要保留的範圍。'}
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
            onChange={(v) => change(side, v / 100)}
          />
        ))}
      <div className="sheet-row">
        <button
          className="btn"
          onClick={() => {
            setCrop({ l: 0, r: 0, t: 0, b: 0 });
            setPoints([]);
            setStrokes([]);
            setSnapshots([]);
            setPreview(false);
          }}
        >
          重設裁切
        </button>
        <button className="btn" onClick={onClose}>
          取消
        </button>
        <button
          className="btn primary"
          onClick={() => {
            editItem(item.id, (it) => {
              if (it.type === 'text') return;
              it.crop = crop;
              if (points.length >= 3 || strokes.length) it.mask = { points, strokes };
              else delete it.mask;
            });
            onClose();
          }}
        >
          套用裁切
        </button>
      </div>
    </Sheet>
  );
}
