import { contrastText } from '../../engine/colors';
import { useEffect, useRef, useState } from 'react';
import { Undo2, Redo2 } from 'lucide-react';
import type { VideoItem } from '../../model/types';
import { useProjectStore } from '../../store/projectStore';
import { useUI } from '../../store/uiStore';
import { previewUrlFor } from '../../engine/assetUrls';
import { selectedSourceRanges } from '../../engine/sourceSelections';
import { itemName } from '../../engine/itemName';
import { Sheet } from '../../ui/Sheet';
import { MediaPlayback } from '../../ui/MediaPlayback';
import { SourceRanges } from '../../ui/SourceRanges';
import { RangeActions } from '../../ui/RangeActions';
import { useDraftHistory } from '../../ui/useDraftHistory';
import { ColorPicker } from '../../ui/ColorPicker';

export function TemplateCellEditor({
  item,
  index,
  onApply,
  onClose,
}: {
  item: VideoItem;
  index: number;
  onApply: (draft: VideoItem) => void;
  onClose: () => void;
}) {
  const p = useProjectStore((s) => s.project)!,
    asset = p.assets.find((a) => a.id === item.assetId)!;
  const history = useDraftHistory<VideoItem>(structuredClone(item)),
    draft = history.value;
  const video = useRef<HTMLVideoElement>(null);
  const [cursor, setCursor] = useState(item.trimIn),
    [fillText, setFillText] = useState('');
  const fillColor = draft.cell?.background ?? '#000000';
  useEffect(() => {
    if (video.current) video.current.playbackRate = draft.speed;
  }, [draft.speed]);
  const ranges = selectedSourceRanges(draft, asset.duration),
    selected = ranges.some(([a, b]) => cursor >= a && cursor < b);
  const setRanges = (next: [number, number][]) => {
    if (!next.length) {
      history.set((v) => ({ ...v, sourceRanges: [] }));
      return;
    }
    // Moving the first marker retains the requested project duration and derives its end.
    if (next.length === 1 && ranges.length === 1 && Math.abs(next[0]![0] - ranges[0]![0]) > 0.000001)
      next = [[next[0]![0], Math.min(asset.duration, next[0]![0] + draft.duration * draft.speed)]];
    history.set((v) => ({
      ...v,
      trimIn: next[0]![0],
      sourceRanges: next.length > 1 ? next : undefined,
      cell: { offset: 0, blanks: [], background: fillColor, ...v.cell, sourceEnd: next.at(-1)![1] },
    }));
  };
  const setStart = (start: number) => {
    const at = Math.max(0, Math.min(asset.duration - 0.01, start));
    setRanges([[at, Math.min(asset.duration, at + draft.duration * draft.speed)]]);
    seek(at);
  };
  const setDuration = (duration: number) =>
    history.set((v) => ({
      ...v,
      duration: Math.max(0.2, Math.min(3600, duration)),
      sourceRanges: undefined,
      cell: {
        offset: 0,
        blanks: [],
        background: fillColor,
        ...v.cell,
        sourceEnd: asset.kind === 'image' ? 3600 : Math.min(asset.duration, v.trimIn + duration * v.speed),
      },
    }));
  const setSpeed = (speed: number) =>
    history.set((v) => ({
      ...v,
      speed,
      cell: {
        offset: 0,
        blanks: [],
        background: fillColor,
        ...v.cell,
        sourceEnd:
          ranges.length === 1
            ? Math.min(asset.duration, v.trimIn + v.duration * speed)
            : (v.cell?.sourceEnd ?? asset.duration),
      },
    }));
  const fitSpeed = () => {
    const available = ranges.reduce((n, [a, b]) => n + b - a, 0);
    history.set((v) => ({ ...v, speed: Math.max(0.25, Math.min(4, available / v.duration)) }));
  };
  const seek = (t: number) => {
    setCursor(t);
    if (video.current) video.current.currentTime = Math.max(0, Math.min(asset.duration - 0.001, t));
  };
  return (
    <Sheet open title={`第 ${index + 1} 格片段範圍`} onClose={onClose} className="template-cell-editor">
      <label className="field">
        素材名稱
        <input
          aria-label="每格素材名稱"
          value={draft.name ?? itemName(p, item)}
          onChange={(e) => history.set((v) => ({ ...v, name: e.target.value }))}
        />
      </label>
      <div className="source-playback-row">
        {item.type === 'video' && (
          <MediaPlayback media={video} label="片段預覽" end={asset.duration} onTime={setCursor} />
        )}
        <span>{cursor.toFixed(2)} 秒</span>
        <button className="icon-btn" aria-label="undo" disabled={!history.canUndo} onClick={history.undo}>
          <Undo2 size={18} />
        </button>
        <button className="icon-btn" aria-label="redo" disabled={!history.canRedo} onClick={history.redo}>
          <Redo2 size={18} />
        </button>
        <button
          className="chip primary"
          onClick={() => {
            onApply(draft);
            onClose();
          }}
        >
          套用片段範圍
        </button>
      </div>
      <div className="cell-range-workspace">
        <div className="source-preview-base">
          {item.type === 'image' ? (
            <img src={previewUrlFor(p.id, asset.id)} alt={itemName(p, draft)} />
          ) : (
            <video
              ref={video}
              className="range-preview"
              src={previewUrlFor(p.id, asset.id)}
              playsInline
              style={{ filter: selected ? undefined : 'saturate(0)' }}
              onLoadedMetadata={(e) => {
                e.currentTarget.currentTime = Math.min(draft.trimIn, asset.duration - 0.001);
                useUI.getState().player?.pause();
              }}
            />
          )}
        </div>
        <div className="cell-range-controls">
          {item.type === 'video' && (
            <SourceRanges
              duration={asset.duration}
              ranges={ranges}
              thumbs={asset.thumbs}
              cursor={cursor}
              onChange={setRanges}
              onSeek={seek}
              onEditStart={history.begin}
              onEditEnd={history.end}
              minimum={Math.min(0.2 * draft.speed, asset.duration)}
              linkedDuration={ranges.length === 1 ? draft.duration * draft.speed : undefined}
              tickCount={3}
            />
          )}
          <div className="cell-range-fields">
            <label className="field">
              長度（秒）
              <input
                type="number"
                aria-label="每格長度"
                min={0.2}
                max={3600}
                step={0.01}
                value={draft.duration}
                onChange={(e) => setDuration(Number(e.target.value))}
              />
            </label>
            {item.type === 'video' && (
              <>
                <label className="field">
                  起（秒）
                  <input
                    type="number"
                    aria-label="每格來源起點"
                    min={0}
                    max={asset.duration - 0.01}
                    step={0.01}
                    value={Number(draft.trimIn.toFixed(2))}
                    onChange={(e) => setStart(Number(e.target.value))}
                  />
                </label>
                <label className="field">
                  迄（秒）
                  <input
                    type="number"
                    aria-label="每格來源終點"
                    min={draft.trimIn + 0.01}
                    max={asset.duration}
                    step={0.01}
                    value={Number((ranges.at(-1)?.[1] ?? asset.duration).toFixed(2))}
                    onChange={(e) => {
                      const end = Math.max(
                        draft.trimIn + 0.01,
                        Math.min(asset.duration, Number(e.target.value)),
                      );
                      setRanges([[draft.trimIn, end]]);
                      seek(end - 0.001);
                    }}
                  />
                </label>
              </>
            )}
          </div>
        </div>
      </div>
      {item.type === 'video' && (
        <>
          <RangeActions ranges={ranges} cursor={cursor} duration={asset.duration} onChange={setRanges} />
          <div className="chips">
            <button className="chip" onClick={fitSpeed}>
              自動配合長度（慢／快動作）
            </button>
            <button className="chip" onClick={() => setSpeed(0.5)}>
              慢動作
            </button>
            <button className="chip" onClick={() => setSpeed(2)}>
              快動作
            </button>
            <label className="field">
              速率
              <input
                type="number"
                aria-label="每格播放速率"
                min={0.25}
                max={4}
                step={0.01}
                value={Number(draft.speed.toFixed(3))}
                onChange={(e) => setSpeed(Math.max(0.25, Math.min(4, Number(e.target.value))))}
              />
            </label>
          </div>
        </>
      )}
      <details>
        <summary>補色與文字</summary>
        <div className="chips">
          {(
            [
              ['#000000', '補黑'],
              ['#ffffff', '補白'],
            ] as const
          ).map(([color, label]) => (
            <button
              key={color}
              className={`chip${fillColor === color ? ' active' : ''}`}
              onClick={() =>
                history.set((v) => ({
                  ...v,
                  cell: { sourceEnd: asset.duration, offset: 0, blanks: [], ...v.cell, background: color },
                }))
              }
            >
              {label}
            </button>
          ))}
        </div>
        <ColorPicker
          label="空白畫面顏色"
          value={fillColor}
          onChange={(color) => {
            history.set((v) => ({
              ...v,
              cell: { sourceEnd: asset.duration, offset: 0, blanks: [], ...v.cell, background: color },
            }));
          }}
        />
        <label className="field">
          空白畫面文字
          <input
            aria-label="空白畫面文字"
            placeholder="只加在此格的空白畫面"
            value={fillText}
            onChange={(e) => setFillText(e.target.value)}
          />
        </label>
        <button
          className="chip"
          onClick={() =>
            history.set((v) => ({
              ...v,
              cell: {
                sourceEnd: asset.duration,
                offset: 0,
                blanks: [],
                background: fillColor,
                ...v.cell,
                cards: [
                  ...(v.cell?.cards ?? []),
                  {
                    start: Math.max(0, Math.min(v.duration - 0.01, (cursor - v.trimIn) / v.speed)),
                    end: Math.min(v.duration, Math.max(0, (cursor - v.trimIn) / v.speed) + 0.5),
                    color: fillColor,
                    text: fillText,
                  },
                ],
              },
            }))
          }
        >
          在目前位置插入空白
        </button>
        {(draft.cell?.cards ?? []).map((card, i) => (
          <div className="blank-card" key={i}>
            <label>
              起
              <input
                aria-label={`空白${i + 1}起點`}
                type="number"
                min={0}
                max={card.end - 0.01}
                step={0.01}
                value={card.start}
                onChange={(e) =>
                  history.set((v) => ({
                    ...v,
                    cell: {
                      ...v.cell!,
                      cards: v.cell!.cards!.map((c, j) =>
                        i === j
                          ? { ...c, start: Math.max(0, Math.min(c.end - 0.01, Number(e.target.value))) }
                          : c,
                      ),
                    },
                  }))
                }
              />
            </label>
            <label>
              迄
              <input
                aria-label={`空白${i + 1}終點`}
                type="number"
                min={card.start + 0.01}
                max={draft.duration}
                step={0.01}
                value={card.end}
                onChange={(e) =>
                  history.set((v) => ({
                    ...v,
                    cell: {
                      ...v.cell!,
                      cards: v.cell!.cards!.map((c, j) =>
                        i === j
                          ? {
                              ...c,
                              end: Math.max(c.start + 0.01, Math.min(v.duration, Number(e.target.value))),
                            }
                          : c,
                      ),
                    },
                  }))
                }
              />
            </label>
            <span style={{ background: card.color, color: contrastText(card.color) }}>
              {card.text || '空白'}
            </span>
            <button
              className="chip"
              onClick={() =>
                history.set((v) => ({
                  ...v,
                  cell: { ...v.cell!, cards: v.cell!.cards!.filter((_, j) => i !== j) },
                }))
              }
            >
              移除此空白
            </button>
          </div>
        ))}
      </details>
      <p className="hint">
        原色為已選秒數、灰色為未選。起點改動時依長度推算迄點；素材不足可配合速率或插入補色與文字。所有修改套用後才儲存。
      </p>
    </Sheet>
  );
}
