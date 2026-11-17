import { ArrowUp, PanelBottom, Pause, Play, ZoomIn, ZoomOut } from 'lucide-react';
import { useEffect, useState } from 'react';
import { formatTime } from '../../engine/timeline';
import { toast, useUI } from '../../store/uiStore';
import { KeyframeControl } from './KeyframeControl';
import { MAX_PPS, MIN_PPS } from './Timeline';
/** Only this small control strip follows the playback clock, never the whole editor. */
export function PlaybackBar({
  total,
  pps,
  setPps,
}: {
  total: number;
  pps: number;
  setPps: (pps: number) => void;
}) {
  const player = useUI((s) => s.player);
  const [time, setTime] = useState(player?.time ?? 0);
  const [playing, setPlaying] = useState(player?.isPlaying ?? false);
  const [buffering, setBuffering] = useState(false);
  useEffect(
    () =>
      player?.subscribe((t, active) => {
        setTime(t);
        setPlaying(active);
        setBuffering(player.isBuffering);
      }),
    [player],
  );
  return (
    <>
      {buffering && (
        <p className="hint playback-buffering" role="status">
          正在準備播放畫面…
        </p>
      )}
      <div className="playbar">
        <button
          className="icon-btn"
          aria-label={playing ? '暫停' : '播放'}
          aria-pressed={playing}
          data-playing={playing}
          onClick={() => {
            if (total <= 0) return toast('先匯入影片或照片');
            player?.toggle();
          }}
        >
          {playing ? <Pause size={22} /> : <Play size={22} />}
        </button>
        <span className="time" data-testid="time">
          <span>{formatTime(time)}</span> <span>/ {formatTime(total)}</span>
        </span>
        <span className="spacer" />
        <KeyframeControl />
        <button
          className="icon-btn"
          aria-label="回到預覽"
          title="回到預覽"
          onClick={(e) => e.currentTarget.closest('.editor')!.scrollTo({ top: 0 })}
        >
          <ArrowUp size={20} />
          <span>預覽</span>
        </button>
        <button
          className="icon-btn"
          aria-label="編輯工具"
          title="編輯工具"
          onClick={(e) =>
            e.currentTarget
              .closest('.editor')!
              .querySelector('.bottombar')!
              .scrollIntoView({ block: 'start' })
          }
        >
          <PanelBottom size={20} />
          <span>工具</span>
        </button>
        <button
          className="icon-btn"
          aria-label="縮小時間軸"
          onClick={() => setPps(Math.max(pps / 1.5, MIN_PPS))}
        >
          <ZoomOut size={22} />
          <span>縮小</span>
        </button>
        <button
          className="icon-btn"
          aria-label="放大時間軸"
          onClick={() => setPps(Math.min(pps * 1.5, MAX_PPS))}
        >
          <ZoomIn size={22} />
          <span>放大</span>
        </button>
      </div>
    </>
  );
}
