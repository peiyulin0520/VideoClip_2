import { useEffect, useRef, useState } from 'react';
import { useUI } from '../../store/uiStore';
import { useFonts } from '../../fonts/fontStore';
import { canvasFamily } from '../../engine/textRender';
import { schemeOf } from '../../engine/kinetic';
import { paintKinetic } from '../../engine/kinetic/render';
import type { KineticDef } from '../../engine/kinetic/core';
export function KineticCard({
  def,
  words,
  fontId,
  active,
  onPick,
}: {
  def: KineticDef;
  words: string[];
  fontId: string;
  active: boolean;
  onPick: () => void;
}) {
  const cv = useRef<HTMLCanvasElement>(null),
    button = useRef<HTMLButtonElement>(null),
    player = useUI((s) => s.player),
    epoch = useFonts((s) => s.epoch);
  const [playing, setPlaying] = useState(player?.isPlaying ?? false),
    [visible, setVisible] = useState(false);
  useEffect(() => player?.subscribe((_, playing) => setPlaying(playing)), [player]);
  useEffect(() => {
    const observer = new IntersectionObserver((entries) => setVisible(entries[0]?.isIntersecting ?? false));
    if (button.current) observer.observe(button.current);
    return () => observer.disconnect();
  }, []);
  const wordsKey = words.join('|');
  useEffect(() => {
    void epoch;
    const c = cv.current!;
    c.width = 128;
    c.height = def.area === 'full' ? 128 : def.area === 'lyrics' ? 50 : 72;
    const sch = schemeOf(def),
      p = {
        words: wordsKey.split('|'),
        fg: sch.fg,
        paper: sch.bg,
        hi: sch.hi,
        hifg: sch.hifg,
        bg: sch.bg,
        family: canvasFamily(fontId),
      };
    paintKinetic(c, def, p, def.poster, def.fade ?? 'none');
    if (!active || playing || !visible || window.matchMedia?.('(prefers-reduced-motion: reduce)').matches)
      return;
    let raf = 0,
      last = 0;
    const start = performance.now();
    const tick = (now: number) => {
      if (now - last > 50) {
        paintKinetic(c, def, p, def.poster + (now - start) / 1000, def.fade ?? 'none');
        last = now;
      }
      raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [def, wordsKey, fontId, epoch, active, playing, visible]);
  return (
    <button
      ref={button}
      className={`effect-card${active ? ' active' : ''}`}
      aria-label={`文字特效 ${def.zh}`}
      aria-pressed={active}
      onClick={onPick}
      data-kinetic-id={def.id}
    >
      <canvas ref={cv} aria-hidden="true" />
      <strong>{def.zh}</strong>
    </button>
  );
}
