import { useState } from 'react';
import type { ClipAnimations, Project } from '../../model/types';
import { TRANSITIONS } from '../../engine/transitions';
import { EffectPreviews } from './EffectPreviews';
import { EffectTimingEditor } from './EffectTimingEditor';
import { animationRanges, resizeTimeRange } from '../../engine/animationTiming';
import { Slider } from '../../ui/Slider';

export function AnimationSettings({
  value = {},
  onChange,
  duration,
  start = 0,
  thumbs = [],
  preview,
}: {
  value?: ClipAnimations;
  onChange: (value: ClipAnimations) => void;
  duration: number;
  start?: number;
  thumbs?: string[];
  preview: (value: ClipAnimations) => Project;
}) {
  const [edge, setEdge] = useState<'enter' | 'exit'>('enter');
  const selected = value[edge];
  const [timing, setTiming] = useState(false);
  const ranges = animationRanges(selected, edge, duration);
  const length = ranges[0] ? ranges[0][1] - ranges[0][0] : (selected?.duration ?? 0.6);
  const withRanges = (r: [number, number][]) => ({
    ...value,
    [edge]: selected && { ...selected, duration: r[0] ? r[0][1] - r[0][0] : selected.duration, ranges: r },
  });
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
          <p>
            {edge === 'enter' ? 'B 進場' : 'A 退場'} ·{' '}
            {TRANSITIONS.find((e) => e.id === selected.preset)?.label}
          </p>
          <Slider
            label="動畫長度"
            min={0.01}
            max={duration}
            step={0.05}
            value={length}
            format={(v) => v.toFixed(2) + ' 秒'}
            onChange={(length) => {
              const current = ranges[0] ?? (edge === 'enter' ? [0, 0] : [duration, duration]);
              const range: [number, number] = resizeTimeRange(
                current as [number, number],
                length,
                0,
                ranges[1]?.[0] ?? duration,
              );
              onChange(withRanges([range, ...ranges.slice(1)]));
            }}
          />
          <button className="chip" onClick={() => setTiming(true)}>
            調整特效起迄
          </button>
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
              onChange({
                ...value,
                [edge]: {
                  ...selected,
                  preset: e.id,
                  duration: selected?.duration ?? Math.min(0.6, duration),
                },
              })
            }
          >
            <canvas
              width={160}
              height={96}
              data-effect-demo={`transition:${e.id}`}
              aria-label={`${e.label} ${edge === 'enter' ? 'B' : 'A'} 動畫`}
            />
            <strong>{e.label}</strong>
          </button>
        ))}
      </EffectPreviews>
      {timing && selected && (
        <EffectTimingEditor
          ranges={ranges}
          duration={duration}
          start={start}
          thumbs={thumbs}
          onClose={() => setTiming(false)}
          preview={(r) => preview(withRanges(r))}
          onApply={(r) => onChange(withRanges(r))}
        />
      )}
    </section>
  );
}
