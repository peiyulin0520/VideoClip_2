import { MediaPlayback } from '../../ui/MediaPlayback';
import { Undo2 } from 'lucide-react';
import { useDraftHistory } from '../../ui/useDraftHistory';
import { SelectionAddButton } from '../../ui/SelectionAddButton';
import { selectedSourceRanges } from '../../engine/sourceSelections';
import { useRef, useState } from 'react';
import type { VideoItem } from '../../model/types';
import { useProjectStore } from '../../store/projectStore';
import { useUI, toast } from '../../store/uiStore';
import { trimSourceRange } from '../../engine/groupTiming';
import { urlFor } from '../../engine/assetUrls';
import { MIN_CLIP_DURATION } from '../../model/defaults';
import { SourceRanges } from '../../ui/SourceRanges';
import { Sheet } from '../../ui/Sheet';

export function TrimEditor({ item, onClose }: { item: VideoItem; onClose: () => void }) {
  const p = useProjectStore((s) => s.project)!,
    asset = p.assets.find((a) => a.id === item.assetId)!;
  const history = useDraftHistory<[number, number][]>(selectedSourceRanges(item, asset.duration));
  const ranges = history.value;
  const range = [ranges[0]?.[0] ?? 0, ranges.at(-1)?.[1] ?? asset.duration];
  const video = useRef<HTMLVideoElement>(null);
  const [cursor, setCursor] = useState(item.trimIn);
  return (
    <Sheet
      open
      title="剪取片段"
      onClose={onClose}
      titleAction={
        <button
          className="icon-btn"
          aria-label="復原上一步選段"
          disabled={!history.canUndo}
          onClick={history.undo}
        >
          <Undo2 />
        </button>
      }
    >
      <video
        className="range-preview"
        ref={video}
        src={urlFor(p.id, asset.id)}
        playsInline
        muted
        onLoadedMetadata={(e) => {
          e.currentTarget.currentTime = Math.min(Math.max(cursor, 0.001), asset.duration - 0.001);
        }}
      />
      <MediaPlayback media={video} label="片段預覽" start={range[0]} end={range[1]} onTime={setCursor} />
      <SourceRanges
        duration={asset.duration}
        minimum={MIN_CLIP_DURATION * item.speed}
        ranges={ranges}
        thumbs={asset.thumbs}
        cursor={cursor}
        onChange={history.set}
        onEditStart={history.begin}
        onEditEnd={history.end}
        onSeek={(t) => {
          setCursor(t);
          if (video.current) video.current.currentTime = Math.min(t, asset.duration - 0.001);
        }}
      />
      <p className="source-now">目前白線：{cursor.toFixed(2)} 秒</p>
      <SelectionAddButton
        ranges={ranges}
        cursor={cursor}
        duration={asset.duration}
        minimum={MIN_CLIP_DURATION * item.speed}
        onChange={history.set}
      />
      {ranges.length > 1 &&
        ranges.map(([a, b], i) => (
          <p key={i}>
            第 {i + 1} 組：{a.toFixed(2)}–{b.toFixed(2)} 秒{' '}
            <button className="chip" onClick={() => history.set(ranges.filter((_, j) => j !== i))}>
              移除第 {i + 1} 組片段
            </button>
          </p>
        ))}
      <p data-testid="source-range-values">
        來源 {range[0]!.toFixed(1)} 秒 → {range[1]!.toFixed(1)} 秒 · 選取{' '}
        {(ranges.reduce((n, [a, b]) => n + b - a, 0) / item.speed).toFixed(1)} 秒 / 原始素材{' '}
        {asset.duration.toFixed(1)} 秒
      </p>
      <p className="hint">
        點縮圖只移動白線與預覽；按新增標記才建立下一組。原色為選取，灰色為不選；中間未選取處保留原時間空白。右上角可復原，取消不套用變更。
      </p>
      <div className="sheet-row">
        <button className="btn" onClick={onClose}>
          取消
        </button>
        <button
          className="btn primary"
          onClick={() => {
            try {
              useUI.getState().player?.pause();
              useProjectStore.getState().apply((d) => {
                trimSourceRange(d, item.id, range[0]!, range[1]!);
                const target = d.tracks.flatMap((tr) => tr.items).find((it) => it.id === item.id);
                if (target && target.type !== 'text')
                  target.sourceRanges = ranges.length > 1 ? ranges : undefined;
              });
              onClose();
            } catch (e) {
              toast((e as Error).message);
            }
          }}
        >
          套用片段範圍
        </button>
      </div>
    </Sheet>
  );
}
