import { addSourceSelection } from '../engine/sourceSelections';
import { toast } from '../store/uiStore';
export function SelectionAddButton({
  ranges,
  cursor,
  duration,
  minimum,
  onChange,
}: {
  ranges: [number, number][];
  cursor: number;
  duration: number;
  minimum?: number;
  onChange: (value: [number, number][]) => void;
}) {
  return (
    <button
      className="btn"
      onClick={() => {
        try {
          onChange(addSourceSelection(ranges, cursor, duration, minimum));
        } catch (e) {
          toast((e as Error).message);
        }
      }}
    >
      在白線位置新增一組起迄標記
    </button>
  );
}
