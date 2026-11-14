import { useUI } from '../../store/uiStore';
import { Play, Pause } from 'lucide-react';
import { useEffect, useRef, useState, type ReactNode } from 'react';
import { Compositor } from '../../engine/compositor';
import { buildScene } from '../../engine/scene';
import { createClip, createProject } from '../../model/defaults';
import type { Asset, Project, TransitionPreset } from '../../model/types';
export type PreviewPreset = { id: string; type: 'transition' | 'effect' };
const W = 160,
  H = 96;
function demoSources() {
  return ['A', 'B'].map((text, i) => {
    const c = document.createElement('canvas');
    c.width = W;
    c.height = H;
    const ctx = c.getContext('2d')!;
    ctx.fillStyle = i ? '#ac563f' : '#497b95';
    ctx.fillRect(0, 0, W, H);
    ctx.fillStyle = i ? '#ecd0a2' : '#bdd8de';
    for (let x = 0; x < 6; x++) {
      ctx.fillRect(x * 38 - 15, i ? 5 : 65, 20, 25);
    }
    ctx.fillStyle = '#ffffff';
    ctx.font = 'bold 48px system-ui';
    ctx.textAlign = 'center';
    ctx.fillText(text, W / 2, 65);
    return c;
  });
}
function demoProject(preset: PreviewPreset, single?: 'enter' | 'exit'): Project {
  const p = createProject('A/B');
  p.width = W;
  p.height = H;
  p.freeMain = true;
  p.flexibleLayers = true;
  p.assets = ['A', 'B'].map((id): Asset => ({
    id,
    kind: 'image',
    name: id,
    mime: 'image/png',
    size: 1,
    duration: 0,
    width: W,
    height: H,
    hasAudio: false,
    thumbs: [],
  }));
  p.tracks[0]!.items = p.assets.map((a, i) => ({ ...createClip(a), id: a.id, start: i, duration: 1 }));
  if (single) {
    p.tracks[0]!.items = [{ ...p.tracks[0]!.items[single === 'enter' ? 1 : 0]!, start: 0 }];
    p.tracks[0]!.items[0]!.duration = 2;
    p.tracks[0]!.items[0]!.animations = { [single]: { preset: preset.id, duration: 1 } };
  } else if (preset.type === 'transition')
    p.transitions = [
      { id: 'demo', preset: preset.id as TransitionPreset, fromId: 'A', toId: 'B', duration: 1 },
    ];
  else
    p.effects = [
      {
        id: 'demo',
        preset: preset.id as NonNullable<Project['effects']>[number]['preset'],
        start: 0,
        duration: 2,
        strength: 1,
      },
    ];
  return p;
}
/** One small shared WebGL compositor for every visible A/B card, avoiding context exhaustion. */
export function EffectPreviews({
  children,
  presets,
  single,
}: {
  children: ReactNode;
  presets: PreviewPreset[];
  single?: 'enter' | 'exit';
}) {
  const player = useUI((s) => s.player);
  const [mainPlaying, setMainPlaying] = useState(player?.isPlaying ?? false);
  useEffect(() => player?.subscribe((_, active) => setMainPlaying(active)), [player]);
  const [playing, setPlaying] = useState(true);
  const effectivePlaying = playing && !mainPlaying;
  const running = useRef(effectivePlaying);
  useEffect(() => {
    running.current = effectivePlaying;
  }, [effectivePlaying]);
  const root = useRef<HTMLDivElement>(null);
  const signature = presets.map((p) => `${p.type}:${p.id}`).join('|');
  useEffect(() => {
    let stopped = false,
      raf = 0,
      comp: Compositor | null = null,
      last = 0,
      elapsed = 0,
      previous = 0;
    const sources = demoSources();
    const entries = signature
      .split('|')
      .filter(Boolean)
      .map((value) => {
        const [type, id] = value.split(':');
        return { key: value, preset: { id: id!, type: type as PreviewPreset['type'] } };
      });
    const projects = new Map(entries.map((e) => [e.key, demoProject(e.preset, single)]));
    void Compositor.create({ width: W, height: H, preview: true }).then((created) => {
      if (stopped) {
        created.destroy();
        return;
      }
      comp = created;
      const draw = (now: number) => {
        if (stopped) return;
        if (previous && running.current) elapsed += now - previous;
        previous = now;
        if (now - last > 160 && (running.current || !last)) {
          last = now;
          const phase = window.matchMedia('(prefers-reduced-motion: reduce)').matches
            ? 0.5
            : (elapsed / 1800) % 1;
          for (const canvas of root.current?.querySelectorAll<HTMLCanvasElement>(
            'canvas[data-effect-demo]',
          ) ?? []) {
            const rect = canvas.getBoundingClientRect();
            if (!rect.width || !rect.height || rect.bottom < 0 || rect.top > innerHeight) continue;
            const key = canvas.dataset.effectDemo!,
              p = projects.get(key);
            if (!p) continue;
            const t = single
              ? single === 'enter'
                ? phase
                : 1 + phase
              : key.startsWith('transition:')
                ? 0.5 + phase
                : 0.05 + phase * 1.9;
            comp!.render(
              buildScene(p, t, W, H, (item) => ({
                source: sources[item.assetId === 'A' ? 0 : 1]!,
                ready: true,
                srcW: W,
                srcH: H,
              })),
            );
            canvas.getContext('2d')?.drawImage(comp!.canvas, 0, 0);
            canvas.dataset.demoReady = 'true';
          }
        }
        raf = requestAnimationFrame(draw);
      };
      raf = requestAnimationFrame(draw);
    });
    return () => {
      stopped = true;
      cancelAnimationFrame(raf);
      comp?.destroy();
    };
  }, [signature, single]);
  return (
    <div className="effect-previews">
      <button
        className={`chip preview-toggle${effectivePlaying ? ' active' : ''}`}
        aria-label={effectivePlaying ? '暫停特效示意' : '播放特效示意'}
        aria-pressed={effectivePlaying}
        onClick={() => {
          if (mainPlaying) {
            player?.pause();
            setPlaying(true);
          } else setPlaying((p) => !p);
        }}
      >
        {effectivePlaying ? <Pause size={18} /> : <Play size={18} />}
      </button>
      <div ref={root} className="effect-grid">
        {children}
      </div>
    </div>
  );
}
