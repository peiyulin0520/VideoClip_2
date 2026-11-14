import { addSourceSelection } from '../engine/sourceSelections';
import { toast } from '../store/uiStore';
export function SelectionAddButton({
  ranges,
  cursor,
  duration,
  minimum,
  span,
  onChange,
}: {
  ranges: [number, number][];
  cursor: number;
  duration: number;
  minimum?: number;
  span?: number;
  onChange: (value: [number, number][]) => void;
}) {
  return (
    <button
      className="btn"
      onClick={() => {
        try {
          onChange(addSourceSelection(ranges, cursor, duration, minimum, span));
        } catch (e) {
          toast((e as Error).message);
        }
      }}
    >
      在白線位置新增一組起迄標記
    </button>
  );
}
