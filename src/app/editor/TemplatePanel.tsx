import { TemplateCaptionThumbnail } from './TemplateCaptionThumbnail';
import { useState } from 'react';
import type { Track } from '../../model/types';
import { findItem } from '../../engine/timeline';
import {
  createFramework,
  reshapeFramework,
  upgradeFramework,
  templateCells,
  templateMembers,
} from '../../engine/templateModel';
import { arrangeTemplate } from '../../engine/templatePlayback';
import { useProjectStore } from '../../store/projectStore';
import { useUI } from '../../store/uiStore';
import { Slider } from '../../ui/Slider';
import { ColorPicker } from '../../ui/ColorPicker';
import { FrameworkEditor, FrameworkSources } from './FrameworkEditor';
import { LegacyTemplatePanel } from './LegacyTemplatePanel';

export function TemplatePanel() {
  const p = useProjectStore((s) => s.project)!;
  const selected = useProjectStore((s) => s.selectedId);
  const found = findItem(p, selected);
  const track = found?.track.template ? found.track : undefined;
  const [rows, setRows] = useState(2),
    [cols, setCols] = useState(1);
  const [editor, setEditor] = useState<'frame' | 'cells' | null>(null);
  const [cell, setCell] = useState<number | null>(null);
  const [legacy, setLegacy] = useState(!!track && track.layout?.version !== 2);
  const l = track?.layout;
  const patch = (recipe: (t: Track) => void, key?: string) => {
    useUI.getState().player?.pause();
    useProjectStore.getState().apply(
      (d) => {
        const t = d.tracks.find((t) => t.id === track?.id);
        if (!t) return;
        upgradeFramework(d as never, t as never);
        recipe(t as never);
      },
      key ? { coalesce: `framework:${track?.id}:${key}` } : undefined,
    );
  };
  const choose = (r: number, c: number) => {
    setRows(r);
    setCols(c);
    if (track) patch((t) => reshapeFramework(p, t, r, c));
  };
  const add = () => {
    const group = createFramework(p, rows, cols, useUI.getState().player?.time ?? 0);
    useProjectStore.getState().apply(
      (d) => {
        d.tracks.push(group);
      },
      { select: group.layout!.frameItem!.id },
    );
  };
  return (
    <div className="panel framework-panel" aria-label="版型框架設定">
      <div hidden={legacy}>
        <div className="panel-head">
          <strong>{track ? track.name : '新增版型框架'}</strong>
          {track && (
            <button
              className="chip"
              onClick={() => {
                useProjectStore.getState().select(null);
                useUI.setState({ templateDestination: null });
              }}
            >
              新增另一個版型
            </button>
          )}
        </div>
        <div className="chips option-secondary" aria-label="框架格數">
          {[1, 2, 3, 4].map((n) => (
            <button
              key={n}
              className={`chip${(l?.grid?.rows ?? rows) === n && (l?.grid?.cols ?? cols) === 1 ? ' active' : ''}`}
              aria-pressed={(l?.grid?.rows ?? rows) === n && (l?.grid?.cols ?? cols) === 1}
              onClick={() => choose(n, 1)}
            >
              1:{n}
            </button>
          ))}
        </div>
        <div className="framework-grid-fields">
          <label className="field">
            自訂列數
            <input
              aria-label="框架列數"
              type="number"
              min={1}
              max={4}
              value={l?.grid?.rows ?? rows}
              onChange={(e) =>
                choose(Math.max(1, Math.min(4, Number(e.target.value) || 1)), l?.grid?.cols ?? cols)
              }
            />
          </label>
          <label className="field">
            自訂欄數
            <input
              aria-label="框架欄數"
              type="number"
              min={1}
              max={4}
              value={l?.grid?.cols ?? cols}
              onChange={(e) =>
                choose(l?.grid?.rows ?? rows, Math.max(1, Math.min(4, Number(e.target.value) || 1)))
              }
            />
          </label>
        </div>
        {!track && (
          <button className="btn primary" onClick={add}>
            新增空白框架
          </button>
        )}
        {track && l && (
          <>
            <label className="field">
              群組名稱
              <input
                aria-label="版型群組名稱"
                value={track.name}
                onChange={(e) =>
                  patch((t) => {
                    t.name = e.target.value;
                  }, 'name')
                }
              />
            </label>
            <div
              className="framework-mini"
              style={{
                aspectRatio: `${l.size?.width ?? 1080}/${l.size?.height ?? 1920}`,
                background: l.frameColor ?? '#fff5df',
              }}
              aria-label="框架格子示意圖"
            >
              {templateCells(track).map((r, i) => (
                <button
                  key={i}
                  className="framework-cell"
                  aria-label={`第 ${i + 1} 格素材`}
                  style={{
                    left: `${r.x * 100}%`,
                    top: `${r.y * 100}%`,
                    width: `${r.w * 100}%`,
                    height: `${r.h * 100}%`,
                  }}
                  onClick={() => setCell(i + 1)}
                >
                  {(() => {
                    const it = track.items.find(
                      (it, j) =>
                        (it.templateCell ?? j + 1) === i + 1 && it.type !== 'text' && it.type !== 'audio',
                    );
                    const a = it && 'assetId' in it ? p.assets.find((a) => a.id === it.assetId) : null;
                    return a?.thumbs[0] ? <img src={a.thumbs[0]} alt="" /> : null;
                  })()}
                  <span>{i + 1}</span>
                  <small>
                    {
                      track.items.filter((it) => (it.templateCell ?? track.items.indexOf(it) + 1) === i + 1)
                        .length
                    }{' '}
                    個素材
                  </small>
                </button>
              ))}
              {templateMembers(track).map((it) =>
                it.type === 'text' && !it.card.placeholder ? (
                  <TemplateCaptionThumbnail
                    key={it.id}
                    text={it}
                    width={l.size?.width ?? 1080}
                    height={l.size?.height ?? 1920}
                  />
                ) : null,
              )}
            </div>
            <div className="chips">
              <button className="chip" onClick={() => setEditor('frame')}>
                調整外框大小
              </button>
              <button className="chip" onClick={() => setEditor('cells')}>
                調整格子分界
              </button>
            </div>
            <Slider
              label="外框粗細"
              min={0}
              max={150}
              step={1}
              value={l.border ?? 32}
              format={(v) => `${v} px`}
              onChange={(v) =>
                patch((t) => {
                  t.layout!.border = v;
                }, 'border')
              }
            />
            <Slider
              label="分隔線粗細"
              min={0}
              max={150}
              step={1}
              value={l.gap ?? 20}
              format={(v) => `${v} px`}
              onChange={(v) =>
                patch((t) => {
                  t.layout!.gap = v;
                }, 'gap')
              }
            />
            <ColorPicker
              label="版型顏色"
              value={l.frameColor ?? '#fff5df'}
              onChange={(v) =>
                patch((t) => {
                  t.layout!.frameColor = v;
                }, 'color')
              }
            />
            <Slider
              label="版型框架透明度"
              min={0}
              max={100}
              step={1}
              value={(l.frameOpacity ?? 1) * 100}
              format={(v) => `${v}%`}
              onChange={(v) =>
                patch((t) => {
                  t.layout!.frameOpacity = v / 100;
                }, 'opacity')
              }
            />
            <div className="framework-grid-fields">
              <label className="field">
                播放方式
                <select
                  aria-label="版型播放方式"
                  value={l.playback ?? 'simultaneous'}
                  onChange={(e) =>
                    patch((t) => arrangeTemplate(t, e.target.value as 'simultaneous' | 'sequential'))
                  }
                >
                  <option value="simultaneous">同步播放</option>
                  <option value="sequential">依序播放</option>
                </select>
              </label>
              <label className="field">
                空檔處理
                <select
                  aria-label="版型空檔處理"
                  value={l.gapMode ?? 'hold'}
                  onChange={(e) =>
                    patch((t) => {
                      t.layout!.gapMode = e.target.value as 'hold' | 'fill' | 'transparent';
                    })
                  }
                >
                  <option value="hold">停留前後畫面（靜音）</option>
                  <option value="fill">填入顏色</option>
                  <option value="transparent">透明</option>
                </select>
              </label>
            </div>
            {l.gapMode === 'fill' && (
              <ColorPicker
                label="空檔顏色"
                value={l.gapColor ?? '#000000'}
                onChange={(v) =>
                  patch((t) => {
                    t.layout!.gapColor = v;
                  }, 'gap-color')
                }
              />
            )}
            <p className="hint">
              點格子加入素材或選取片段。同一格可加入多列影像；展開時間軸選素材後，可縮放、調色、設定文字或特效。圖層頁籤可調整不同分類的前後順序。
            </p>
            {editor && (
              <FrameworkEditor
                key={`${track.id}:${editor}`}
                track={track}
                mode={editor}
                onClose={() => setEditor(null)}
              />
            )}
            {cell !== null && (
              <FrameworkSources
                key={`${track.id}:${cell}`}
                track={track}
                cell={cell}
                onClose={() => setCell(null)}
              />
            )}
          </>
        )}
      </div>
      <details
        className="legacy-template-tools"
        open={legacy}
        onToggle={(e) => setLegacy(e.currentTarget.open)}
      >
        <summary>舊版套版工具（相容舊專案）</summary>
        <LegacyTemplatePanel key={track?.id ?? 'new'} />
      </details>
    </div>
  );
}
