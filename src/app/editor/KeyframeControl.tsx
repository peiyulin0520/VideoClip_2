import { Diamond } from 'lucide-react';
import { useEffect, useState } from 'react';
import { addKeyframe, animationTarget, animationValues, editAnimatedValues } from '../../engine/keyframes';
import { useProjectStore } from '../../store/projectStore';
import { toast, useUI } from '../../store/uiStore';
import type { AnimatedValues } from '../../model/types';
import { Sheet } from '../../ui/Sheet';
import { Slider } from '../../ui/Slider';
import { ColorPicker } from '../../ui/ColorPicker';
export function KeyframeControl() {
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
    <>
      <button
        className="icon-btn"
        aria-label="新增或更新關鍵幀"
        title="關鍵幀"
        onClick={() => {
          if (!id || !found || found.item.type === 'audio') return toast('請先選取影像、文字或貼紙');
          player?.pause();
          try {
            useProjectStore.getState().apply((d) => addKeyframe(d, id, player?.time ?? 0));
            setOpen(true);
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
      </button>
      {open && found && values && id && (
        <Sheet open title="線性關鍵幀" onClose={() => setOpen(false)}>
          <p>
            {found.item.name ?? found.track.name} · 目前 {time.toFixed(2)} 秒
          </p>
          <p className="hint">
            先在起點新增菱形，再移到後面調位置、大小或色彩，會建立下一個菱形；兩點之間線性漸變，最後一點之後保持設定。
          </p>
          <div className="chips">
            {(found.target.keyframes ?? []).map((k, i) => (
              <span key={k.time} className="keyframe-entry">
                <button
                  className="chip"
                  onClick={() =>
                    player?.seek(Math.min(found.start + found.duration - 0.001, found.start + k.time))
                  }
                >
                  ◇ {k.time.toFixed(2)} 秒
                </button>
                <button
                  className="chip"
                  aria-label={`移除第${i + 1}個關鍵幀`}
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
            新增目前關鍵幀
          </button>
          {(
            [
              ['x', '水平位置', -100, 200, 100],
              ['y', '垂直位置', -100, 200, 100],
              ['scale', '關鍵幀大小', 5, 500, 100],
              ...(!found.track.template ? ([['rotation', '關鍵幀旋轉', -180, 180, 1]] as const) : []),
              ['opacity', '關鍵幀透明度', 0, 100, 100],
              ['brightness', '關鍵幀亮度', 0, 200, 100],
              ['saturation', '關鍵幀飽和度', 0, 200, 100],
              ['temperature', '關鍵幀色溫', -100, 100, 100],
            ] as const
          ).map(([key, label, min, max, factor]) => (
            <Slider
              key={key}
              label={label}
              min={min}
              max={max}
              step={1}
              value={Math.round(values[key] * factor)}
              format={(v) => `${v}${key === 'rotation' ? '°' : '%'}`}
              onChange={(v) => edit({ [key]: v / factor })}
            />
          ))}
          <ColorPicker label="關鍵幀色彩" value={values.tint} onChange={(tint) => edit({ tint })} />
          <button className="btn primary done" onClick={() => setOpen(false)}>
            完成關鍵幀
          </button>
        </Sheet>
      )}
    </>
  );
}
