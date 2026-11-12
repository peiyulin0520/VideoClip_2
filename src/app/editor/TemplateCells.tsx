import { MIN_CLIP_DURATION } from '../../model/defaults';
import { useRef, useState } from 'react';
import type { Track, VideoItem } from '../../model/types';
import { useProjectStore } from '../../store/projectStore';
import { editItem, setTransform } from '../../store/actions';
import { SourceRanges } from '../../ui/SourceRanges';
import { Slider } from '../../ui/Slider';
import { mediaSegments } from '../../engine/templateTiming';
import { includeAudio } from '../../engine/audioRanges';
import { groupTransform } from '../../engine/templateGeometry';
import { urlFor } from '../../engine/assetUrls';
import { useUI } from '../../store/uiStore';
import { FontSelect } from '../fonts/FontSelect';
import { TrimEditor } from './TrimEditor';

export function TemplateCells({ track }: { track: Track }) {
  const selected = useProjectStore((s) => s.selectedId);
  const [editing, setEditing] = useState<VideoItem | null>(null);
  const tf = groupTransform(track),
    duration = track.items[0]?.duration ?? 3,
    story = track.layout?.story;
  const patchStory = (patch: Partial<NonNullable<typeof story>>) =>
    useProjectStore.getState().apply((d) => {
      const group = d.tracks.find((x) => x.id === track.id)!;
      if (group.layout?.story) Object.assign(group.layout.story, patch);
    });
  return (
    <section className="template-cells" aria-label="模板整組與每格片段">
      {editing && <TrimEditor item={editing} onClose={() => setEditing(null)} />}
      <h3>整組模板</h3>
      <p className="hint">
        在預覽點選任一格後，拖移與雙指縮放都作用於整組框架和影片；每格來源在下方選段，不會個別拉歪。
      </p>
      <Slider
        label="模板整組大小"
        value={Math.round(tf.scale * 100)}
        min={5}
        max={400}
        step={1}
        format={(v) => `${v}%`}
        onChange={(v) => setTransform(track.items[0]!.id, { scale: v / 100 })}
      />
      <button className="chip" onClick={() => setTransform(track.items[0]!.id, { x: 0.5, y: 0.5, scale: 1 })}>
        重設整組位置與大小
      </button>
      <Slider
        label="每格共同長度"
        value={duration}
        min={0.2}
        max={60}
        step={0.1}
        format={(v) => `${v.toFixed(1)} 秒`}
        onChange={(v) =>
          useProjectStore.getState().apply(
            (d) => {
              const group = d.tracks.find((x) => x.id === track.id)!;
              for (const it of group.items) it.duration = v;
              if (group.layout) group.layout.duration = v;
            },
            { coalesce: `group-length:${track.id}` },
          )
        }
      />
      {story && (
        <div className="story-settings">
          <label className="field">
            中央文字
            <input
              aria-label="故事中央文字"
              value={story.title}
              maxLength={60}
              onChange={(e) => patchStory({ title: e.target.value })}
            />
          </label>
          {story.fontIds.map((font, i) => (
            <label className="field" key={i}>
              切換字體 {i + 1}
              <FontSelect
                value={font}
                onChange={(font) =>
                  patchStory({ fontIds: story.fontIds.map((old, j) => (j === i ? font : old)) })
                }
              />
            </label>
          ))}
          <Slider
            label="字體切換間隔"
            min={0.04}
            max={1}
            step={0.01}
            value={story.fontInterval}
            format={(v) => `${v.toFixed(2)} 秒`}
            onChange={(v) => patchStory({ fontInterval: v })}
          />
          <Slider
            label="上下展開時間"
            min={0.2}
            max={2}
            step={0.05}
            value={story.opening}
            format={(v) => `${v.toFixed(2)} 秒`}
            onChange={(v) => patchStory({ opening: v })}
          />
          <Slider
            label="影片依序進入間隔"
            min={0.15}
            max={1}
            step={0.05}
            value={story.step}
            format={(v) => `${v.toFixed(2)} 秒`}
            onChange={(v) => patchStory({ step: v })}
          />
          <label className="check-row">
            <input
              type="checkbox"
              checked={story.flash}
              onChange={(e) => patchStory({ flash: e.target.checked })}
            />
            結尾暖色閃光
          </label>
        </div>
      )}
      <h3>每格來源與補時</h3>
      {track.items.map((it, i) =>
        it.type === 'text' ? null : (
          <Cell
            key={it.id}
            item={it}
            index={i}
            open={it.id === selected}
            onSelect={() => useProjectStore.getState().select(it.id)}
            onEdit={() => setEditing(it)}
          />
        ),
      )}
    </section>
  );
}
function Cell({
  item,
  index,
  open,
  onSelect,
  onEdit,
}: {
  item: VideoItem;
  index: number;
  open: boolean;
  onSelect: () => void;
  onEdit: () => void;
}) {
  const p = useProjectStore((s) => s.project)!,
    asset = p.assets.find((a) => a.id === item.assetId)!,
    video = useRef<HTMLVideoElement>(null);
  const cell = item.cell ?? {
    sourceEnd: asset.duration || 600,
    offset: 0,
    blanks: [],
    background: '#000000',
  };
  const update = (patch: Partial<typeof cell>) =>
    editItem(
      item.id,
      (it) => {
        if (it.type !== 'text') it.cell = { ...cell, ...patch };
      },
      { coalesce: `cell:${item.id}` },
    );
  const selectedEnd = Math.min(asset.duration, cell.sourceEnd);
  return (
    <details className="template-cell" open={open}>
      <summary
        onClick={(e) => {
          e.preventDefault();
          if (!open) onSelect();
          else useProjectStore.getState().select(null);
        }}
      >
        {asset.thumbs[0] && <img src={asset.thumbs[0]} alt="" />}
        <span>
          第 {index + 1} 格 · {asset.name}
          <small>
            共 {item.duration.toFixed(2)} 秒 · 來源 {item.trimIn.toFixed(2)}–{selectedEnd.toFixed(2)} 秒
          </small>
        </span>
      </summary>
      {asset.kind === 'video' && (
        <>
          <video
            ref={video}
            src={urlFor(p.id, asset.id)}
            muted
            playsInline
            preload="metadata"
            className="cell-preview"
            onLoadedMetadata={(e) => {
              e.currentTarget.currentTime = Math.max(0.001, item.trimIn);
            }}
          />
          <SourceRanges
            duration={asset.duration}
            minimum={Math.min(asset.duration, MIN_CLIP_DURATION * item.speed)}
            ranges={[[item.trimIn, selectedEnd]]}
            thumbs={asset.thumbs}
            onChange={(ranges) =>
              editItem(
                item.id,
                (it) => {
                  if (it.type !== 'text') {
                    it.trimIn = ranges[0]![0];
                    it.cell = { ...cell, sourceEnd: ranges[0]![1] };
                  }
                },
                { coalesce: `cell-source:${item.id}` },
              )
            }
            onSeek={(t) => {
              if (video.current) video.current.currentTime = Math.min(t, asset.duration - 0.001);
            }}
          />
          <button className="chip" onClick={onEdit}>
            放大選取第 {index + 1} 格片段
          </button>
        </>
      )}
      <Slider
        label={`第 ${index + 1} 格影片延後出現`}
        value={cell.offset}
        min={0}
        max={item.duration}
        step={0.05}
        format={(v) => `${v.toFixed(2)} 秒`}
        onChange={(v) => update({ offset: v })}
      />
      <div className="chips">
        {(['#000000', '#ffffff'] as const).map((c) => (
          <button
            className={`chip${cell.background === c ? ' active' : ''}`}
            key={c}
            aria-pressed={cell.background === c}
            onClick={() => update({ background: c })}
          >
            {c === '#000000' ? '補黑' : '補白'}
          </button>
        ))}
        <button
          className="chip"
          onClick={() => {
            const local = Math.max(
              0,
              Math.min(item.duration - 0.01, (useUI.getState().player?.time ?? item.start) - item.start),
            );
            update({ blanks: includeAudio(cell.blanks, local, Math.min(item.duration, local + 1)) });
          }}
        >
          在此格目前秒數插入色塊
        </button>
      </div>
      <p className="hint">
        來源不足會自動補色。指定色塊會暫停來源播放，之後接續影片；每格總長相同。下方標記調整插入色塊的起迄。
      </p>
      <SourceRanges
        duration={item.duration}
        ranges={mediaSegments(item).map((s) => [s.start - item.start, s.end - item.start])}
        markerRanges={cell.blanks}
        markerLabel="色塊"
        thumbs={asset.thumbs}
        onChange={() => {}}
        onMarkerChange={(ranges) => update({ blanks: ranges })}
        onSeek={(t) => useUI.getState().player?.seek(item.start + t)}
      />
      {cell.blanks.map(([a, b], i) => (
        <div className="chips" key={i}>
          <span>
            色塊 {a.toFixed(2)}–{b.toFixed(2)} 秒
          </span>
          <button className="chip" onClick={() => update({ blanks: cell.blanks.filter((_, j) => j !== i) })}>
            移除此色塊
          </button>
        </div>
      ))}
    </details>
  );
}
