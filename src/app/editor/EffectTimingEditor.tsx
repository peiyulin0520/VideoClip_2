import { useEffect, useRef, useState } from 'react';
import { Undo2 } from 'lucide-react';
import type { Project } from '../../model/types';
import { resizeTimeRange, type TimeRange } from '../../engine/animationTiming';
import { SourceRanges } from '../../ui/SourceRanges';
import { RangeActions } from '../../ui/RangeActions';
import { Sheet } from '../../ui/Sheet';
import { useDraftHistory } from '../../ui/useDraftHistory';
import { useUI } from '../../store/uiStore';
import { ProjectPreview } from './ProjectPreview';

export function EffectTimingEditor({
  ranges: initial,
  duration,
  start = 0,
  thumbs = [],
  onApply,
  onClose,
  preview,
  label = '特效起迄',
  joinAt,
  singleEdge,
}: {
  ranges: TimeRange[];
  duration: number;
  start?: number;
  thumbs?: string[];
  onApply: (ranges: TimeRange[]) => void;
  onClose: () => void;
  preview: (ranges: TimeRange[]) => Project;
  label?: string;
  joinAt?: number;
  singleEdge?: 'enter' | 'exit';
}) {
  const history = useDraftHistory(initial);
  const [buildPreview] = useState(() => preview);
  const player = useUI((s) => s.player);
  const before = useRef(player?.time ?? 0);
  const [cursor, setCursor] = useState(initial[0]?.[0] ?? 0);
  const [preset, setPreset] = useState<'start' | 'end' | null>(null);
  // Keep each draft change visible in the actual renderer without touching persistence/undo.
  useEffect(() => {
    player?.setPreviewProject(buildPreview(history.value));
  }, [player, buildPreview, history.value]);
  useEffect(() => {
    const previous = before.current;
    player?.pause();
    player?.seek(start + (initial[0]?.[0] ?? 0));
    const unsubscribe = player?.subscribe((t) => setCursor(Math.max(0, Math.min(duration, t - start))));
    return () => {
      unsubscribe?.();
      player?.pause();
      player?.setPreviewProject(null);
      player?.seek(previous);
    };
    // Initial sheet bounds, not subsequent draft changes.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [player, start, duration]);
  const seek = (t: number) => {
    setCursor(t);
    player?.pause();
    player?.seek(start + t);
  };
  const length = history.value[0] ? history.value[0][1] - history.value[0][0] : Math.min(3, duration);
  return (
    <Sheet
      open
      title={label}
      className={singleEdge ? 'single-effect-timing' : undefined}
      onClose={onClose}
      titleAction={
        <button
          className="icon-btn"
          aria-label="復原上一步選段"
          disabled={!history.canUndo}
          onClick={history.undo}
        >
          <Undo2 />
        </button>
      }
    >
      {joinAt !== undefined && (
        <p className="hint">總長不變。交接前由 A 退場，交接後由 B 進場；交接位置 {joinAt.toFixed(2)} 秒。</p>
      )}
      <div className="effect-timing-preview">
        <ProjectPreview start={start} duration={duration} label="特效結果" />
        {singleEdge && (
          <p className="effect-timing-cursor" aria-label="目前特效預覽時間">
            {cursor.toFixed(2)} / {duration.toFixed(2)} 秒
          </p>
        )}
      </div>
      {singleEdge && (
        <p className="hint">
          {singleEdge === 'enter'
            ? '開頭進場 · B；起點固定 0.00 秒，只調整迄與時長。'
            : `結尾退場 · A；終點固定 ${duration.toFixed(2)} 秒，只調整起與時長。`}
        </p>
      )}
      {!singleEdge && (
        <div className="chips option-secondary">
          <button
            className={`chip${preset === 'start' ? ' active' : ''}`}
            aria-pressed={preset === 'start'}
            onClick={() => {
              history.set([[0, Math.min(duration, length)]]);
              setPreset('start');
              seek(0);
            }}
          >
            開頭
          </button>
          <button
            className={`chip${preset === 'end' ? ' active' : ''}`}
            aria-pressed={preset === 'end'}
            onClick={() => {
              history.set([[Math.max(0, duration - length), duration]]);
              setPreset('end');
              seek(Math.max(0, duration - length));
            }}
          >
            結尾
          </button>
        </div>
      )}
      <SourceRanges
        duration={duration}
        ranges={history.value}
        thumbs={thumbs}
        cursor={cursor}
        markerLabel="特效"
        numberedMarkers={!singleEdge}
        editableSides={singleEdge ? [singleEdge === 'enter' ? 1 : 0] : undefined}
        onChange={(r) => {
          history.set(r);
          setPreset(null);
        }}
        onEditStart={history.begin}
        onEditEnd={history.end}
        onSeek={seek}
      />
      {!singleEdge && (
        <RangeActions
          ranges={history.value}
          cursor={cursor}
          duration={duration}
          span={Math.min(3, duration)}
          onChange={history.set}
          noun="特效"
        />
      )}
      {joinAt !== undefined &&
        history.value.map(([a, b], i) => (
          <p key={i}>
            第 {i + 1} 組 · A 起點 {Math.min(a, joinAt).toFixed(2)} 秒 · B 終點{' '}
            {Math.max(0, b - joinAt).toFixed(2)} 秒 · 特效 {(b - a).toFixed(2)} 秒
          </p>
        ))}
      {history.value.map(([a, b], i) => (
        <div className={`effect-range-fields${singleEdge ? ' single-edge-fields' : ''}`} key={i}>
          {(['起點', '終點', '時長'] as const).flatMap((name, j) =>
            singleEdge && j === (singleEdge === 'enter' ? 0 : 1)
              ? []
              : [
                  <label className="field" key={name}>
                    {singleEdge
                      ? name === '時長'
                        ? '時長'
                        : name === '起點'
                          ? '起'
                          : '迄'
                      : `第 ${i + 1} 組${name}`}
                    （秒）
                    <input
                      type="number"
                      aria-label={`第${i + 1}組特效${name}`}
                      min={j === 2 ? 0.01 : 0}
                      max={duration}
                      step={0.01}
                      value={Number((j === 0 ? a : j === 1 ? b : b - a).toFixed(2))}
                      onChange={(e) => {
                        const n = Number(e.target.value);
                        if (!Number.isFinite(n)) return;
                        if (singleEdge) {
                          const span = Math.max(
                            0.01,
                            Math.min(duration, j === 2 ? n : singleEdge === 'enter' ? n : duration - n),
                          );
                          history.set([singleEdge === 'enter' ? [0, span] : [duration - span, duration]]);
                          seek(
                            Math.min(
                              singleEdge === 'enter' ? span : duration - span,
                              Math.max(0, duration - 0.001),
                            ),
                          );
                          return;
                        }
                        const low = history.value[i - 1]?.[1] ?? 0,
                          high = history.value[i + 1]?.[0] ?? duration;
                        const next: TimeRange =
                          j === 0
                            ? [Math.max(low, Math.min(b - 0.01, n)), b]
                            : j === 1
                              ? [a, Math.max(a + 0.01, Math.min(high, n))]
                              : resizeTimeRange([a, b], n, low, high, joinAt);
                        history.set(history.value.map((r, k) => (k === i ? next : r)));
                        setPreset(null);
                      }}
                    />
                  </label>,
                ],
          )}
        </div>
      ))}
      <p className="hint">
        {singleEdge
          ? '影片會邊播邊套用特效。拖標籤或填秒數調整；迄減起等於時長，右上可復原，取消不套用。'
          : '影片會邊播邊套用特效。點縮圖移動白線，新增標籤會同時建立起點與終點；各組可移除或復原。'}
      </p>
      <div className="sheet-row">
        <button className="btn" onClick={onClose}>
          取消
        </button>
        <button
          className="btn primary"
          onClick={() => {
            onApply(history.value);
            onClose();
          }}
        >
          套用特效起迄
        </button>
      </div>
    </Sheet>
  );
}
