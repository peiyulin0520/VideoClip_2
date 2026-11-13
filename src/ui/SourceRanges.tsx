import { useLayoutEffect, useRef, useState, type PointerEvent } from 'react';

/** Small visible markers above the seconds; each retains a 44px touch target. */
export function SourceRanges({
  duration,
  ranges,
  thumbs,
  onChange,
  onSeek,
  cursor = 0,
  minimum = 0.01,
  markerRanges,
  markerLabel,
  onMarkerChange,
  onEditStart,
  onEditEnd,
  editableSides = [0, 1],
}: {
  duration: number;
  ranges: [number, number][];
  thumbs: string[];
  onChange: (ranges: [number, number][]) => void;
  onSeek: (time: number) => void;
  cursor?: number;
  minimum?: number;
  markerRanges?: [number, number][];
  markerLabel?: string;
  onMarkerChange?: (ranges: [number, number][]) => void;
  onEditStart?: () => void;
  onEditEnd?: () => void;
  editableSides?: number[];
}) {
  const markers = markerRanges ?? ranges;
  const bar = useRef<HTMLDivElement>(null);
  const [width, setWidth] = useState(300);
  useLayoutEffect(() => {
    const el = bar.current!,
      observer = new ResizeObserver(() => setWidth(el.clientWidth));
    observer.observe(el);
    setWidth(el.clientWidth);
    return () => observer.disconnect();
  }, []);
  const update = (index: number, side: number, value: number) => {
    const next = markers.map((r) => [...r] as [number, number]);
    const r = next[index]!;
    const span = Math.min(minimum, r[1] - r[0]);
    const low = side ? r[0] + span : (next[index - 1]?.[1] ?? 0);
    const high = side ? (next[index + 1]?.[0] ?? duration) : r[1] - span;
    r[side] = Math.max(low, Math.min(high, value));
    (onMarkerChange ?? onChange)(next);
    onSeek(r[side]!);
  };
  const drag = (index: number, side: number, e: PointerEvent<HTMLButtonElement>) => {
    e.preventDefault();
    onEditStart?.();
    e.currentTarget.setPointerCapture(e.pointerId);
    const el = e.currentTarget,
      originX = e.clientX,
      origin = markers[index]![side]!;
    const move = (ev: globalThis.PointerEvent) =>
      update(index, side, origin + ((ev.clientX - originX) / bar.current!.clientWidth) * duration);
    const up = () => {
      onEditEnd?.();
      el.removeEventListener('pointermove', move);
      el.removeEventListener('pointerup', up);
      el.removeEventListener('pointercancel', up);
    };
    el.addEventListener('pointermove', move);
    el.addEventListener('pointerup', up);
    el.addEventListener('pointercancel', up);
  };
  const dim: [number, number][] = [];
  let from = 0;
  for (const [a, b] of ranges) {
    if (a > from) dim.push([from, a]);
    from = b;
  }
  if (from < duration) dim.push([from, duration]);
  return (
    <div ref={bar} className="source-range marker-range" data-testid="source-range">
      <div className="range-seconds">
        {Array.from({ length: 5 }, (_, i) => (
          <span key={i} style={{ left: `${i * 25}%` }}>
            {((duration * i) / 4).toFixed(2)}s
          </span>
        ))}
      </div>
      <div
        className="source-thumbs"
        role="slider"
        tabIndex={0}
        aria-label="選段白線位置"
        aria-valuemin={0}
        aria-valuemax={duration}
        aria-valuenow={cursor}
        onPointerDown={(e) => {
          e.currentTarget.setPointerCapture(e.pointerId);
          onSeek(
            Math.max(
              0,
              Math.min(
                duration,
                ((e.clientX - bar.current!.getBoundingClientRect().left) / bar.current!.clientWidth) *
                  duration,
              ),
            ),
          );
        }}
        onPointerMove={(e) => {
          if (e.currentTarget.hasPointerCapture(e.pointerId))
            onSeek(
              Math.max(
                0,
                Math.min(
                  duration,
                  ((e.clientX - bar.current!.getBoundingClientRect().left) / bar.current!.clientWidth) *
                    duration,
                ),
              ),
            );
        }}
        onKeyDown={(e) => {
          if (['ArrowLeft', 'ArrowRight', 'Home', 'End'].includes(e.key)) {
            e.preventDefault();
            onSeek(
              e.key === 'Home'
                ? 0
                : e.key === 'End'
                  ? duration
                  : Math.max(0, Math.min(duration, cursor + (e.key === 'ArrowRight' ? 0.05 : -0.05))),
            );
          }
        }}
      >
        {(thumbs.length ? thumbs : ['']).map((src, i) =>
          src ? (
            <img src={src} key={i} alt="" />
          ) : (
            <div className="audio-wave" key={i} aria-hidden="true">
              ▂▅▃▇▆▃▅▁▆▃▇▅▂▅▃▇▆▃▅▁
            </div>
          ),
        )}
      </div>
      {dim.map(([a, b]) => (
        <div
          key={a}
          className="range-dim"
          style={{ left: `${(a / duration) * 100}%`, width: `${((b - a) / duration) * 100}%` }}
        />
      ))}
      {ranges.map(([a, b], i) => (
        <div
          className="range-selection"
          key={i}
          style={{ left: `${(a / duration) * 100}%`, width: `${((b - a) / duration) * 100}%` }}
        />
      ))}
      <div className="source-cursor" style={{ left: `${(cursor / duration) * 100}%` }} />
      {markers.flatMap((r, index) =>
        r.flatMap((v, side) =>
          !editableSides.includes(side)
            ? []
            : [
                <button
                  key={`${index}-${side}`}
                  className={`source-marker ${side ? 'end' : 'start'}${side && (((r[1] - r[0]) / duration) * width < 44 || (markers[index + 1] && ((markers[index + 1]![0] - r[1]) / duration) * width < 44)) ? ' crowded' : ''}`}
                  aria-label={`${markerLabel ? `第${index + 1}組${markerLabel}` : markers.length > 1 ? `第${index + 1}段` : '來源'}${side ? '終點' : '起點'}標記`}
                  title={`${side ? '終點' : '起點'} ${v.toFixed(2)} 秒`}
                  style={{ left: `${(v / duration) * 100}%` }}
                  onPointerDown={(e) => drag(index, side, e)}
                  onKeyDown={(e) => {
                    if (e.key === 'Home' || e.key === 'End') {
                      e.preventDefault();
                      update(index, side, e.key === 'Home' ? 0 : duration);
                    }
                    if (e.key === 'ArrowRight' || e.key === 'ArrowLeft') {
                      e.preventDefault();
                      update(index, side, v + (e.key === 'ArrowRight' ? 0.05 : -0.05));
                    }
                  }}
                >
                  <span aria-hidden="true">▼</span>
                  <small>
                    {index + 1}
                    {side ? '迄' : '起'}
                  </small>
                </button>,
              ],
        ),
      )}
    </div>
  );
}
