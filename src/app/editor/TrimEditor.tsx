import { useRef, useState } from 'react';
import type { VideoItem } from '../../model/types';
import { useProjectStore } from '../../store/projectStore';
import { useUI, toast } from '../../store/uiStore';
import { trimSourceRange } from '../../engine/groupTiming';
import { urlFor } from '../../engine/assetUrls';
import { SourceRanges } from '../../ui/SourceRanges';
import { Sheet } from '../../ui/Sheet';

export function TrimEditor({ item, onClose }: { item: VideoItem; onClose: () => void }) {
  const p = useProjectStore((s) => s.project)!,
    asset = p.assets.find((a) => a.id === item.assetId)!;
  const [range, setRange] = useState([item.trimIn, item.trimIn + item.duration * item.speed]);
  const video = useRef<HTMLVideoElement>(null);
  const [cursor, setCursor] = useState(item.trimIn);
  return (
    <Sheet open title="剪取片段" onClose={onClose}>
      <video
        className="range-preview"
        ref={video}
        src={urlFor(p.id, asset.id)}
        playsInline
        muted
        onLoadedMetadata={(e) => {
          e.currentTarget.currentTime = Math.min(Math.max(item.trimIn, 0.001), asset.duration - 0.001);
        }}
      />
      <SourceRanges
        duration={asset.duration}
        ranges={[range as [number, number]]}
        thumbs={asset.thumbs}
        cursor={cursor}
        onChange={(r) => setRange(r[0]!)}
        onSeek={(t) => {
          setCursor(t);
          if (video.current) video.current.currentTime = Math.min(t, asset.duration - 0.001);
        }}
      />
      <p data-testid="source-range-values">
        來源 {range[0]!.toFixed(1)} 秒 → {range[1]!.toFixed(1)} 秒 · 選取{' '}
        {((range[1]! - range[0]!) / item.speed).toFixed(1)} 秒 / 原始素材 {asset.duration.toFixed(1)} 秒
      </p>
      <p className="hint">
        整段來源會一直保留，拖曳上方倒三角選擇起點與終點；點縮圖可檢視該秒畫面。時間軸左端向右拉會留下空白，右端位置不會縮回左邊。
      </p>
      <div className="sheet-row">
        <button className="btn" onClick={() => setRange([0, asset.duration])}>
          還原完整素材
        </button>
        <button
          className="btn primary"
          onClick={() => {
            try {
              useUI.getState().player?.pause();
              useProjectStore.getState().apply((d) => trimSourceRange(d, item.id, range[0]!, range[1]!));
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
