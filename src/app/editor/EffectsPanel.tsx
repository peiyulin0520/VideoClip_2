import { useProjectStore } from '../../store/projectStore';
import { useUI } from '../../store/uiStore';
import { newId } from '../../model/defaults';
import { EFFECTS } from '../../engine/sceneEffects';
import { Slider } from '../../ui/Slider';

export function EffectsPanel() {
  const p = useProjectStore((s) => s.project)!;
  return (
    <div className="panel" aria-label="轉場與畫面特效">
      <h3>轉場特效</h3>
      <p className="hint">
        先將播放頭移到交接處，加入後調整時間與長度。特效中點最亮／最暗，對準兩段影片交接處即可。
      </p>
      <div className="effect-grid">
        {EFFECTS.map((e) => (
          <button
            key={e.id}
            className="btn"
            onClick={() => {
              const time = useUI.getState().player?.time ?? 0;
              useProjectStore.getState().apply((d) => {
                (d.effects ??= []).push({
                  id: newId('fx_'),
                  preset: e.id,
                  start: Math.max(0, time - 0.3),
                  duration: 0.6,
                  strength: 1,
                });
              });
            }}
          >
            <strong>{e.label}</strong>
            <small>{e.description}</small>
          </button>
        ))}
      </div>
      {(p.effects ?? []).map((e) => (
        <div className="effect-row" key={e.id}>
          <h4>{EFFECTS.find((x) => x.id === e.preset)!.label}</h4>
          <label className="field">
            出現時間（秒）
            <input
              type="number"
              min={0}
              step={0.01}
              aria-label={`特效出現時間 ${e.id}`}
              value={e.start}
              onChange={(event) => {
                const value = Math.max(0, Number(event.target.value));
                useProjectStore.getState().apply((d) => {
                  d.effects!.find((x) => x.id === e.id)!.start = value;
                });
              }}
            />
          </label>
          <Slider
            label={`特效長度 ${e.id}`}
            min={0.1}
            max={3}
            step={0.05}
            value={e.duration}
            format={(v) => `${v.toFixed(2)} 秒`}
            onChange={(v) =>
              useProjectStore.getState().apply(
                (d) => {
                  d.effects!.find((x) => x.id === e.id)!.duration = v;
                },
                { coalesce: `fx-time:${e.id}` },
              )
            }
          />
          <Slider
            label={`特效強度 ${e.id}`}
            min={0}
            max={100}
            step={1}
            value={e.strength * 100}
            format={(v) => `${v}%`}
            onChange={(v) =>
              useProjectStore.getState().apply(
                (d) => {
                  d.effects!.find((x) => x.id === e.id)!.strength = v / 100;
                },
                { coalesce: `fx-strength:${e.id}` },
              )
            }
          />
          <div className="chips">
            <button
              className="chip"
              onClick={() => {
                useUI.getState().player?.pause();
                useUI.getState().player?.seek(e.start + e.duration / 2);
              }}
            >
              檢視特效中點
            </button>
            <button
              className="chip"
              onClick={() =>
                useProjectStore.getState().apply((d) => {
                  d.effects = d.effects?.filter((x) => x.id !== e.id);
                })
              }
            >
              移除特效
            </button>
          </div>
        </div>
      ))}
      <p className="hint">
        特效獨立於影像、字卡及音軌；刪除特效不會刪除素材。展開多格與快速換字體可到「版型 → 展開故事」。
      </p>
    </div>
  );
}
