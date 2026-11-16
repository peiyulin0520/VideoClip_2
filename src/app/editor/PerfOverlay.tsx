import { useEffect, useState } from 'react';
import type { Player } from '../../engine/player';
import { usePreferences } from '../../store/preferences';
export function PerfOverlay({ player }: { player: Player | null }) {
  const enabled = usePreferences((s) => s.showPerf);
  const [stats, setStats] = useState<ReturnType<Player['stats']> | null>(null);
  useEffect(() => {
    if (!enabled || !player) return;
    const timer = window.setInterval(() => setStats(player.stats()), 500);
    return () => clearInterval(timer);
  }, [enabled, player]);
  if (!enabled || !stats) return null;
  return (
    <div className="playback-perf" data-testid="perf-overlay" aria-label="播放效能">
      <div>
        合成 {stats.fps.toFixed(1)} fps · 場景 {stats.sceneMs.toFixed(1)} ms · 合成{' '}
        {stats.compositeMs.toFixed(1)} ms
      </div>
      <div>
        慢格 {stats.slowFrames} · 最長繪製 {stats.worstMs.toFixed(1)} ms · 播放跳轉 {stats.hardSeeks}
      </div>
      <div>
        預覽 {stats.canvas} · 解碼 {stats.sources.length}
      </div>
      {stats.sources.map((v, i) => (
        <div key={i}>
          影片 {i + 1}：{v.width} × {v.height} · 解碼掉格 {v.dropped}
        </div>
      ))}
      {stats.transition.frames > 0 && (
        <div>
          最近轉場 {stats.transition.frames} 格 · 慢格 {stats.transition.slowFrames} · 跳轉{' '}
          {stats.transition.hardSeeks}
        </div>
      )}
    </div>
  );
}
