import { useState } from 'react';
import type { Track } from '../../model/types';
import { useProjectStore } from '../../store/projectStore';
import { toast, useUI } from '../../store/uiStore';
import { setTemplatePlayback, moveTemplateChild } from '../../engine/templatePlayback';
import { itemName } from '../../engine/itemName';
import { addTemplateSolid } from '../../engine/materials';
import { ColorPicker } from '../../ui/ColorPicker';

export function TemplatePlaybackSettings({ track }: { track: Track }) {
  const p = useProjectStore((s) => s.project)!,
    [color, setColor] = useState('#eee5d8');
  return (
    <section className="template-playback-settings" aria-label="版型播放順序">
      <h3>版型播放</h3>
      <div className="chips">
        {(
          [
            ['simultaneous', '同時播放'],
            ['sequential', '輪序播放、播完停格'],
          ] as const
        ).map(([mode, label]) => (
          <button
            key={mode}
            className={`chip${(track.layout?.playback ?? 'simultaneous') === mode ? ' active' : ''}`}
            aria-pressed={(track.layout?.playback ?? 'simultaneous') === mode}
            onClick={() => {
              useUI.getState().player?.pause();
              try {
                useProjectStore.getState().apply((d) => setTemplatePlayback(d, track.id, mode));
                const player = useUI.getState().player,
                  layout = useProjectStore.getState().project?.tracks.find((t) => t.id === track.id)?.layout;
                if (
                  player &&
                  layout &&
                  (player.time < layout.start || player.time >= layout.start + layout.duration)
                )
                  player.seek(layout.start);
              } catch (e) {
                toast((e as Error).message);
              }
            }}
          >
            {label}
          </button>
        ))}
      </div>
      {track.items.map((item, i) => (
        <div className="template-child-entry" key={item.id}>
          <span>
            {i + 1} · {itemName(p, item)} · {item.duration.toFixed(2)} 秒
          </span>
          <button
            className="icon-btn"
            aria-label={`第${i + 1}個素材提前`}
            disabled={i === 0}
            onClick={() =>
              useProjectStore.getState().apply((d) => moveTemplateChild(d, track.id, item.id, -1))
            }
          >
            ←
          </button>
          <button
            className="icon-btn"
            aria-label={`第${i + 1}個素材延後`}
            disabled={i === track.items.length - 1}
            onClick={() =>
              useProjectStore.getState().apply((d) => moveTemplateChild(d, track.id, item.id, 1))
            }
          >
            →
          </button>
        </div>
      ))}
      <details>
        <summary>群組加入色塊</summary>
        <ColorPicker label="群組色塊" value={color} onChange={setColor} />
        <button
          className="chip"
          onClick={() => void addTemplateSolid(track.id, color).catch((e) => toast((e as Error).message))}
        >
          新增群組色塊
        </button>
      </details>
    </section>
  );
}
