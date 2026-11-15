import { useState } from 'react';
import type { Track, VideoItem } from '../../model/types';
import { useProjectStore } from '../../store/projectStore';
import { setTransform } from '../../store/actions';
import { groupTransform } from '../../engine/templateGeometry';
import { arrangeTemplate, moveTemplateChild, updateTemplateChild } from '../../engine/templatePlayback';
import { Slider } from '../../ui/Slider';
import { FontSelect } from '../fonts/FontSelect';
import { TemplateCellEditor } from './TemplateCellEditor';

export function TemplateCells({ track }: { track: Track }) {
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
      {editing && (
        <TemplateCellEditor
          item={editing}
          index={track.items.findIndex((i) => i.id === editing.id)}
          onApply={(draft) =>
            useProjectStore.getState().apply((d) => updateTemplateChild(d, editing.id, draft))
          }
          onClose={() => setEditing(null)}
        />
      )}
      <h3>整組模板</h3>
      <label className="field">
        群組名稱
        <input
          aria-label="版型群組名稱"
          value={track.name}
          onChange={(e) =>
            useProjectStore.getState().apply(
              (d) => {
                d.tracks.find((t) => t.id === track.id)!.name = e.target.value;
              },
              { coalesce: `template-name:${track.id}` },
            )
          }
        />
      </label>
      <p className="hint">
        在預覽點選任一格後，拖移與雙指縮放都作用於整組框架和影片；點版型示意圖的素材可開啟選段，不會個別拉歪。
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
              arrangeTemplate(group);
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
      <h3>素材片段</h3>
      <div className="template-child-list">
        {track.items.map((it, i) =>
          it.type === 'text' ? null : (
            <div key={it.id} className="template-child-entry">
              <button
                className="chip"
                onClick={() => {
                  useProjectStore.getState().select(it.id);
                  setEditing(it);
                }}
              >
                第 {i + 1} 格 · {it.name || '片段範圍'}
              </button>
              <button
                className="icon-btn"
                aria-label={`第${i + 1}格提前播放`}
                onClick={() =>
                  useProjectStore.getState().apply((d) => moveTemplateChild(d, track.id, it.id, -1))
                }
              >
                ←
              </button>
              <button
                className="icon-btn"
                aria-label={`第${i + 1}格延後播放`}
                onClick={() =>
                  useProjectStore.getState().apply((d) => moveTemplateChild(d, track.id, it.id, 1))
                }
              >
                →
              </button>
            </div>
          ),
        )}
      </div>
    </section>
  );
}
