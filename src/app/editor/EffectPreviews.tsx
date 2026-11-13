import { useEffect, useRef, type ReactNode } from 'react';
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
function demoProject(preset: PreviewPreset): Project {
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
  if (preset.type === 'transition')
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
export function EffectPreviews({ children, presets }: { children: ReactNode; presets: PreviewPreset[] }) {
  const root = useRef<HTMLDivElement>(null);
  const signature = presets.map((p) => `${p.type}:${p.id}`).join('|');
  useEffect(() => {
    let stopped = false,
      raf = 0,
      comp: Compositor | null = null,
      last = 0;
    const sources = demoSources();
    const entries = signature
      .split('|')
      .filter(Boolean)
      .map((value) => {
        const [type, id] = value.split(':');
        return { key: value, preset: { id: id!, type: type as PreviewPreset['type'] } };
      });
    const projects = new Map(entries.map((e) => [e.key, demoProject(e.preset)]));
    void Compositor.create({ width: W, height: H }).then((created) => {
      if (stopped) {
        created.destroy();
        return;
      }
      comp = created;
      const draw = (now: number) => {
        if (stopped) return;
        if (now - last > 160) {
          last = now;
          const phase = window.matchMedia('(prefers-reduced-motion: reduce)').matches
            ? 0.5
            : (now / 1800) % 1;
          for (const canvas of root.current?.querySelectorAll<HTMLCanvasElement>(
            'canvas[data-effect-demo]',
          ) ?? []) {
            const rect = canvas.getBoundingClientRect();
            if (rect.bottom < 0 || rect.top > innerHeight) continue;
            const key = canvas.dataset.effectDemo!,
              p = projects.get(key);
            if (!p) continue;
            const t = key.startsWith('transition:') ? 0.5 + phase : 0.05 + phase * 1.9;
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
  }, [signature]);
  return (
    <div ref={root} className="effect-grid">
      {children}
    </div>
  );
}
