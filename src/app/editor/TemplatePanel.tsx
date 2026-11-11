import { useRef, useState } from 'react';
import { collagePlan, LAYOUTS, type LayoutStyle, type LayoutMotion } from '../../engine/layouts';
import { importFiles } from '../../engine/importMedia';
import { ensureUrls } from '../../engine/assetUrls';
import { useProjectStore } from '../../store/projectStore';
import { toast, useUI } from '../../store/uiStore';

export function TemplatePanel() {
  const project = useProjectStore((s) => s.project)!;
  const [style, setStyle] = useState<LayoutStyle>('photobooth'),
    [motion, setMotion] = useState<LayoutMotion>('slide'),
    [seconds, setSeconds] = useState(3),
    [selected, setSelected] = useState<string[]>([]);
  const input = useRef<HTMLInputElement>(null),
    count = LAYOUTS.find((x) => x.id === style)!.count;
  const ids = Array.from(
    { length: count },
    (_, i) => selected[i] ?? project.assets[i % Math.max(project.assets.length, 1)]?.id ?? '',
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
      setSelected(result.assets.map((a) => a.id));
      if (result.failed.length) toast('部分素材無法讀取，請確認格式');
    } catch {
      toast('匯入失敗，請重試');
    } finally {
      useUI.getState().setBusy(null);
      if (input.current) input.current.value = '';
    }
  };
  const apply = () => {
    try {
      const plan = collagePlan(project, ids, style, motion, useUI.getState().player?.time ?? 0, seconds);
      useProjectStore.getState().apply(
        (d) => {
          const main = d.tracks.filter((t) => t.kind === 'main'),
            others = d.tracks.filter((t) => t.kind !== 'main' && !t.template);
          d.tracks = [...main, ...plan.tracks, ...others];
          d.layout = plan.layout;
        },
        { select: plan.tracks[0]!.items[0]!.id },
      );
      toast(`已套用 ${plan.layout.duration.toFixed(1)} 秒版型，可選每格再用兩指調整`);
    } catch (e) {
      toast((e as Error).message);
    }
  };
  return (
    <div className="panel scroll" aria-label="多格影片版型">
      <div className="template-grid">
        {LAYOUTS.map((l) => (
          <button key={l.id} aria-pressed={style === l.id} onClick={() => setStyle(l.id)}>
            <span className={`template-art ${l.id}`}>
              {Array.from({ length: l.count }, (_, i) => (
                <i key={i} />
              ))}
            </span>
            {l.label}
          </button>
        ))}
      </div>
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
        <label className="number-control" key={i}>
          第 {i + 1} 格
          <select
            aria-label={`第 ${i + 1} 格素材`}
            value={id}
            onChange={(e) => {
              const next = [...ids];
              next[i] = e.target.value;
              setSelected(next);
            }}
          >
            <option value="">選擇素材</option>
            {project.assets.map((a) => (
              <option key={a.id} value={a.id}>
                {a.name}
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
          onChange={(e) => setSeconds(Number(e.target.value))}
        />
      </label>
      <p className="hint">
        放在目前播放頭位置，每格可選不同素材。長度以最短影片為上限；套用會替換前一組版型，文字保留，可復原。預設播放第一格的聲音，其餘格靜音。
      </p>
      {project.layout && (
        <button
          className="btn"
          onClick={() =>
            useProjectStore.getState().apply(
              (d) => {
                d.tracks = d.tracks.filter((t) => !t.template);
                delete d.layout;
              },
              { select: null },
            )
          }
        >
          移除版型
        </button>
      )}
      <button className="btn primary done" onClick={apply}>
        套用多格版型
      </button>
    </div>
  );
}
