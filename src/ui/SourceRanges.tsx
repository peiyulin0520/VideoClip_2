import { useRef, type PointerEvent } from 'react';
import { MIN_CLIP_DURATION } from '../model/defaults';

/** Small visible markers above the seconds; each retains a 44px touch target. */
export function SourceRanges({
  duration,
  ranges,
  thumbs,
  onChange,
  onSeek,
  cursor = 0,
}: {
  duration: number;
  ranges: [number, number][];
  thumbs: string[];
  onChange: (ranges: [number, number][]) => void;
  onSeek: (time: number) => void;
  cursor?: number;
}) {
  const bar = useRef<HTMLDivElement>(null);
  const update = (index: number, side: number, value: number) => {
    const next = ranges.map((r) => [...r] as [number, number]);
    const r = next[index]!;
    const low = side ? r[0] + MIN_CLIP_DURATION : (next[index - 1]?.[1] ?? 0);
    const high = side ? (next[index + 1]?.[0] ?? duration) : r[1] - MIN_CLIP_DURATION;
    r[side] = Math.max(low, Math.min(high, value));
    onChange(next);
    onSeek(r[side]!);
  };
  const drag = (index: number, side: number, e: PointerEvent<HTMLButtonElement>) => {
    e.preventDefault();
    e.currentTarget.setPointerCapture(e.pointerId);
    const el = e.currentTarget,
      originX = e.clientX,
      origin = ranges[index]![side]!;
    const move = (ev: globalThis.PointerEvent) =>
      update(index, side, origin + ((ev.clientX - originX) / bar.current!.clientWidth) * duration);
    const up = () => {
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
        onPointerDown={(e) =>
          onSeek(
            Math.max(
              0,
              Math.min(
                duration,
                ((e.clientX - bar.current!.getBoundingClientRect().left) / bar.current!.clientWidth) *
                  duration,
              ),
            ),
          )
        }
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
      {ranges.flatMap((r, index) =>
        r.map((v, side) => (
          <button
            key={`${index}-${side}`}
            className={`source-marker ${side ? 'end' : 'start'}`}
            aria-label={`${ranges.length > 1 ? `第${index + 1}段` : '來源'}${side ? '終點' : '起點'}標記`}
            title={`${side ? '終點' : '起點'} ${v.toFixed(2)} 秒`}
            style={{ left: `${(v / duration) * 100}%` }}
            onPointerDown={(e) => drag(index, side, e)}
            onKeyDown={(e) => {
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
          </button>
        )),
      )}
    </div>
  );
}
