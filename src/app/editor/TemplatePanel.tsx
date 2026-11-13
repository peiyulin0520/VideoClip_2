import { TemplateCells } from './TemplateCells';
import { ensureFont } from '../../fonts/fontStore';
import { useRef, useState } from 'react';
import {
  collagePlan,
  carryTemplateEdits,
  LAYOUTS,
  layoutSlots,
  slotLabel,
  type LayoutStyle,
  type LayoutMotion,
} from '../../engine/layouts';
import { importFiles } from '../../engine/importMedia';
import { ensureUrls } from '../../engine/assetUrls';
import { useProjectStore } from '../../store/projectStore';
import type { VideoItem } from '../../model/types';
import { toast, useUI } from '../../store/uiStore';

export function TemplatePanel() {
  const project = useProjectStore((s) => s.project)!;
  const selectedId = useProjectStore((s) => s.selectedId);
  const activeGroup =
    project.tracks.find((t) => t.template && t.items.some((it) => it.id === selectedId)) ??
    project.tracks.find((t) => t.template);
  const [style, setStyle] = useState<LayoutStyle>(
      activeGroup?.layout?.style ?? project.layout?.style ?? 'photobooth',
    ),
    [motion, setMotion] = useState<LayoutMotion>(
      activeGroup?.layout?.motion ?? project.layout?.motion ?? 'none',
    ),
    [lengthDraft, setLengthDraft] = useState<{ key: string; baseline: number; value: number } | null>(null),
    [selected, setSelected] = useState<string[]>(
      project.tracks
        .filter((t) => t.id === activeGroup?.id)
        .flatMap((t) => t.items.flatMap((it) => (it.type !== 'text' ? [it.assetId] : []))),
    ),
    [focusSlot, setFocusSlot] = useState(0),
    [sourceIds, setSourceIds] = useState<string[] | null>(null);
  const [storyCount, setStoryCount] = useState(Math.min(3, activeGroup?.layout?.count ?? 3));
  const referenceLength = activeGroup?.layout?.duration ?? 3;
  const seconds =
    lengthDraft?.key === (activeGroup?.id ?? 'new') && lengthDraft.baseline === referenceLength
      ? lengthDraft.value
      : referenceLength;
  const media = project.assets.filter((a) => a.kind !== 'audio');
  const existing = project.tracks
    .filter((t) => !t.template)
    .flatMap((t) => t.items.filter((it): it is VideoItem => it.type !== 'text' && it.type !== 'audio'));
  const sources = sourceIds
    ?.map((id) => existing.find((it) => it.id === id))
    .filter((it): it is VideoItem => !!it);
  const assetLabel = (id: string) => {
    const a = media.find((a) => a.id === id);
    return a
      ? `${a.attribution?.title || a.name} · ${a.kind === 'video' ? `${a.duration.toFixed(1)} 秒` : '照片／貼圖'}`
      : '選擇素材';
  };
  const input = useRef<HTMLInputElement>(null),
    count = style === 'story' ? storyCount : LAYOUTS.find((x) => x.id === style)!.count;
  const ids = Array.from(
    { length: count },
    (_, i) => sources?.[i]?.assetId ?? selected[i] ?? media[i % Math.max(media.length, 1)]?.id ?? '',
  );
  const onFiles = async (files: FileList | null) => {
    if (!files?.length) return;
    useUI.getState().setBusy('正在匯入版型素材…');
    try {
      const result = await importFiles(project.id, Array.from(files));
      await ensureUrls(project.id, result.assets);
      if (useProjectStore.getState().project?.id !== project.id) return;
      useProjectStore.getState().apply((d) => {
        d.assets.push(...result.assets);
      });
      setSourceIds(null);
      setSelected(result.assets.map((a) => a.id));
      if (result.failed.length) toast('部分素材無法讀取，請確認格式');
    } catch {
      toast('匯入失敗，請重試');
    } finally {
      useUI.getState().setBusy(null);
      if (input.current) input.current.value = '';
    }
  };
  const apply = async () => {
    try {
      if (sources && sources.length !== count) throw Error(`請選擇 ${count} 個現有片段`);
      const plan = collagePlan(
        project,
        ids,
        style,
        motion,
        activeGroup && !sourceIds ? activeGroup.items[0]!.start : (useUI.getState().player?.time ?? 0),
        seconds,
        sources,
      );
      if (activeGroup && !sourceIds) carryTemplateEdits(plan.tracks[0]!, activeGroup);
      if (plan.layout.story) {
        useUI.getState().setBusy('正在準備故事模板字體…');
        for (const id of plan.tracks[0]!.layout?.story?.fontIds ?? [])
          if (id !== 'system' && !(await ensureFont(id))) throw Error('故事字體載入失敗，請確認網路後再套用');
      }
      useProjectStore.getState().apply(
        (d) => {
          const others = d.tracks
            .filter((t) => t.id !== activeGroup?.id)
            .map((t) => ({ ...t, items: t.items.filter((it) => !sourceIds?.includes(it.id)) }))
            .filter((t) => t.items.length || t.kind === 'main');
          const firstText = others.findIndex((t) => t.kind === 'text');
          others.splice(firstText < 0 ? others.length : firstText, 0, ...plan.tracks);
          d.tracks = others;
          d.layout = plan.layout;
        },
        { select: plan.tracks[0]!.items[0]!.id },
      );
      toast(`已套用 ${plan.layout.duration.toFixed(1)} 秒版型，預覽可移動縮放整組，每格另選來源片段`);
    } catch (e) {
      toast((e as Error).message);
    } finally {
      useUI.getState().setBusy(null);
    }
  };
  return (
    <div className="panel scroll" aria-label="多格影片版型">
      <div className="template-grid">
        {LAYOUTS.map((l) => (
          <button
            key={l.id}
            aria-label={l.label}
            className={style === l.id ? 'selected-template' : ''}
            aria-pressed={style === l.id}
            onClick={() => {
              setStyle(l.id);
              setFocusSlot(0);
            }}
          >
            <span className={`template-art ${l.id}`}>
              {Array.from({ length: l.count }, (_, i) => (
                <i key={i}>{i + 1}</i>
              ))}
            </span>
            {l.label}
          </button>
        ))}
      </div>
      {style === 'story' && (
        <div className="chips">
          {[2, 3].map((n) => (
            <button
              key={n}
              className={`chip${storyCount === n ? ' active' : ''}`}
              aria-pressed={storyCount === n}
              onClick={() => setStoryCount(n)}
            >
              {n} 格故事
            </button>
          ))}
        </div>
      )}
      <p className="template-choice" role="status">
        目前選擇：{LAYOUTS.find((l) => l.id === style)!.label}{' '}
        {project.layout?.style === style ? '（已套用）' : '（待套用）'}
      </p>
      <div className="slot-map" aria-label="版型格子位置對照">
        {layoutSlots(style, count).map((slot, i) => {
          const a = media.find((a) => a.id === ids[i]);
          return (
            <button
              key={i}
              className={focusSlot === i ? 'active' : ''}
              aria-label={`選擇第 ${i + 1} 格 ${slotLabel(style, i, count)}`}
              onClick={() => setFocusSlot(i)}
              style={{
                left: `${slot.x * 100}%`,
                top: `${slot.y * 100}%`,
                width: `${slot.w * 100}%`,
                height: `${slot.h * 100}%`,
              }}
            >
              {a?.thumbs[0] && <img src={a.thumbs[0]} alt="" />}
              <strong>
                {i + 1} · {slotLabel(style, i, count)}
              </strong>
            </button>
          );
        })}
      </div>
      <div className="chips">
        <button className={`chip${sourceIds === null ? ' active' : ''}`} onClick={() => setSourceIds(null)}>
          選素材套版
        </button>
        <button
          className={`chip${sourceIds !== null ? ' active' : ''}`}
          onClick={() => setSourceIds(existing.slice(0, count).map((it) => it.id))}
        >
          群組現有圖層
        </button>
      </div>
      {sourceIds !== null && (
        <div className="existing-clips">
          <p className="hint">
            勾選 {count} 個片段，依勾選順序對應格子。套用後合併為一個可拖移、修剪、隱藏或刪除的版型圖層。
          </p>
          {existing.map((it) => (
            <label className="check-row" key={it.id}>
              <input
                type="checkbox"
                aria-label={`群組片段 ${it.id}`}
                checked={sourceIds.includes(it.id)}
                onChange={(e) =>
                  setSourceIds(
                    e.target.checked ? [...sourceIds, it.id] : sourceIds.filter((id) => id !== it.id),
                  )
                }
              />
              {assetLabel(it.assetId)}
            </label>
          ))}
          {!existing.length && <p className="hint">先在影像加入影片或照片，再選擇要群組的片段。</p>}
        </div>
      )}
      <button className="btn" onClick={() => input.current?.click()}>
        ＋ 匯入版型用影片／照片
      </button>
      <input
        ref={input}
        type="file"
        accept="video/*,image/*"
        multiple
        hidden
        data-testid="template-files"
        onChange={(e) => void onFiles(e.target.files)}
      />
      {ids.map((id, i) => (
        <label className={`slot-choice${focusSlot === i ? ' focused' : ''}`} key={i}>
          <span>
            第 {i + 1} 格 · {slotLabel(style, i, count)}
          </span>
          {media.find((a) => a.id === id)?.thumbs[0] && (
            <img src={media.find((a) => a.id === id)!.thumbs[0]} alt={`第 ${i + 1} 格素材縮圖`} />
          )}
          <select
            aria-label={`第 ${i + 1} 格素材`}
            value={id}
            onChange={(e) => {
              setFocusSlot(i);
              setSourceIds(null);
              const next = [...ids];
              next[i] = e.target.value;
              setSelected(next);
            }}
          >
            <option value="">選擇素材</option>
            {project.assets
              .filter((a) => a.kind !== 'audio')
              .map((a) => (
                <option key={a.id} value={a.id}>
                  {assetLabel(a.id)}
                </option>
              ))}
          </select>
        </label>
      ))}
      <label className="number-control">
        動態效果
        <select
          aria-label="版型動態效果"
          value={motion}
          onChange={(e) => setMotion(e.target.value as LayoutMotion)}
        >
          <option value="none">固定顯示</option>
          <option value="slide">由右滑入、向左滑出</option>
          <option value="drift">膠卷向上滑過</option>
        </select>
      </label>
      <label className="number-control">
        長度（秒）
        <input
          type="number"
          aria-label="版型長度"
          min={0.2}
          max={60}
          step={0.1}
          value={seconds}
          onChange={(e) =>
            setLengthDraft({
              key: activeGroup?.id ?? 'new',
              baseline: referenceLength,
              value: Number(e.target.value),
            })
          }
        />
      </label>
      <p className="hint">
        放在目前播放頭位置，每格可選不同素材。每格共用設定長度，來源不足補黑或補白；套用會替換前一組版型，文字保留，可復原。整組在時間軸是一個圖層，刪除或隱藏時框架一起處理。預設播放第一格的聲音。
      </p>
      {project.layout && (
        <button
          className="btn"
          onClick={() =>
            useProjectStore.getState().apply(
              (d) => {
                d.tracks = d.tracks.filter((t) => t.id !== activeGroup?.id);
                if (!d.tracks.some((t) => t.template)) delete d.layout;
              },
              { select: null },
            )
          }
        >
          移除版型
        </button>
      )}
      {activeGroup && <TemplateCells track={activeGroup} />}
      <button className="btn primary done" onClick={() => void apply()}>
        套用多格版型
      </button>
    </div>
  );
}
