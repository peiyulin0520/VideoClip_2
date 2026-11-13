import type { Project } from '../model/types';
import type { SceneLayer } from './compositor';
import { DEFAULT_ADJUSTMENT } from './keyframes';
export { VIDEO_EFFECTS } from './effectCatalog';
const canvases = new Map<string, HTMLCanvasElement>();
function particles(preset: string, t: number) {
  const frame = Math.floor(t * 12),
    key = preset === 'vignette' ? preset : `${preset}:${frame}`;
  if (canvases.has(key)) return canvases.get(key)!;
  const c = document.createElement('canvas');
  c.width = 320;
  c.height = 568;
  const ctx = c.getContext('2d')!;
  const random = (n: number) => {
    const x = Math.sin(n * 127.1 + 19.17) * 43758.5453;
    return x - Math.floor(x);
  };
  if (preset === 'vignette') {
    const g = ctx.createRadialGradient(160, 284, 65, 160, 284, 330);
    g.addColorStop(0, '#00000000');
    g.addColorStop(1, '#000000dd');
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, 320, 568);
  } else if (preset === 'grain')
    for (let i = 0; i < 3500; i++) {
      ctx.fillStyle = i % 2 ? '#ffffff66' : '#00000066';
      ctx.fillRect(random(i + frame * 4096) * 320, random(i * 3 + frame * 4096) * 568, 1, 1);
    }
  else
    for (let i = 0; i < (preset === 'snow' ? 90 : 22); i++) {
      const x = random(i * 3) * 320 + (preset === 'snow' ? Math.sin(t + i) * 10 : 0),
        y = (random(i * 5) * 568 + t * (preset === 'snow' ? 24 : 0)) % 568;
      const size = preset === 'snow' ? 1 + random(i) * 2 : 2 + random(i) * 4;
      ctx.globalAlpha = preset === 'snow' ? 0.5 + random(i) * 0.5 : 0.2 + 0.8 * Math.sin(t * 3 + i) ** 2;
      ctx.fillStyle = '#ffffff';
      ctx.beginPath();
      if (preset === 'snow') ctx.arc(x, y, size, 0, Math.PI * 2);
      else {
        ctx.moveTo(x - size * 2, y);
        ctx.lineTo(x - size / 3, y - size / 3);
        ctx.lineTo(x, y - size * 2);
        ctx.lineTo(x + size / 3, y - size / 3);
        ctx.lineTo(x + size * 2, y);
        ctx.lineTo(x + size / 3, y + size / 3);
        ctx.lineTo(x, y + size * 2);
        ctx.lineTo(x - size / 3, y + size / 3);
        ctx.closePath();
      }
      ctx.fill();
    }
  if (canvases.size > 8) canvases.delete(canvases.keys().next().value!);
  canvases.set(key, c);
  return c;
}
export function videoEffectOverlay(
  effect: NonNullable<Project['effects']>[number],
  t: number,
  w: number,
  h: number,
): SceneLayer | null {
  if (
    !['grain', 'snow', 'sparkle', 'vignette'].includes(effect.preset) ||
    t < effect.start ||
    t >= effect.start + effect.duration
  )
    return null;
  const c = particles(effect.preset, t - effect.start);
  return {
    id: effect.id,
    kind: 'image',
    source: c,
    srcW: 320,
    srcH: 568,
    frameW: 320,
    frameH: 568,
    sourceStamp: Math.floor((t - effect.start) * 12),
    ready: true,
    box: { cx: w / 2, cy: h / 2, w, h, rotation: 0 },
    opacity: effect.strength,
    blend: 'normal',
    cornerRadius: 0,
  };
}
export function applyVideoEffects(layers: SceneLayer[], project: Project, t: number, w: number, h: number) {
  let out = layers;
  for (const effect of project.effects ?? []) {
    if (t < effect.start || t >= effect.start + effect.duration) continue;
    const s = effect.strength,
      local = t - effect.start;
    out = out.flatMap((layer) => {
      if (effect.targetId && layer.id !== effect.targetId) return [layer];
      const l = { ...layer, box: { ...layer.box } },
        extra: SceneLayer[] = [];
      const adj = { ...DEFAULT_ADJUSTMENT, ...l.adjustment };
      if (effect.preset === 'shake' || effect.preset === 'pulse') {
        const scale = effect.preset === 'pulse' ? 1 + s * 0.08 * (1 + Math.sin(local * 6)) : 1 + s * 0.06;
        const dx = effect.preset === 'shake' ? Math.sin(local * 27) * w * 0.014 * s : 0,
          dy = effect.preset === 'shake' ? Math.sin(local * 33) * h * 0.009 * s : 0;
        l.box = {
          ...l.box,
          cx: w / 2 + (l.box.cx - w / 2) * scale + dx,
          cy: h / 2 + (l.box.cy - h / 2) * scale + dy,
          w: l.box.w * scale,
          h: l.box.h * scale,
        };
        if (l.viewport)
          l.viewport = {
            x: w / 2 + (l.viewport.x - w / 2) * scale + dx,
            y: h / 2 + (l.viewport.y - h / 2) * scale + dy,
            w: l.viewport.w * scale,
            h: l.viewport.h * scale,
          };
      }
      if (effect.preset === 'soft-blur') l.blur = 14 * s;
      if (effect.preset === 'mono') adj.saturation *= 1 - s;
      if (effect.preset === 'warm-tone') adj.temperature += s;
      if (effect.preset === 'cool-tone') adj.temperature -= s;
      l.adjustment = adj;
      if (effect.preset === 'glitch-video' || effect.preset === 'rgb-split') {
        for (let i = 0; i < (effect.preset === 'rgb-split' ? 2 : 5); i++) {
          const shift = Math.sin(local * 19 + i * 7) * w * 0.025 * s;
          extra.push({
            ...l,
            id: `${l.id}-${effect.id}-${i}`,
            continuity: undefined,
            box: { ...l.box, cx: l.box.cx + shift },
            opacity: l.opacity * 0.32 * s,
            adjustment: { ...adj, tint: i % 2 ? '#ff4466' : '#44ddff' },
            viewport:
              effect.preset === 'glitch-video'
                ? { x: 0, y: h * (i / 5 + 0.03 * Math.sin(local * 7)), w, h: h / 24 }
                : l.viewport,
          });
        }
      }
      return [l, ...extra];
    });
  }
  return out;
}
