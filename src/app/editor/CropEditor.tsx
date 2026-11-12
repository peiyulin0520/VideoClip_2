import { useState, type PointerEvent } from 'react';
import type { VideoItem, Crop } from '../../model/types';
import { useProjectStore } from '../../store/projectStore';
import { useUI } from '../../store/uiStore';
import { editItem } from '../../store/actions';
import { urlFor } from '../../engine/assetUrls';
import { sourceTimeAt } from '../../engine/timeline';
import { Sheet } from '../../ui/Sheet';
import { Slider } from '../../ui/Slider';

export function CropEditor({ item, onClose }: { item: VideoItem; onClose: () => void }) {
  const project = useProjectStore((s) => s.project)!,
    asset = project.assets.find((a) => a.id === item.assetId)!;
  const [crop, setCrop] = useState<Crop>(item.crop ?? { l: 0, t: 0, r: 0, b: 0 }),
    [points, setPoints] = useState<[number, number][]>(item.mask?.points ?? []);
  const [mode, setMode] = useState<'crop' | 'lasso'>('crop'),
    [drawing, setDrawing] = useState(false);
  const source = urlFor(project.id, asset.id),
    ratio = asset.width / asset.height;
  const point = (e: PointerEvent<HTMLElement | SVGSVGElement>): [number, number] => {
    const box = e.currentTarget.closest('.crop-stage')!.getBoundingClientRect();
    return [
      Math.max(0, Math.min(1, (e.clientX - box.left) / box.width)),
      Math.max(0, Math.min(1, (e.clientY - box.top) / box.height)),
    ];
  };
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
        <button className={`chip${mode === 'crop' ? ' active' : ''}`} onClick={() => setMode('crop')}>
          四邊與角落裁切
        </button>
        <button className={`chip${mode === 'lasso' ? ' active' : ''}`} onClick={() => setMode('lasso')}>
          自由描邊保留區域
        </button>
      </div>
      <div
        className="crop-stage"
        style={{ aspectRatio: `${asset.width}/${asset.height}`, width: `min(100%,${52 * ratio}dvh)` }}
        data-testid="crop-stage"
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
        <svg
          viewBox="0 0 1 1"
          preserveAspectRatio="none"
          onPointerDown={(e) => {
            if (mode !== 'lasso') return;
            e.currentTarget.setPointerCapture(e.pointerId);
            setPoints([point(e)]);
            setDrawing(true);
          }}
          onPointerMove={(e) => {
            if (!drawing) return;
            const p = point(e);
            setPoints((a) =>
              a.length < 500 && Math.hypot(p[0] - a.at(-1)![0], p[1] - a.at(-1)![1]) > 0.003 ? [...a, p] : a,
            );
          }}
          onPointerUp={() => setDrawing(false)}
          onPointerCancel={() => setDrawing(false)}
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
        </svg>
        {mode === 'crop' &&
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
      <p className="hint">
        {mode === 'lasso'
          ? '直接沿著想保留的部位畫一圈，框外會透明。這是手動遮罩，會隨素材移動縮放。'
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
              if (points.length >= 3) it.mask = { points };
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
