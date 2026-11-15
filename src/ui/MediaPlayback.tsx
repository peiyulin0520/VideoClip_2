import { Play, Pause } from 'lucide-react';
import { useEffect, useRef, useState, type RefObject } from 'react';
import { toast, useUI } from '../store/uiStore';

/** Explicit controls for source previews; never rely on the browser's hidden controls. */
export function MediaPlayback({
  media,
  label,
  start = 0,
  end = Infinity,
  onTime,
}: {
  media: RefObject<HTMLVideoElement | HTMLAudioElement | null>;
  label: string;
  start?: number;
  end?: number;
  onTime?: (time: number) => void;
}) {
  const [playing, setPlaying] = useState(false);
  const latest = useRef({ start, end, onTime });
  useEffect(() => {
    latest.current = { start, end, onTime };
  }, [start, end, onTime]);
  useEffect(() => {
    const el = media.current;
    if (!el) return;
    let raf = 0;
    const tick = () => {
      latest.current.onTime?.(el.currentTime);
      if (el.currentTime >= latest.current.end - 0.015) el.pause();
      if (!el.paused) raf = requestAnimationFrame(tick);
    };
    const play = () => {
      setPlaying(true);
      cancelAnimationFrame(raf);
      raf = requestAnimationFrame(tick);
    };
    const pause = () => {
      setPlaying(false);
      cancelAnimationFrame(raf);
      latest.current.onTime?.(el.currentTime);
    };
    el.addEventListener('play', play);
    el.addEventListener('pause', pause);
    el.addEventListener('ended', pause);
    return () => {
      cancelAnimationFrame(raf);
      el.pause();
      el.removeEventListener('play', play);
      el.removeEventListener('pause', pause);
      el.removeEventListener('ended', pause);
    };
  }, [media]);
  return (
    <button
      className={`chip preview-toggle${playing ? ' active' : ''}`}
      aria-label={`${playing ? '暫停' : '播放'}${label}`}
      aria-pressed={playing}
      onClick={() => {
        const el = media.current;
        if (!el) return;
        if (!el.paused) el.pause();
        else {
          useUI.getState().player?.pause();
          // Source previews have their own audible element, activated only by this gesture.
          // eslint-disable-next-line react-hooks/immutability -- Explicit user-gesture DOM media control.
          el.muted = false;
          if (el.currentTime < start || el.currentTime >= end - 0.015) el.currentTime = start;
          void el.play().catch(() => toast('無法播放，請再點一次'));
        }
      }}
    >
      {playing ? <Pause size={18} /> : <Play size={18} />}
    </button>
  );
}
