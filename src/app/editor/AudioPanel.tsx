import { itemName } from '../../engine/itemName';
import { useRef, useState } from 'react';
import { useProjectStore } from '../../store/projectStore';
import { editItem, removeAnyItem } from '../../store/actions';
import { useUI, toast } from '../../store/uiStore';
import { addMaterialFiles, separateAudio, setAudioEnabled } from '../../engine/materials';
import type { VideoItem } from '../../model/types';
import { AudioRangeEditor } from './AudioRangeEditor';
import { Slider } from '../../ui/Slider';

export function AudioPanel() {
  const project = useProjectStore((s) => s.project)!;
  const [editing, setEditing] = useState<VideoItem | null>(null);
  const input = useRef<HTMLInputElement>(null);
  const entries = project.tracks.flatMap((track) =>
    track.items.flatMap((item) => {
      if (item.type === 'text') return [];
      const asset = project.assets.find((a) => a.id === item.assetId);
      return asset?.hasAudio ? [{ item, asset, track }] : [];
    }),
  );
  return (
    <div className="panel scroll" aria-label="音訊設定">
      {editing && (
        <AudioRangeEditor
          item={editing}
          asset={project.assets.find((a) => a.id === editing.assetId)!}
          onClose={() => setEditing(null)}
        />
      )}
      <button className="btn primary" onClick={() => input.current?.click()}>
        ＋ 匯入背景音樂
      </button>
      <input
        hidden
        ref={input}
        data-testid="music-files"
        type="file"
        accept="audio/*,.mp3,.m4a,.wav,.ogg,.aac,.opus,.flac"
        multiple
        onChange={(e) => {
          const files = Array.from(e.target.files ?? []);
          e.target.value = '';
          if (!files.length) return;
          useUI.getState().setBusy('正在匯入音樂…');
          void addMaterialFiles(files, useUI.getState().player?.time ?? 0)
            .catch((err: unknown) => toast(err instanceof Error ? err.message : '匯入失敗'))
            .finally(() => useUI.getState().setBusy(null));
        }}
      />
      <p className="hint">
        音樂放在播放頭位置。時間軸長按拖移、拉片頭片尾修剪；每支影片可保留、關閉或分離原音。
      </p>
      {entries.length === 0 && <p className="hint">目前沒有音訊。可匯入配樂，或加入帶有聲音的影片。</p>}
      {entries.map(({ item, asset, track }) => (
        <div className="audio-row" key={item.id}>
          <button
            className="chip audio-source"
            onClick={() => {
              useProjectStore.getState().select(item.id);
              useUI.getState().player?.seek(item.start);
            }}
          >
            {asset.thumbs[0] ? (
              <img src={asset.thumbs[0]} alt={`${itemName(project, item)} 素材縮圖`} />
            ) : (
              <span className="audio-note">♫</span>
            )}
            <span>
              {item.type === 'audio' ? '♫' : '原音'} {itemName(project, item)}
              <small>
                {track.name} · 時間軸 {item.start.toFixed(2)}–{(item.start + item.duration).toFixed(2)} 秒
              </small>
            </span>
          </button>
          <label className="check-row">
            <input
              type="checkbox"
              aria-label={`保留音訊 ${item.id}`}
              checked={item.audioEnabled !== false}
              onChange={(e) => setAudioEnabled(item.id, e.target.checked)}
            />
            保留音訊{track.muted ? '（軌道靜音中）' : ''}
          </label>
          <Slider
            label={`音量 ${itemName(project, item)}`}
            value={Math.round(item.volume * 100)}
            min={0}
            max={200}
            step={1}
            format={(v) => `${v}%`}
            onChange={(v) =>
              editItem(
                item.id,
                (it) => {
                  if (it.type !== 'text') it.volume = v / 100;
                },
                { coalesce: `audio-volume:${item.id}` },
              )
            }
          />
          <div className="chips">
            <button
              className="chip"
              onClick={() => {
                useUI.getState().player?.pause();
                setEditing(item);
              }}
            >
              片段範圍
            </button>
            {item.type === 'video' && (
              <button
                className="chip"
                onClick={() => {
                  try {
                    separateAudio(item.id);
                  } catch (e) {
                    toast((e as Error).message);
                  }
                }}
              >
                分離原音
              </button>
            )}
            <button
              className="chip"
              onClick={() =>
                item.type === 'audio' ? removeAnyItem(item.id) : setAudioEnabled(item.id, false)
              }
            >
              {item.type === 'audio' ? '刪除音軌' : '移除原音'}
            </button>
          </div>
        </div>
      ))}
    </div>
  );
}
