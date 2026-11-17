import { useState } from 'react';
import type { TextItem } from '../../model/types';
import { KINETIC, KINETIC_GROUPS, kineticById, schemeOf } from '../../engine/kinetic';
import type { KineticGroup } from '../../engine/kinetic/core';
import { kineticWords } from '../../engine/kinetic/render';
import { TEXT_FXS } from '../../engine/textFx';
import { editItem } from '../../store/actions';
import { useUI } from '../../store/uiStore';
import { ColorPicker } from '../../ui/ColorPicker';
import { Slider } from '../../ui/Slider';
import { KineticCard } from './KineticCards';
export function TextEffectsPanel({ item }: { item: TextItem | null }) {
  const def = item?.kinetic && kineticById(item.kinetic.id);
  const [category, setCategory] = useState<KineticGroup | 'basic'>(
    def?.group ?? (item?.textFx ? 'basic' : 'in'),
  );
  if (!item)
    return <p className="hint">先在文字頁新增或選取文字，再選文字特效；版型群組中的文字也可使用。</p>;
  const k = item.kinetic;
  const change = (recipe: (text: TextItem) => void) => {
    useUI.getState().player?.pause();
    editItem(item.id, (it) => {
      if (it.type === 'text') recipe(it);
    });
  };
  const choose = (id: NonNullable<TextItem['kinetic']>['id']) => {
    const d = kineticById(id)!;
    change((it) => {
      it.kinetic = { id, playback: k?.playback ?? 'hold', subtitle: k?.subtitle };
      delete it.textFx;
      if (it.card.placeholder || !it.card.runs[0]?.text) {
        it.card.runs[0]!.text = d.words.join(' ');
        it.card.runs[0]!.color = schemeOf(d).fg;
        delete it.card.placeholder;
      }
    });
  };
  const playback = k?.playback ?? item.textFx?.playback ?? 'hold';
  return (
    <section aria-label="文字動態特效">
      <div className="chips option-secondary" role="tablist" aria-label="文字特效分類">
        {[{ id: 'basic', name: '基本' }, ...KINETIC_GROUPS].map((c) => (
          <button
            key={c.id}
            role="tab"
            aria-selected={category === c.id}
            className={`chip${category === c.id ? ' active' : ''}`}
            onClick={() => setCategory(c.id as KineticGroup | 'basic')}
          >
            {c.name}
          </button>
        ))}
      </div>
      <button
        className="chip"
        aria-pressed={!k && !item.textFx}
        onClick={() =>
          change((it) => {
            delete it.kinetic;
            delete it.textFx;
          })
        }
      >
        不使用文字特效
      </button>
      <div className="effect-grid text-effect-grid">
        {category === 'basic'
          ? TEXT_FXS.map((f) => (
              <button
                key={f.id}
                className={`effect-card${item.textFx?.kind === f.id ? ' active' : ''}`}
                aria-label={`文字特效 ${f.name}`}
                aria-pressed={item.textFx?.kind === f.id}
                onClick={() =>
                  change((it) => {
                    delete it.kinetic;
                    it.textFx = { kind: f.id, playback };
                  })
                }
              >
                <strong>{f.name}</strong>
              </button>
            ))
          : KINETIC.filter((f) => f.group === category).map((f) => (
              <KineticCard
                key={f.id}
                def={f}
                words={kineticWords(item, f.words)}
                fontId={item.card.runs[0]?.fontId ?? 'system'}
                active={k?.id === f.id}
                onPick={() => choose(f.id)}
              />
            ))}
      </div>
      {(k || item.textFx) && (
        <div className="text-effect-controls">
          <label className="field">
            文字特效播放方式
            <select
              aria-label="文字特效播放方式"
              value={playback}
              onChange={(e) =>
                change((it) => {
                  if (it.kinetic) it.kinetic.playback = e.target.value as 'loop' | 'hold';
                  if (it.textFx) it.textFx.playback = e.target.value as 'loop' | 'hold';
                })
              }
            >
              <option value="hold">完成後停留完整文字</option>
              <option value="loop">重複播放</option>
            </select>
          </label>
          <Slider
            label="文字特效一輪長度"
            min={0.5}
            max={20}
            step={0.1}
            value={
              k?.duration ??
              item.textFx?.duration ??
              (def ? (def.len(kineticWords(item, def.words)) ?? 4) : 2)
            }
            format={(v) => `${v.toFixed(1)}秒`}
            onChange={(v) =>
              change((it) => {
                if (it.kinetic) it.kinetic.duration = v;
                if (it.textFx) it.textFx.duration = v;
              })
            }
          />
          {k && (
            <>
              <Slider
                label="文字特效速度"
                min={25}
                max={200}
                step={5}
                value={(k.speed ?? 1) * 100}
                format={(v) => `${v / 100}倍`}
                onChange={(v) =>
                  change((it) => {
                    it.kinetic!.speed = v / 100;
                  })
                }
              />
              <ColorPicker
                label="文字特效強調色"
                value={k.accent ?? (def ? schemeOf(def).hi : '#ff4d2e')}
                onChange={(v) =>
                  change((it) => {
                    it.kinetic!.accent = v;
                  })
                }
              />
              <div className="chips">
                <button
                  className="chip"
                  aria-pressed={!k.bg}
                  onClick={() =>
                    change((it) => {
                      delete it.kinetic!.bg;
                    })
                  }
                >
                  透明底
                </button>
                <ColorPicker
                  label="文字特效底色"
                  value={k.bg ?? '#14161b'}
                  onChange={(v) =>
                    change((it) => {
                      it.kinetic!.bg = v;
                    })
                  }
                />
              </div>
              <p className="hint">
                主標與副標內容在「文字」頁調整。停留模式會在淡出前顯示完整文字，直到素材結束。
              </p>
            </>
          )}
        </div>
      )}
    </section>
  );
}
