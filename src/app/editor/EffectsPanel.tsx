import { AnimationSettings } from './AnimationSettings';
import { ProjectPreview } from './ProjectPreview';
import { EffectTimingEditor } from './EffectTimingEditor';
import { transitionRanges } from '../../engine/animationTiming';
import { totalDuration } from '../../engine/timeline';
import { findItem } from '../../engine/timeline';
import { useEffect, useState } from 'react';
import { useProjectStore } from '../../store/projectStore';
import { toast, useUI } from '../../store/uiStore';
import { newId } from '../../model/defaults';
import { EFFECTS } from '../../engine/sceneEffects';
import { VIDEO_EFFECTS } from '../../engine/videoEffects';
import { TRANSITIONS, transitionPairs } from '../../engine/transitions';
import { Slider } from '../../ui/Slider';
import { EffectPreviews } from './EffectPreviews';
import { uniqueEffects } from '../../engine/effectDuplicates';

export function EffectsPanel() {
  const [timingId, setTimingId] = useState<{ type: 'transition' | 'effect'; id: string } | null>(null);
  const p = useProjectStore((s) => s.project)!;
  const selectedId = useProjectStore((s) => s.selectedId);
  const [scope, setScope] = useState<'single' | 'pair'>('pair');
  const join = useUI((s) => s.effectsJoin);
  const player = useUI((s) => s.player);
  const [time, setTime] = useState(player?.time ?? 0);
  useEffect(() => player?.subscribe(setTime), [player]);
  const [mode, setMode] = useState<'transition' | 'effect'>('transition'),
    [category, setCategory] = useState('全部'),
    [pairId, setPairId] = useState('');
  useEffect(() => {
    if (!join) return;
    const frame = requestAnimationFrame(() => {
      setScope('pair');
      setMode('transition');
      setCategory('全部');
      setPairId(join.fromId);
    });
    return () => cancelAnimationFrame(frame);
  }, [join]);
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
  const atCursor = (effect: NonNullable<typeof p.effects>[number]) =>
    (effect.ranges ?? [[effect.start, effect.start + effect.duration]]).some(
      ([a, b]) => time >= a - 0.05 && time <= b,
    );
  const onPair = (effect: NonNullable<typeof p.effects>[number]) =>
    !!pair &&
    (effect.transitionFromId
      ? effect.transitionFromId === pair.from.id && effect.transitionToId === pair.to.id
      : Math.abs(effect.start - Math.max(0, pair.to.start - 0.3)) < 0.06);
  const selected = (e: (typeof cards)[number]) =>
    e.type === 'transition'
      ? !!pair &&
        (p.transitions ?? []).some(
          (tr) => tr.fromId === pair.from.id && tr.toId === pair.to.id && tr.preset === e.id,
        )
      : (p.effects ?? []).some(
          (fx) => fx.preset === e.id && (mode === 'transition' && pair ? onPair(fx) : atCursor(fx)),
        );
  const usedTransitions = (p.transitions ?? []).filter(
    (tr) => mode === 'transition' && pair && tr.fromId === pair.from.id && tr.toId === pair.to.id,
  );
  const usedEffects = (p.effects ?? []).filter((e) =>
    mode === 'effect'
      ? VIDEO_EFFECTS.some((x) => x.id === e.preset)
      : EFFECTS.some((x) => x.id === e.preset) && (pair ? onPair(e) : atCursor(e)),
  );
  const label = (id: string) => {
    for (const tr of p.tracks) {
      const it = tr.items.find((x) => x.id === id);
      if (it)
        return (
          it.name?.trim() ||
          (tr.template
            ? tr.name
            : it.type === 'text'
              ? '文字'
              : p.assets.find((a) => a.id === it.assetId)?.name || '素材')
        );
    }
    return '素材';
  };
  const targets = p.tracks
    .flatMap((tr) => (tr.template ? tr.items.slice(0, 1) : tr.items))
    .filter((it) => it.type !== 'audio');
  const target =
    targets.find(
      (it) =>
        it.id === selectedId ||
        p.tracks.some(
          (tr) => tr.template && tr.items.some((x) => x.id === selectedId) && tr.items[0]?.id === it.id,
        ),
    ) ?? targets[0];
  const found = findItem(p, target?.id ?? null);
  const animations = found?.track.template ? found.track.layout?.animations : target?.animations;
  return (
    <div className="panel" aria-label="轉場與畫面特效">
      <div className="chips option-primary effect-modes" role="tablist" aria-label="特效類型">
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
            className={'chip' + (mode === id ? ' active' : '')}
            onClick={() => {
              setMode(id);
              setCategory('全部');
            }}
          >
            {name}
          </button>
        ))}
      </div>
      {mode === 'transition' && (
        <div className="chips effect-scope" aria-label="動畫作用範圍">
          <button
            className={`chip${scope === 'single' ? ' active' : ''}`}
            aria-pressed={scope === 'single'}
            onClick={() => setScope('single')}
          >
            單一素材
          </button>
          <button
            className={`chip${scope === 'pair' ? ' active' : ''}`}
            aria-pressed={scope === 'pair'}
            onClick={() => setScope('pair')}
          >
            兩個素材銜接
          </button>
        </div>
      )}
      {mode === 'transition' && scope === 'single' ? (
        <>
          <label className="field">
            動畫素材
            <select
              aria-label="單一動畫素材"
              value={target?.id ?? ''}
              onChange={(e) => useProjectStore.getState().select(e.target.value)}
            >
              {!targets.length && <option value="">先加入素材</option>}
              {targets.map((it) => (
                <option key={it.id} value={it.id}>
                  {label(it.id)}
                </option>
              ))}
            </select>
          </label>
          {target && (
            <>
              <ProjectPreview start={target.start} duration={target.duration} label="單一素材結果" />
              <AnimationSettings
                key={target.id}
                value={animations}
                start={found?.track.layout?.start ?? target.start}
                duration={found?.track.layout?.duration ?? target.duration}
                thumbs={target.type !== 'text' ? p.assets.find((a) => a.id === target.assetId)?.thumbs : []}
                preview={(value) => {
                  const draft = structuredClone(p),
                    f = findItem(draft, target.id)!;
                  if (f.track.template && f.track.layout) {
                    f.track.layout.animations = value;
                    f.track.layout.motion = 'none';
                  } else f.item.animations = value;
                  return draft;
                }}
                onChange={(value) =>
                  useProjectStore.getState().apply((d) => {
                    const f = findItem(d, target.id);
                    if (!f) return;
                    if (f.track.template && f.track.layout) {
                      f.track.layout.animations = value;
                      f.track.layout.motion = 'none';
                    } else f.item.animations = value;
                  })
                }
              />
            </>
          )}
        </>
      ) : (
        <>
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
          <section className="used-effects" aria-label="已使用的特效">
            <h3>已使用的特效</h3>
            {!usedTransitions.length && !usedEffects.length && (
              <p className="hint">尚未選取；點下方動畫加入。</p>
            )}
            {usedTransitions.map((tr) => (
              <div className="effect-row" key={tr.id}>
                <button
                  className="effect-name"
                  aria-label="檢視 A B 交接"
                  onClick={() => {
                    player?.pause();
                    if (pair) player?.seek(pair.to.start);
                  }}
                >
                  {TRANSITIONS.find((e) => e.id === tr.preset)?.label}
                </button>
                <button className="chip" onClick={() => setTimingId({ type: 'transition', id: tr.id })}>
                  調整特效起迄
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
            ))}
            {usedEffects.map((e) => (
              <div className="effect-row" key={e.id}>
                <button
                  className="effect-name"
                  aria-label="檢視特效中點"
                  onClick={() => {
                    player?.pause();
                    player?.seek(e.start + e.duration / 2);
                  }}
                >
                  {[...EFFECTS, ...VIDEO_EFFECTS].find((x) => x.id === e.preset)?.label}
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
                <button className="chip" onClick={() => setTimingId({ type: 'effect', id: e.id })}>
                  調整特效起迄
                </button>
                {mode === 'effect' && (
                  <details className="effect-details">
                    <summary>調整影片特效</summary>
                    <Slider
                      label={'特效強度 ' + e.id}
                      min={0}
                      max={100}
                      step={1}
                      value={e.strength * 100}
                      format={(v) => v + '%'}
                      onChange={(v) =>
                        useProjectStore.getState().apply(
                          (d) => {
                            d.effects!.find((x) => x.id === e.id)!.strength = v / 100;
                          },
                          { coalesce: 'fx-strength:' + e.id },
                        )
                      }
                    />
                  </details>
                )}
              </div>
            ))}
          </section>
          <div className="chips option-secondary" aria-label="特效分類">
            {['全部', '基本', '相機動作', '特效', '故障', '自然'].map((name) => (
              <button
                key={name}
                className={'chip' + (category === name ? ' active' : '')}
                aria-pressed={category === name}
                onClick={() => setCategory(name)}
              >
                {name}
              </button>
            ))}
          </div>
          <p className="hint">
            A、B 動畫示範實際效果。同一交接的每種轉場只加入一次，不同效果可以混搭；已選選項會亮框。
          </p>
          <EffectPreviews presets={cards.map((e) => ({ id: e.id, type: e.type }))}>
            {cards.map((e) => {
              const active = selected(e);
              return (
                <button
                  className={'effect-card' + (active ? ' active' : '')}
                  aria-label={e.label}
                  aria-pressed={active}
                  key={e.type + ':' + e.id}
                  onClick={() => {
                    if (active) return toast('已使用此特效，可在上方移除');
                    if (e.type === 'transition' && !pair)
                      return toast('請先在同一影像列加入兩個前後相接的素材');
                    useProjectStore.getState().apply((d) => {
                      if (e.type === 'transition' && pair) {
                        if (
                          (d.transitions ?? []).some(
                            (tr) =>
                              tr.fromId === pair.from.id && tr.toId === pair.to.id && tr.preset === e.id,
                          )
                        )
                          return;
                        (d.transitions ??= []).push({
                          id: newId('tr_'),
                          preset: e.id as (typeof TRANSITIONS)[number]['id'],
                          fromId: pair.from.id,
                          toId: pair.to.id,
                          duration: Math.min(0.6, pair.from.duration, pair.to.duration),
                        });
                      } else {
                        const start =
                          mode === 'transition' && pair
                            ? Math.max(0, pair.to.start - 0.3)
                            : Math.max(0, time - (mode === 'transition' ? 0.3 : 0));
                        (d.effects ??= []).push({
                          id: newId('fx_'),
                          preset: e.id as NonNullable<typeof d.effects>[number]['preset'],
                          start,
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
                          ...(mode === 'transition' && pair
                            ? { transitionFromId: pair.from.id, transitionToId: pair.to.id }
                            : {}),
                        });
                        d.effects = uniqueEffects(d.effects);
                      }
                    });
                  }}
                >
                  <canvas
                    width={160}
                    height={96}
                    data-effect-demo={e.type + ':' + e.id}
                    aria-label={e.label + ' A B 效果動畫'}
                  />
                  <strong>
                    {e.label}
                    {active && (
                      <span className="effect-selected" aria-hidden="true">
                        {' '}
                        ✓ 已選
                      </span>
                    )}
                  </strong>
                </button>
              );
            })}
          </EffectPreviews>
          {!cards.length && <p className="hint">此分類尚無選項，請選擇其他分類。</p>}
        </>
      )}
      {timingId &&
        (() => {
          const tr =
            timingId.type === 'transition' ? p.transitions?.find((x) => x.id === timingId.id) : undefined;
          const fx = timingId.type === 'effect' ? p.effects?.find((x) => x.id === timingId.id) : undefined;
          const from = tr && findItem(p, tr.fromId)?.item,
            to = tr && findItem(p, tr.toId)?.item;
          if (!fx && !(tr && from && to)) return null;
          const start = from?.start ?? 0;
          const duration = to ? to.start + to.duration - start : totalDuration(p);
          const initial = (
            tr && from && to
              ? transitionRanges(tr, from, to)
              : (fx!.ranges ?? [[fx!.start, fx!.start + fx!.duration]])
          ).map(([a, b]) => [a - start, b - start] as [number, number]);
          const patch = (draft: typeof p, ranges: [number, number][]) => {
            const target = tr
              ? draft.transitions!.find((x) => x.id === tr.id)!
              : draft.effects!.find((x) => x.id === fx!.id)!;
            target.ranges = ranges.map(([a, b]) => [a + start, b + start]);
            if (tr && to && 'fromId' in target) target.anchor = to.start;
            target.duration = ranges[0] ? ranges[0][1] - ranges[0][0] : target.duration;
            if ('start' in target && ranges[0]) target.start = ranges[0][0] + start;
          };
          const thumbs =
            from && to
              ? [from, to].flatMap((it) =>
                  it.type !== 'text' ? (p.assets.find((a) => a.id === it.assetId)?.thumbs ?? []) : [],
                )
              : target && target.type !== 'text'
                ? p.assets.find((a) => a.id === target.assetId)?.thumbs
                : [];
          return (
            <EffectTimingEditor
              key={timingId.id}
              ranges={initial}
              duration={duration}
              start={start}
              joinAt={to ? to.start - start : undefined}
              thumbs={thumbs}
              onClose={() => setTimingId(null)}
              preview={(r) => {
                const draft = structuredClone(p);
                patch(draft, r);
                return draft;
              }}
              onApply={(r) => useProjectStore.getState().apply((d) => patch(d, r))}
            />
          );
        })()}
    </div>
  );
}
