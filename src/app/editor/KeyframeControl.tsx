import { Diamond } from 'lucide-react';
import { useEffect, useState } from 'react';
import { addKeyframe, animationTarget, animationValues, editAnimatedValues } from '../../engine/keyframes';
import { useProjectStore } from '../../store/projectStore';
import { toast, useUI } from '../../store/uiStore';
import type { AnimatedValues } from '../../model/types';
import { Sheet } from '../../ui/Sheet';
import { Slider } from '../../ui/Slider';
import { ColorPicker } from '../../ui/ColorPicker';
export function KeyframeControl({ detailsOnly = false }: { detailsOnly?: boolean }) {
  const project = useProjectStore((s) => s.project)!,
    id = useProjectStore((s) => s.selectedId);
  const player = useUI((s) => s.player);
  const [open, setOpen] = useState(false),
    [time, setTime] = useState(player?.time ?? 0);
  useEffect(() => player?.subscribe((t) => setTime(t)), [player]);
  const found = id
    ? (() => {
        try {
          return animationTarget(project, id);
        } catch {
          return null;
        }
      })()
    : null;
  const values = found ? animationValues(found.target, time - found.start) : null;
  const edit = (patch: Partial<AnimatedValues>) => {
    if (!id) return;
    try {
      useProjectStore.getState().apply((d) => editAnimatedValues(d, id, time, patch, true), {
        coalesce: `kf:${id}:${time}:${Object.keys(patch)[0]}`,
      });
    } catch (e) {
      toast((e as Error).message);
    }
  };
  return (
    <div className={detailsOnly ? 'freeze-fine-control' : 'freeze-controls'}>
      {!detailsOnly && (
        <button
          className={`chip freeze-button${found?.target.keyframes?.some((k) => Math.abs(k.time - (time - found.start)) < 0.02) ? ' active' : ''}`}
          aria-label="定格"
          aria-pressed={
            !!found?.target.keyframes?.some((k) => Math.abs(k.time - (time - found.start)) < 0.02)
          }
          title="在目前秒數標記定格"
          onClick={() => {
            if (!id || !found || found.item.type === 'audio') return toast('請先選取影像、文字或貼紙');
            player?.pause();
            try {
              useProjectStore.getState().apply((d) => addKeyframe(d, id, player?.time ?? 0));
              toast(`已標記 ${((player?.time ?? 0) - found.start).toFixed(2)} 秒定格`);
            } catch (e) {
              toast((e as Error).message);
            }
          }}
        >
          <Diamond
            size={20}
            fill={
              found?.target.keyframes?.some((k) => Math.abs(k.time - (time - found.start)) < 0.02)
                ? 'currentColor'
                : 'none'
            }
          />
          <span>定格</span>
        </button>
      )}
      {detailsOnly && (
        <button
          className="chip freeze-details-button"
          aria-label="定格細部調整"
          onClick={() => {
            if (!id || !found || found.item.type === 'audio') return toast('請先選取影像、文字或貼紙');
            player?.pause();
            setOpen(true);
          }}
        >
          定格細部調整
        </button>
      )}
      {open && found && values && id && (
        <Sheet open title="定格細部調整" onClose={() => setOpen(false)}>
          <p>
            {found.item.name ?? found.track.name} · 目前 {time.toFixed(2)} 秒
          </p>
          <p className="hint">
            按「定格」記錄目前素材與秒數，再移到後面拖移預覽或雙指縮放。兩點之間會漸變；這裡可選擇菱形、移除或微調位置、大小與色彩。
          </p>
          <div className="chips">
            {(found.target.keyframes ?? []).map((k, i) => (
              <span key={k.time} className="keyframe-entry">
                <button
                  className={`chip${Math.abs(k.time - (time - found.start)) < 0.02 ? ' active' : ''}`}
                  aria-pressed={Math.abs(k.time - (time - found.start)) < 0.02}
                  onClick={() =>
                    player?.seek(Math.min(found.start + found.duration - 0.001, found.start + k.time))
                  }
                >
                  ◇ {k.time.toFixed(2)} 秒
                </button>
                <button
                  className="chip"
                  aria-label={`移除第${i + 1}個定格`}
                  onClick={() =>
                    useProjectStore.getState().apply((d) => {
                      const f = animationTarget(d, id);
                      f.target.keyframes = f.target.keyframes?.filter((_, j) => j !== i);
                    })
                  }
                >
                  移除
                </button>
              </span>
            ))}
          </div>
          <button
            className="btn"
            onClick={() => useProjectStore.getState().apply((d) => addKeyframe(d, id, time))}
          >
            新增目前定格
          </button>
          {(
            [
              ['x', '水平位置', -100, 200, 100],
              ['y', '垂直位置', -100, 200, 100],
              ['scale', '定格大小', 5, 500, 100],
              ['brightness', '定格亮度', 0, 200, 100],
            ] as const
          ).map(([key, label, min, max, factor]) => (
            <Slider
              key={key}
              label={label}
              min={min}
              max={max}
              step={1}
              value={Math.round(values[key] * factor)}
              format={(v) => `${v}%`}
              onChange={(v) => edit({ [key]: v / factor })}
            />
          ))}
          <ColorPicker label="定格色彩" value={values.tint} onChange={(tint) => edit({ tint })} />
          <button className="btn primary done" onClick={() => setOpen(false)}>
            完成定格
          </button>
        </Sheet>
      )}
    </div>
  );
}
