import { useProjectStore } from '../../store/projectStore';
import { useUI } from '../../store/uiStore';
/** Explicit insertion destination; editing a child never silently inserts outside its group. */
export function GroupDestination() {
  const p = useProjectStore((s) => s.project)!,
    target = useUI((s) => s.templateDestination);
  const groups = p.tracks.filter((t) => t.template);
  if (!groups.length) return null;
  const group = groups.find((t) => t.id === target?.trackId);
  return (
    <div className="group-destination">
      <label className="field">
        新增素材位置
        <select
          aria-label="新增素材位置"
          value={group?.id ?? ''}
          onChange={(e) =>
            useUI.setState({ templateDestination: e.target.value ? { trackId: e.target.value } : null })
          }
        >
          <option value="">專案圖層</option>
          {groups.map((t) => (
            <option value={t.id} key={t.id}>
              {t.name}
            </option>
          ))}
        </select>
      </label>
      {group && (
        <label className="field">
          範圍
          <select
            aria-label="新增素材格子"
            value={target?.cell ?? 0}
            onChange={(e) =>
              useUI.setState({
                templateDestination: { trackId: group.id, cell: Number(e.target.value) || undefined },
              })
            }
          >
            <option value={0}>整組版型</option>
            {Array.from({ length: group.layout?.count ?? group.items.length }, (_, i) => (
              <option key={i} value={i + 1}>
                第 {i + 1} 格
              </option>
            ))}
          </select>
        </label>
      )}
    </div>
  );
}
