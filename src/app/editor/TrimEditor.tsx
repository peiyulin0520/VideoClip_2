import { MediaPlayback } from '../../ui/MediaPlayback';
import { Undo2, Redo2 } from 'lucide-react';
import { useDraftHistory } from '../../ui/useDraftHistory';
import { RangeActions } from '../../ui/RangeActions';
import { selectedSourceRanges } from '../../engine/sourceSelections';
import { useRef, useState } from 'react';
import type { VideoItem } from '../../model/types';
import { useProjectStore } from '../../store/projectStore';
import { useUI, toast } from '../../store/uiStore';
import { trimSourceRange } from '../../engine/groupTiming';
import { previewUrlFor as urlFor } from '../../engine/assetUrls';
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
    <Sheet open title="剪取片段" onClose={onClose}>
      <video
        className="range-preview"
        ref={video}
        src={urlFor(p.id, asset.id)}
        playsInline
        style={{ filter: ranges.some(([a, b]) => cursor >= a && cursor < b) ? undefined : 'saturate(0)' }}
        onLoadedMetadata={(e) => {
          e.currentTarget.currentTime = Math.min(Math.max(cursor, 0.001), asset.duration - 0.001);
        }}
      />
      <div className="source-playback-row">
        <MediaPlayback media={video} label="片段預覽" start={0} end={asset.duration} onTime={setCursor} />
        <span>{cursor.toFixed(2)} 秒</span>
        <button className="icon-btn" aria-label="undo" disabled={!history.canUndo} onClick={history.undo}>
          <Undo2 size={18} />
        </button>
        <button className="icon-btn" aria-label="redo" disabled={!history.canRedo} onClick={history.redo}>
          <Redo2 size={18} />
        </button>
      </div>
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
      <RangeActions
        showCursor={false}
        ranges={ranges}
        cursor={cursor}
        duration={asset.duration}
        minimum={MIN_CLIP_DURATION * item.speed}
        onChange={history.set}
      />
      <p data-testid="source-range-values">
        來源 {range[0]!.toFixed(1)} 秒 → {range[1]!.toFixed(1)} 秒 · 選取{' '}
        {(ranges.reduce((n, [a, b]) => n + b - a, 0) / item.speed).toFixed(1)} 秒 / 原始素材{' '}
        {asset.duration.toFixed(1)} 秒
      </p>
      <p className="hint">
        點縮圖只移動白線與預覽；按新增標記才建立下一組。原色為選取，灰色為不選；中間未選取處保留原時間空白。播放鍵旁可復原、重做，右上
        X 不套用變更。
      </p>
      <div className="sheet-row">
        <button
          className="btn primary"
          disabled={!ranges.length}
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
