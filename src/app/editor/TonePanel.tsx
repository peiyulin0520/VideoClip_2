import { itemName } from '../../engine/itemName';
import { memo, useEffect, useState } from 'react';
import {
  toggleKeyframe,
  keyframeAt,
  animationTarget,
  animationValues,
  editAnimatedValues,
} from '../../engine/keyframes';
import {
  DEFAULT_ADJUSTMENT,
  gradeRGB,
  TONE_KEYS,
  TONE_PRESETS,
  type ToneKey,
  type TonePreset,
} from '../../engine/grade';
import type { ColorAdjustment } from '../../model/types';
import { useProjectStore } from '../../store/projectStore';
import { toast, useUI } from '../../store/uiStore';
import { Slider } from '../../ui/Slider';
import { KeyframeControl } from './KeyframeControl';

const CONTROLS: {
  key: ToneKey;
  label: string;
  min: number;
  max: number;
  factor: number;
  offset: number;
  step: number;
}[] = [
  { key: 'brightness', label: '亮度', min: -100, max: 100, factor: 100, offset: 1, step: 1 },
  { key: 'saturation', label: '飽和度', min: -100, max: 100, factor: 100, offset: 1, step: 1 },
  { key: 'exposure', label: '曝光', min: -2, max: 2, factor: 1, offset: 0, step: 0.05 },
  { key: 'highlights', label: '高光', min: -100, max: 100, factor: 100, offset: 0, step: 1 },
  { key: 'contrast', label: '對比', min: -100, max: 100, factor: 100, offset: 1, step: 1 },
  { key: 'blacks', label: '黑點', min: -100, max: 100, factor: 100, offset: 0, step: 1 },
  { key: 'vibrance', label: '鮮艷度', min: -100, max: 100, factor: 100, offset: 0, step: 1 },
  { key: 'shadows', label: '陰影', min: -100, max: 100, factor: 100, offset: 0, step: 1 },
  { key: 'temperature', label: '色溫', min: -100, max: 100, factor: 100, offset: 0, step: 1 },
  { key: 'fade', label: '淡化', min: 0, max: 100, factor: 100, offset: 0, step: 1 },
];
const PresetThumb = memo(function PresetThumb({ preset }: { preset: TonePreset }) {
  const color = (rgb: number[]) =>
    `rgb(${gradeRGB(rgb, preset.values)
      .map((v) => Math.round(v * 255))
      .join(' ')})`;
  return (
    <svg viewBox="0 0 100 58" aria-hidden="true" focusable="false">
      <rect width="100" height="58" fill={color([0.48, 0.7, 0.84])} />
      <circle cx="75" cy="16" r="9" fill={color([0.95, 0.83, 0.52])} />
      <path d="M0 39 28 17 64 51H0Z" fill={color([0.22, 0.44, 0.32])} />
      <path d="m30 50 35-24 35 15v17H30Z" fill={color([0.46, 0.62, 0.42])} />
      <path d="M0 48H100V58H0Z" fill={color([0.58, 0.31, 0.25])} />
      {[0.12, 0.5, 0.88].map((v, i) => (
        <rect key={v} x={i * 10 + 3} y="50" width="8" height="5" fill={color([v, v, v])} />
      ))}
    </svg>
  );
});

export function TonePanel() {
  const project = useProjectStore((s) => s.project)!;
  const selectedId = useProjectStore((s) => s.selectedId);
  const player = useUI((s) => s.player);
  const [time, setTime] = useState(player?.time ?? 0);
  useEffect(
    () =>
      player?.subscribe((t, playing) => {
        if (!playing) setTime(t);
      }),
    [player],
  );
  const found = selectedId
    ? (() => {
        try {
          return animationTarget(project, selectedId);
        } catch {
          return null;
        }
      })()
    : null;
  const visual = !!found && found.item.type !== 'audio';
  const local = found ? time - found.start : 0;
  const inRange = !!found && local >= -0.01 && local <= found.duration + 0.01;
  const enabled = visual && inRange && !found!.track.locked;
  const selectedFrame =
    found && !player?.isPlaying
      ? keyframeAt(found.target, local, 7 / useUI.getState().keyframePps)
      : undefined;
  const values = found ? animationValues(found.target, selectedFrame?.time ?? local) : null;
  const frames = found?.target.keyframes ?? [];
  const active =
    values &&
    TONE_PRESETS.find(
      (p) =>
        TONE_KEYS.every((k) => Math.abs(p.values[k] - values[k]) < 0.000001) && p.values.tint === values.tint,
    );
  const edit = (patch: Partial<ColorAdjustment>, coalesce?: string) => {
    if (!enabled || !selectedId) return;
    // A moving playhead must not create one diamond per slider event.
    if (frames.length) player?.pause();
    try {
      const at = player?.time ?? time;
      useProjectStore
        .getState()
        .apply(
          (d) => editAnimatedValues(d, selectedId, at, patch, false, 7 / useUI.getState().keyframePps),
          coalesce
            ? { coalesce: `tone:${selectedId}:${frames.length ? at : 'clip'}:${coalesce}` }
            : undefined,
        );
    } catch (e) {
      toast((e as Error).message);
    }
  };
  return (
    <section className="panel tone-panel" aria-label="色調設定">
      <label className="field">
        套用素材
        <select
          aria-label="色調素材"
          value={visual ? selectedId! : ''}
          onChange={(e) => {
            const id = e.target.value;
            useProjectStore.getState().select(id || null);
            const item = project.tracks.flatMap((t) => t.items).find((it) => it.id === id);
            if (item) {
              player?.pause();
              player?.seek(item.start);
            }
          }}
        >
          <option value="">選擇素材</option>
          {project.tracks.flatMap((track) =>
            track.items
              .filter((it) => it.type !== 'audio')
              .map((it) => (
                <option key={it.id} value={it.id}>
                  {itemName(project, it)}
                  {track.template ? ' · 整組版型' : ''}
                </option>
              )),
          )}
        </select>
      </label>
      {!visual && <p className="hint">先選擇影像、照片、貼紙或文字。</p>}
      {visual && !inRange && <p className="hint">請將白線移到選取素材的時間範圍。</p>}
      {found?.track.locked && <p className="hint">請先解鎖圖層。</p>}
      <fieldset disabled={!enabled} className="tone-controls">
        <div className="tone-heading">
          <span>基礎色調</span>
          <span>{active?.name ?? '自訂'}</span>
        </div>
        <div className="tone-presets" role="group" aria-label="基礎色調">
          {TONE_PRESETS.map((p) => (
            <button
              key={p.id}
              className={`tone-preset${active?.id === p.id ? ' active' : ''}`}
              aria-label={`套用${p.name}`}
              aria-pressed={active?.id === p.id}
              onClick={() => edit(p.values)}
            >
              <PresetThumb preset={p} />
              <span>{p.name}</span>
            </button>
          ))}
        </div>
        <div className="tone-actions chips">
          <button
            className={`chip tone-record${frames.some((f) => Math.abs(f.time - local) < 0.02) ? ' active' : ''}`}
            aria-pressed={frames.some((f) => Math.abs(f.time - local) < 0.02)}
            onClick={() => {
              if (!selectedId) return;
              player?.pause();
              try {
                useProjectStore.getState().apply((d) => toggleKeyframe(d, selectedId, player?.time ?? time));
              } catch (e) {
                toast((e as Error).message);
              }
            }}
          >
            ◇ 定格目前色調
          </button>
          <button className="chip" onClick={() => edit(DEFAULT_ADJUSTMENT)}>
            還原目前色調
          </button>
        </div>
        <p className="hint">
          {frames.length
            ? '調整會記錄在目前秒數；兩個定格之間平滑變色。'
            : '未加定格時套用整段；在不同秒數定格可漸變色調。'}
        </p>
        {!!frames.length && (
          <div className="chips tone-frames" aria-label="色調定格列表">
            {frames.map((f, i) => (
              <button
                key={f.time}
                className={`chip${Math.abs(f.time - local) < 0.02 ? ' active' : ''}`}
                aria-pressed={Math.abs(f.time - local) < 0.02}
                aria-label={`色調定格${i + 1} ${f.time.toFixed(2)}秒`}
                onClick={() => {
                  player?.pause();
                  player?.seek(Math.min(found!.start + found!.duration - 0.001, found!.start + f.time));
                }}
              >
                ◇ {f.time.toFixed(2)} 秒
              </button>
            ))}
          </div>
        )}
        {values &&
          CONTROLS.map(({ key, label, min, max, factor, offset, step }) => (
            <Slider
              key={key}
              label={label}
              min={min}
              max={max}
              step={step}
              value={Number(((values[key] - offset) * factor).toFixed(2))}
              format={(v) =>
                key === 'exposure'
                  ? `${v > 0 ? '+' : ''}${v.toFixed(2)} EV`
                  : `${v > 0 ? '+' : ''}${Math.round(v)}`
              }
              onChange={(v) => edit({ [key]: v / factor + offset }, key)}
            />
          ))}
      </fieldset>
      {visual && <KeyframeControl detailsOnly />}
    </section>
  );
}
