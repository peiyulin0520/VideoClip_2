import { useState } from 'react';
import { ArrowUp, ArrowDown, Eye, EyeOff, Lock } from 'lucide-react';
import type { Item, Project, Track } from '../../model/types';
import { itemName } from '../../engine/itemName';
import { reorderTemplateMember, templateLane } from '../../engine/templateModel';
import { useProjectStore } from '../../store/projectStore';

export function FrameworkLayers({
  project,
  track,
  items,
}: {
  project: Project;
  track: Track;
  items: Item[];
}) {
  const [open, setOpen] = useState(false);
  const selected = useProjectStore((s) => s.selectedId);
  const members = items.filter((i) => i.templateRole !== 'frame');
  const lanePatch = (item: Item, kind: 'hidden' | 'locked') =>
    useProjectStore.getState().apply((d) => {
      const tr = d.tracks.find((t) => t.id === track.id)!;
      const lane = templateLane(tr as never, item);
      if (lane) lane[kind] = !lane[kind];
    });
  return (
    <li className="framework-layer-group" data-testid="framework-layer-group">
      <div className="layer-row">
        <button className="layer-name" aria-expanded={open} onClick={() => setOpen(!open)}>
          {open ? '▾' : '▸'} {track.name} · {members.length} 個素材
        </button>
        <button
          className="chip"
          onClick={() => useProjectStore.getState().select(track.layout!.frameItem!.id)}
        >
          外框
        </button>
      </div>
      {open && (
        <ul className="layer-list">
          {members.map((item) => {
            const lane = templateLane(track, item);
            return (
              <li
                key={item.id}
                data-testid="layer-row"
                data-item-id={item.id}
                className={`layer-row${selected === item.id ? ' selected' : ''}`}
              >
                <button className="layer-name" onClick={() => useProjectStore.getState().select(item.id)}>
                  <span className="layer-text">
                    {item.templateCell ? `第 ${item.templateCell} 格 · ` : '整組 · '}
                    {itemName(project, item)}
                  </span>
                </button>
                <button
                  className="icon-btn sm"
                  aria-label={`${itemName(project, item)} ${lane?.hidden ? '顯示' : '隱藏'}`}
                  onClick={() => lanePatch(item, 'hidden')}
                >
                  {lane?.hidden ? <EyeOff size={17} /> : <Eye size={17} />}
                </button>
                <button
                  className={`icon-btn sm${lane?.locked ? ' on' : ''}`}
                  aria-label={`${itemName(project, item)} ${lane?.locked ? '解鎖' : '鎖定'}`}
                  onClick={() => lanePatch(item, 'locked')}
                >
                  <Lock size={17} />
                </button>
                <button
                  className="icon-btn sm"
                  aria-label={`${itemName(project, item)} 往上一層`}
                  onClick={() =>
                    useProjectStore
                      .getState()
                      .apply((d) =>
                        reorderTemplateMember(d.tracks.find((t) => t.id === track.id)! as never, item.id, 1),
                      )
                  }
                >
                  <ArrowUp size={17} />
                </button>
                <button
                  className="icon-btn sm"
                  aria-label={`${itemName(project, item)} 往下一層`}
                  onClick={() =>
                    useProjectStore
                      .getState()
                      .apply((d) =>
                        reorderTemplateMember(d.tracks.find((t) => t.id === track.id)! as never, item.id, -1),
                      )
                  }
                >
                  <ArrowDown size={17} />
                </button>
              </li>
            );
          })}
        </ul>
      )}
    </li>
  );
}
