import { SelectionAddButton } from './SelectionAddButton';
import type { TimeRange } from '../engine/animationTiming';

/** The same paired insertion/removal controls for source, audio, template and effect ranges. */
export function RangeActions({
  ranges,
  cursor,
  duration,
  minimum,
  span,
  onChange,
  noun = '片段',
  showTimes = true,
  showCursor = true,
}: {
  ranges: TimeRange[];
  cursor: number;
  duration: number;
  minimum?: number;
  span?: number;
  onChange: (value: TimeRange[]) => void;
  noun?: string;
  showTimes?: boolean;
  showCursor?: boolean;
}) {
  return (
    <div className="range-actions">
      {showCursor && <p className="source-now">目前白線：{cursor.toFixed(2)} 秒</p>}
      <SelectionAddButton
        ranges={ranges}
        cursor={cursor}
        duration={duration}
        minimum={minimum}
        span={span}
        onChange={onChange}
      />
      {ranges.map(([a, b], i) => (
        <div className="range-pair-row" key={i}>
          {showTimes && (
            <span>
              第 {i + 1} 組：{a.toFixed(2)}–{b.toFixed(2)} 秒
            </span>
          )}
          <button className="chip" onClick={() => onChange(ranges.filter((_, j) => j !== i))}>
            移除第 {i + 1} 組{noun}
          </button>
        </div>
      ))}
    </div>
  );
}
