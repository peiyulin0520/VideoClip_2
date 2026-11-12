import { useRef, useState, type PointerEvent } from 'react';
import type { VideoItem } from '../../model/types';
import { useProjectStore } from '../../store/projectStore';
import { useUI, toast } from '../../store/uiStore';
import { trimSourceRange } from '../../engine/groupTiming';
import { urlFor } from '../../engine/assetUrls';
import { MIN_CLIP_DURATION } from '../../model/defaults';
import { Sheet } from '../../ui/Sheet';

export function TrimEditor({ item, onClose }: { item: VideoItem; onClose: () => void }) {
  const p = useProjectStore((s) => s.project)!,
    asset = p.assets.find((a) => a.id === item.assetId)!;
  const [range, setRange] = useState([item.trimIn, item.trimIn + item.duration * item.speed]);
  const video = useRef<HTMLVideoElement>(null),
    bar = useRef<HTMLDivElement>(null);
  const drag = (side: number, e: PointerEvent<HTMLButtonElement>) => {
    e.preventDefault();
    e.currentTarget.setPointerCapture(e.pointerId);
    const el = e.currentTarget,
      initial = [...range];
    const move = (ev: globalThis.PointerEvent) => {
      const rect = bar.current!.getBoundingClientRect();
      const t = Math.max(
        0,
        Math.min(asset.duration, ((ev.clientX - rect.left) / rect.width) * asset.duration),
      );
      const next = [...initial];
      next[side] =
        side === 0
          ? Math.min(t, initial[1]! - MIN_CLIP_DURATION * item.speed)
          : Math.max(t, initial[0]! + MIN_CLIP_DURATION * item.speed);
      setRange(next);
      if (video.current) video.current.currentTime = Math.max(0, next[side]! - (side ? 0.02 : 0));
    };
    const up = () => {
      el.removeEventListener('pointermove', move);
      el.removeEventListener('pointerup', up);
      el.removeEventListener('pointercancel', up);
    };
    el.addEventListener('pointermove', move);
    el.addEventListener('pointerup', up);
    el.addEventListener('pointercancel', up);
  };
  return (
    <Sheet open title="剪取片段" onClose={onClose}>
      <video
        className="range-preview"
        ref={video}
        src={urlFor(p.id, asset.id)}
        playsInline
        muted
        onLoadedMetadata={(e) => {
          e.currentTarget.currentTime = item.trimIn;
        }}
      />
      <div ref={bar} className="source-range" data-testid="source-range">
        <div className="source-thumbs">
          {(asset.thumbs.length ? asset.thumbs : ['']).map((src, i) => (
            <img key={i} src={src || undefined} alt="" />
          ))}
        </div>
        <div className="range-dim" style={{ left: 0, width: `${(range[0]! / asset.duration) * 100}%` }} />
        <div
          className="range-dim"
          style={{ right: 0, width: `${(1 - range[1]! / asset.duration) * 100}%` }}
        />
        <div
          className="range-selection"
          style={{
            left: `${(range[0]! / asset.duration) * 100}%`,
            width: `${((range[1]! - range[0]!) / asset.duration) * 100}%`,
          }}
        />
        {[0, 1].map((side) => (
          <button
            key={side}
            className="source-handle"
            aria-label={side ? '來源終點拉桿' : '來源起點拉桿'}
            style={{ left: `${(range[side]! / asset.duration) * 100}%` }}
            onPointerDown={(e) => drag(side, e)}
          >
            {side ? '❯' : '❮'}
          </button>
        ))}
      </div>
      <p data-testid="source-range-values">
        來源 {range[0]!.toFixed(1)} 秒 → {range[1]!.toFixed(1)} 秒 · 選取{' '}
        {((range[1]! - range[0]!) / item.speed).toFixed(1)} 秒 / 原始素材 {asset.duration.toFixed(1)} 秒
      </p>
      <p className="hint">
        整段來源會一直保留，拖左右拉桿選取。時間軸左端向右拉會留下空白，右端位置不會縮回左邊。
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
