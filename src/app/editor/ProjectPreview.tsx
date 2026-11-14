import { Play, Pause } from 'lucide-react';
import { useEffect, useRef, useState, type RefObject } from 'react';
import { useUI } from '../../store/uiStore';

/** Copy the shared composed scene, including template frame, masks and animation. */
export function ProjectPreview({
  start,
  duration,
  label = '版型結果',
  targetCanvas,
}: {
  start: number;
  duration: number;
  label?: string;
  targetCanvas?: RefObject<HTMLCanvasElement>;
}) {
  const player = useUI((s) => s.player);
  const canvas = useRef<HTMLCanvasElement>(null);
  const [playing, setPlaying] = useState(false);
  useEffect(() => {
    if (!player) return;
    const unsubscribe = player.subscribe((t, active) => {
      setPlaying(active);
      if (active && t >= start + duration - 0.015) player.pause();
    });
    let raf = 0,
      last = 0;
    const copy = (now: number) => {
      const surface = targetCanvas?.current ?? canvas.current;
      if (surface && now - last > 32) {
        const rect = surface.getBoundingClientRect();
        if (rect.width && rect.height && rect.bottom > 0 && rect.top < innerHeight) {
          if (!targetCanvas) {
            const width = Math.max(240, Math.round(rect.width * 2)),
              height = Math.round((width * rect.height) / rect.width);
            if (surface.width !== width || surface.height !== height) {
              surface.width = width;
              surface.height = height;
            }
          }
          const ctx = surface.getContext('2d')!,
            source = player.compositor.canvas;
          ctx.clearRect(0, 0, surface.width, surface.height);
          const k = Math.min(surface.width / source.width, surface.height / source.height),
            w = source.width * k,
            h = source.height * k;
          ctx.drawImage(source, (surface.width - w) / 2, (surface.height - h) / 2, w, h);
          last = now;
        }
      }
      raf = requestAnimationFrame(copy);
    };
    raf = requestAnimationFrame(copy);
    return () => {
      unsubscribe();
      cancelAnimationFrame(raf);
      player.pause();
    };
  }, [player, start, duration, targetCanvas]);
  return (
    <div className="project-preview" aria-label={`${label}預覽`}>
      {!targetCanvas && <canvas ref={canvas} width={240} height={240} aria-label={`${label}畫面`} />}
      <button
        className={`chip preview-toggle${playing ? ' active' : ''}`}
        aria-label={`${playing ? '暫停' : '播放'}${label}`}
        aria-pressed={playing}
        onClick={() => {
          if (!player) return;
          if (player.isPlaying) player.pause();
          else {
            if (player.time < start || player.time >= start + duration - 0.015) player.seek(start);
            player.play();
          }
        }}
      >
        {playing ? <Pause size={18} /> : <Play size={18} />}
      </button>
    </div>
  );
}
