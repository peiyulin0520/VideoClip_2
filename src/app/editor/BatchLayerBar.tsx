import { deleteSelectedTracks, mergeSelectedTracks, shiftSelectedTracks } from '../../engine/batchLayers';
import { useProjectStore } from '../../store/projectStore';
import { toast } from '../../store/uiStore';
export function BatchLayerBar({ ids, onChange }: { ids: string[]; onChange: (ids: string[]) => void }) {
  const p = useProjectStore((s) => s.project)!;
  const action = (run: Parameters<ReturnType<typeof useProjectStore.getState>['apply']>[0]) => {
    try {
      useProjectStore.getState().apply(run);
    } catch (e) {
      toast((e as Error).message);
    }
  };
  return (
    <div className="batch-layer-bar" role="toolbar" aria-label="多選圖層操作">
      <strong>已選 {ids.length} 層</strong>
      <button className="chip" onClick={() => onChange(p.tracks.map((t) => t.id))}>
        全選圖層
      </button>
      <button className="chip" onClick={() => action((d) => shiftSelectedTracks(d, ids, 1))}>
        選取圖層上移
      </button>
      <button className="chip" onClick={() => action((d) => shiftSelectedTracks(d, ids, -1))}>
        選取圖層下移
      </button>
      <button
        className="chip"
        onClick={() =>
          action((d) => {
            for (const t of d.tracks) if (ids.includes(t.id)) t.hidden = true;
          })
        }
      >
        隱藏選取圖層
      </button>
      <button
        className="chip"
        onClick={() =>
          action((d) => {
            for (const t of d.tracks) if (ids.includes(t.id)) t.hidden = false;
          })
        }
      >
        顯示選取圖層
      </button>
      <button
        className="chip"
        onClick={() =>
          action((d) => {
            const id = mergeSelectedTracks(d, ids);
            onChange([id]);
          })
        }
      >
        合併成同一列
      </button>
      <button
        className="chip"
        onClick={() =>
          action((d) => {
            const id = mergeSelectedTracks(d, ids, true);
            onChange([id]);
          })
        }
      >
        合併並依序接續
      </button>
      <button
        className="chip danger"
        onClick={() =>
          action((d) => {
            deleteSelectedTracks(d, ids);
            onChange([]);
          })
        }
      >
        刪除選取圖層
      </button>
      <button className="chip" onClick={() => onChange([])}>
        完成多選
      </button>
    </div>
  );
}
