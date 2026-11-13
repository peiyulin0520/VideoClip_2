import { useState } from 'react';
import { useProjectStore } from '../../store/projectStore';
import { toast, useUI } from '../../store/uiStore';
import { newId } from '../../model/defaults';
import { EFFECTS } from '../../engine/sceneEffects';
import { VIDEO_EFFECTS } from '../../engine/videoEffects';
import { TRANSITIONS, transitionPairs } from '../../engine/transitions';
import { Slider } from '../../ui/Slider';
import { EffectPreviews } from './EffectPreviews';

export function EffectsPanel() {
  const p = useProjectStore((s) => s.project)!;
  const [mode, setMode] = useState<'transition' | 'effect'>('transition'),
    [category, setCategory] = useState('全部'),
    [pairId, setPairId] = useState('');
  const pairs = transitionPairs(p),
    pair = pairs.find((x) => x.from.id === pairId) ?? pairs[0];
  const filtered = (mode === 'transition' ? TRANSITIONS : VIDEO_EFFECTS).filter(
    (e) => category === '全部' || e.category === category,
  );
  const cards = [
    ...(mode === 'transition' && ['全部', '基本'].includes(category)
      ? EFFECTS.map((e) => ({ ...e, type: 'effect' as const }))
      : []),
    ...filtered.map((e) => ({ ...e, type: mode })),
  ];
  const label = (id: string) => {
    for (const tr of p.tracks) {
      const it = tr.items.find((x) => x.id === id);
      if (it)
        return (
          it.name ??
          (it.type === 'text' ? '文字' : (p.assets.find((a) => a.id === it.assetId)?.name ?? '素材'))
        );
    }
    return '素材';
  };
  return (
    <div className="panel" aria-label="轉場與畫面特效">
      <div className="chips" role="tablist" aria-label="特效類型">
        {(
          [
            ['transition', '轉場'],
            ['effect', '影片特效'],
          ] as const
        ).map(([id, name]) => (
          <button
            key={id}
            role="tab"
            aria-selected={mode === id}
            className={`chip${mode === id ? ' active' : ''}`}
            onClick={() => {
              setMode(id);
              setCategory('全部');
            }}
          >
            {name}
          </button>
        ))}
      </div>
      <div className="chips" aria-label="特效分類">
        {['全部', '基本', '相機動作', '特效', '故障', '自然'].map((name) => (
          <button
            key={name}
            className={`chip${category === name ? ' active' : ''}`}
            aria-pressed={category === name}
            onClick={() => setCategory(name)}
          >
            {name}
          </button>
        ))}
      </div>
      {mode === 'transition' && (
        <label className="field">
          A → B 轉場片段
          <select
            aria-label="轉場片段 A 到 B"
            value={pair?.from.id ?? ''}
            onChange={(e) => setPairId(e.target.value)}
          >
            {!pairs.length && <option value="">先在同一影像列加入前後相接的素材</option>}
            {pairs.map((x) => (
              <option key={x.from.id} value={x.from.id}>
                {label(x.from.id)} → {label(x.to.id)}
              </option>
            ))}
          </select>
        </label>
      )}
      <p className="hint">
        選項中的 A、B
        動畫會示範實際合成效果。轉場放在所選的兩段交接處；影片特效放在目前白線位置，可調時間、長度與強度。
      </p>
      <EffectPreviews presets={cards.map((e) => ({ id: e.id, type: e.type }))}>
        {cards.map((e) => (
          <button
            className="effect-card"
            aria-label={e.label}
            key={`${e.type}:${e.id}`}
            onClick={() => {
              if (e.type === 'transition' && !pair) return toast('請先在同一影像列加入兩個前後相接的素材');
              useProjectStore.getState().apply((d) => {
                if (e.type === 'transition' && pair)
                  (d.transitions ??= []).push({
                    id: newId('tr_'),
                    preset: e.id as (typeof TRANSITIONS)[number]['id'],
                    fromId: pair.from.id,
                    toId: pair.to.id,
                    duration: Math.min(0.6, pair.from.duration, pair.to.duration),
                  });
                else {
                  const time = useUI.getState().player?.time ?? 0;
                  (d.effects ??= []).push({
                    id: newId('fx_'),
                    preset: e.id as NonNullable<typeof d.effects>[number]['preset'],
                    start: Math.max(0, time - (mode === 'transition' ? 0.3 : 0)),
                    duration:
                      mode === 'transition'
                        ? 0.6
                        : Math.min(
                            3,
                            Math.max(
                              0.2,
                              ...d.tracks.flatMap((tr) =>
                                tr.items.map((it) => it.start + it.duration - time),
                              ),
                            ),
                          ),
                    strength: 1,
                  });
                }
              });
            }}
          >
            <canvas
              width={160}
              height={96}
              data-effect-demo={`${e.type}:${e.id}`}
              aria-label={`${e.label} A B 效果動畫`}
            />
            <strong>{e.label}</strong>
            {'description' in e && <small>{String(e.description)}</small>}
          </button>
        ))}
      </EffectPreviews>
      {!cards.length && <p className="hint">此分類尚無選項，請選擇其他分類。</p>}
      {(p.transitions ?? []).map((tr) => (
        <div className="effect-row" key={tr.id}>
          <h4>
            {TRANSITIONS.find((e) => e.id === tr.preset)?.label} · A {label(tr.fromId)} → B {label(tr.toId)}
          </h4>
          <Slider
            label={`轉場長度 ${tr.id}`}
            min={0.1}
            max={3}
            step={0.05}
            value={tr.duration}
            format={(v) => `${v.toFixed(2)} 秒`}
            onChange={(v) =>
              useProjectStore.getState().apply(
                (d) => {
                  d.transitions!.find((x) => x.id === tr.id)!.duration = v;
                },
                { coalesce: `transition:${tr.id}` },
              )
            }
          />
          <div className="chips">
            <button
              className="chip"
              onClick={() => {
                const to = p.tracks.flatMap((t) => t.items).find((i) => i.id === tr.toId);
                if (to) {
                  useUI.getState().player?.pause();
                  useUI.getState().player?.seek(to.start);
                }
              }}
            >
              檢視 A B 交接
            </button>
            <button
              className="chip"
              onClick={() =>
                useProjectStore.getState().apply((d) => {
                  d.transitions = d.transitions?.filter((x) => x.id !== tr.id);
                })
              }
            >
              移除轉場
            </button>
          </div>
        </div>
      ))}
      {(p.effects ?? []).map((e) => (
        <div className="effect-row" key={e.id}>
          <h4>{[...EFFECTS, ...VIDEO_EFFECTS].find((x) => x.id === e.preset)?.label}</h4>
          <label className="field">
            出現時間（秒）
            <input
              type="number"
              min={0}
              step={0.01}
              aria-label={`特效出現時間 ${e.id}`}
              value={e.start}
              onChange={(event) => {
                const start = Math.max(0, Number(event.target.value));
                useProjectStore.getState().apply((d) => {
                  d.effects!.find((x) => x.id === e.id)!.start = start;
                });
              }}
            />
          </label>
          <Slider
            label={`特效長度 ${e.id}`}
            min={0.1}
            max={10}
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
    </div>
  );
}
