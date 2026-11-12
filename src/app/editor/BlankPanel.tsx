import { useState } from 'react';
import { ColorPicker } from '../../ui/ColorPicker';
import { addSolid } from '../../engine/materials';
import { useUI, toast } from '../../store/uiStore';
import { useProjectStore } from '../../store/projectStore';
import { relayout } from '../../engine/timeline';
import type { VideoItem } from '../../model/types';

export function BlankPanel() {
  const project = useProjectStore((s) => s.project)!;
  const [color, setColor] = useState('#000000');
  const add = async (layer: boolean) => {
    useUI.getState().setBusy('正在加入色塊…');
    try {
      await addSolid(color, useUI.getState().player?.time ?? 0, layer);
      toast('已加入：長按移動，拉左右邊緣調整長度');
    } catch (e) {
      toast((e as Error).message);
    } finally {
      useUI.getState().setBusy(null);
    }
  };
  return (
    <div className="material-section">
      <h3>留白／色塊素材</h3>
      <div className="chips">
        <button className="chip" onClick={() => setColor('#000000')}>
          黑色
        </button>
        <button className="chip" onClick={() => setColor('#ffffff')}>
          白色
        </button>
      </div>
      <ColorPicker label="色塊顏色" value={color} onChange={setColor} />
      <div className="chips">
        <button className="btn" onClick={() => void add(false)}>
          插入主軌留白
        </button>
        <button className="btn" onClick={() => void add(true)}>
          加入色塊圖層
        </button>
      </div>
      <p className="hint">可放在開頭或影片之間。主軌留白會推後後續影片；色塊圖層可任意拖放在時間軸。</p>
      <label className="check-row">
        <input
          type="checkbox"
          aria-label="自由時間軸"
          checked={!!project.freeMain}
          onChange={(e) => {
            const free = e.target.checked;
            useProjectStore.getState().apply((d) => {
              d.freeMain = free;
              if (free) d.mainOffset = 0; // Existing starts already contain the legacy opening gap.
              if (!free) {
                const tr = d.tracks.find((t) => t.kind === 'main')!;
                tr.items = relayout(tr.items as VideoItem[], d.mainOffset ?? 0);
              }
            });
          }}
        />
        自由時間軸（影片可拖出間隔）
      </label>
    </div>
  );
}
