import { useState } from 'react';
import type { ClipAnimations } from '../../model/types';
import { TRANSITIONS } from '../../engine/transitions';
import { EffectPreviews } from './EffectPreviews';
import { Slider } from '../../ui/Slider';

export function AnimationSettings({
  value = {},
  onChange,
}: {
  value?: ClipAnimations;
  onChange: (value: ClipAnimations) => void;
}) {
  const [edge, setEdge] = useState<'enter' | 'exit'>('enter');
  const selected = value[edge];
  return (
    <section aria-label="單一素材進出場動畫">
      <div className="chips option-secondary">
        {(['enter', 'exit'] as const).map((id) => (
          <button
            key={id}
            className={`chip${edge === id ? ' active' : ''}`}
            aria-pressed={edge === id}
            onClick={() => setEdge(id)}
          >
            {id === 'enter' ? '進場' : '出場'}
          </button>
        ))}
        <button
          className={`chip${!selected ? ' active' : ''}`}
          aria-pressed={!selected}
          onClick={() => onChange({ ...value, [edge]: undefined })}
        >
          無動畫
        </button>
      </div>
      {selected && (
        <>
          <p>{TRANSITIONS.find((e) => e.id === selected.preset)?.label}</p>
          <Slider
            label="動畫長度"
            min={0.1}
            max={3}
            step={0.05}
            value={selected.duration}
            format={(v) => v.toFixed(2) + ' 秒'}
            onChange={(duration) => onChange({ ...value, [edge]: { ...selected, duration } })}
          />
        </>
      )}
      <EffectPreviews single={edge} presets={TRANSITIONS.map((e) => ({ id: e.id, type: 'transition' }))}>
        {TRANSITIONS.map((e) => (
          <button
            key={e.id}
            className={`effect-card${selected?.preset === e.id ? ' active' : ''}`}
            aria-label={`${edge === 'enter' ? '進場' : '出場'}：${e.label}`}
            aria-pressed={selected?.preset === e.id}
            onClick={() =>
              onChange({ ...value, [edge]: { preset: e.id, duration: selected?.duration ?? 0.6 } })
            }
          >
            <canvas
              width={160}
              height={96}
              data-effect-demo={`transition:${e.id}`}
              aria-label={`${e.label} A 動畫`}
            />
            <strong>{e.label}</strong>
          </button>
        ))}
      </EffectPreviews>
    </section>
  );
}
