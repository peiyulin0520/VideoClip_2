import type { ItemBase } from '../../model/types';
import { findItem } from '../../engine/timeline';
import { useProjectStore } from '../../store/projectStore';
import { useUI } from '../../store/uiStore';
import { Slider } from '../../ui/Slider';
export function ContinuousPanel() {
  const project = useProjectStore((s) => s.project)!,
    id = useProjectStore((s) => s.selectedId);
  const found = findItem(project, id);
  if (!found || found.item.type === 'audio')
    return <p className="hint">先點選影像、貼圖、文字或版型，再選整段特效。</p>;
  const group = found.track.template && useUI.getState().templateCellId !== id && found.item.type !== 'text';
  const value = group ? found.track.layout?.continuous : found.item.continuous;
  const set = (motion: ItemBase['continuous']) => {
    useUI.getState().player?.pause();
    useProjectStore.getState().apply((d) => {
      const f = findItem(d, id);
      if (!f || f.track.locked) return;
      const target = group ? f.track.layout! : f.item;
      target.continuous = motion;
    });
  };
  return (
    <section aria-label="整段特效設定">
      <p className="hint">從素材起點到終點持續移動；進場、退場和定格仍可另外設定。</p>
      <div className="chips option-secondary">
        {(
          [
            ['none', '無'],
            ['drift', '向上捲動'],
            ['slide', '滑入滑出'],
            ['breathe', '呼吸'],
            ['sway', '輕晃'],
            ['shake', '持續震動'],
          ] as const
        )
          .filter(([kind]) => !group || kind !== 'sway')
          .map(([kind, label]) => (
            <button
              key={kind}
              className={`chip${(value?.kind ?? 'none') === kind ? ' active' : ''}`}
              aria-pressed={(value?.kind ?? 'none') === kind}
              onClick={() =>
                set(
                  kind === 'none'
                    ? undefined
                    : { kind, strength: value?.strength ?? 1, speed: value?.speed ?? 1 },
                )
              }
            >
              {label}
            </button>
          ))}
      </div>
      {value && (
        <>
          <Slider
            label="整段特效力道"
            min={0}
            max={200}
            step={1}
            value={(value.strength ?? 1) * 100}
            format={(v) => `${v}%`}
            onChange={(v) => set({ ...value, strength: v / 100 })}
          />
          <Slider
            label="整段特效速度"
            min={25}
            max={300}
            step={5}
            value={(value.speed ?? 1) * 100}
            format={(v) => `${v / 100}倍`}
            onChange={(v) => set({ ...value, speed: v / 100 })}
          />
        </>
      )}
    </section>
  );
}
