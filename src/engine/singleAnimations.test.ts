import { describe, expect, it } from 'vitest';
import { createClip, createProject, createTextItem } from '../model/defaults';
import type { Asset } from '../model/types';
import type { SceneLayer } from './compositor';
import { applySingleAnimations } from './singleAnimations';
import { transitionPairs } from './transitions';
import { groupFrame, cellViewport } from './templateGeometry';
import { collagePlan, carryTemplateEdits } from './layouts';

const asset: Asset = {
  id: 'a',
  name: 'a',
  kind: 'image',
  mime: 'image/png',
  width: 100,
  height: 100,
  duration: 0,
  size: 1,
  thumbs: [],
  hasAudio: false,
};
const layer = (id: string, x = 50): SceneLayer => ({
  id,
  kind: 'image',
  source: {} as HTMLCanvasElement,
  ready: true,
  srcW: 100,
  srcH: 100,
  box: { cx: x, cy: 50, w: 100, h: 100, rotation: 0 },
  opacity: 0.8,
  blend: 'normal',
  cornerRadius: 0,
});
function fixture() {
  const p = createProject('single');
  p.assets = [asset];
  const a = { ...createClip(asset), id: 'a', start: 0, duration: 4 };
  p.tracks[0]!.items = [a];
  return { p, a };
}
describe('single A entry/exit with an empty other side', () => {
  it('fades only A and leaves unrelated layers unchanged', () => {
    const { p, a } = fixture();
    a.animations = {
      enter: { preset: 'crossfade', duration: 1 },
      exit: { preset: 'crossfade', duration: 1 },
    };
    const background = layer('untouched');
    const start = applySingleAnimations([background, layer('a')], p, 0.5, 100, 100);
    expect(start[0]).toBe(background);
    expect(start[1]!.opacity).toBeCloseTo(0.4);
    expect(applySingleAnimations([layer('a')], p, 2, 100, 100)[0]!.opacity).toBe(0.8);
    expect(applySingleAnimations([layer('a')], p, 3.75, 100, 100)[0]!.opacity).toBeCloseTo(0.2);
    expect(applySingleAnimations([layer('a')], p, 0, 100, 100)).toEqual([]);
  });
  it('moves a translated asset relative to its own size and crops relative to its own bounds', () => {
    const { p, a } = fixture();
    a.animations = { enter: { preset: 'slide-left', duration: 1 } };
    expect(applySingleAnimations([layer('a', 150)], p, 0.5, 400, 400)[0]!.box.cx).toBe(200);
    a.animations.enter!.preset = 'wipe-right';
    const result = applySingleAnimations([layer('a', 150)], p, 0.5, 400, 400)[0]!;
    expect(result.viewport).toEqual({ x: 100, y: 0, w: 50, h: 100 });
    expect(result.box.cx).toBe(150);
  });
  it('moves template cells, frame and caption by the same amount without moving another track', () => {
    const { p } = fixture();
    const plan = collagePlan(p, ['a', 'a', 'a'], 'photobooth', 'none', 0, 4);
    p.tracks.push(plan.tracks[0]!);
    const group = p.tracks.at(-1)!;
    group.layout!.animations = { enter: { preset: 'push-left', duration: 1 } };
    const ids = [`${group.id}-frame`, `${group.id}-title`, ...group.items.map((x) => x.id)];
    const background = layer('a');
    const result = applySingleAnimations([background, ...ids.map((id) => layer(id))], p, 0.5, 100, 100);
    expect(result[0]).toBe(background);
    for (const x of result.slice(1)) expect(x.box.cx).toBe(78.125);
  });
  it('clamps overlapping entry/exit lengths and preserves appearance when reapplying a template', () => {
    const { p, a } = fixture();
    a.duration = 1;
    a.animations = {
      enter: { preset: 'crossfade', duration: 3 },
      exit: { preset: 'crossfade', duration: 3 },
    };
    expect(applySingleAnimations([layer('a')], p, 0.25, 100, 100)[0]!.opacity).toBeCloseTo(0.4);
    const old = collagePlan(p, ['a', 'a', 'a'], 'photobooth', 'none', 0, 3).tracks[0]!;
    Object.assign(old.layout!, {
      caption: '',
      frameColor: '#123456',
      captionColor: '#abcdef',
      frameOpacity: 0.4,
      animations: a.animations,
    });
    const next = collagePlan(p, ['a', 'a', 'a'], 'photobooth', 'none', 0, 3).tracks[0]!;
    carryTemplateEdits(next, old);
    expect(next.layout).toMatchObject({
      caption: '',
      frameColor: '#123456',
      captionColor: '#abcdef',
      frameOpacity: 0.4,
      animations: a.animations,
    });
    expect(next.layout!.animations).not.toBe(old.layout!.animations);
  });
});

describe('independent template dimensions', () => {
  it('keeps a portrait frame portrait on a wide output, and a square preset square', () => {
    const { p } = fixture();
    const strip = collagePlan(p, ['a', 'a', 'a'], 'photobooth', 'none', 0, 4).tracks[0]!;
    const portrait = groupFrame(strip, 1080, 1920, 0);
    const wide = groupFrame(strip, 1920, 1080, 0);
    expect(portrait.w / portrait.h).toBeCloseTo(9 / 16);
    expect(wide.w / wide.h).toBeCloseTo(9 / 16);
    expect(wide).toMatchObject({ cx: 960, cy: 540, w: 607.5, h: 1080 });
    const square = collagePlan(p, ['a', 'a', 'a', 'a'], 'polaroid', 'none', 0, 4).tracks[0]!;
    expect(groupFrame(square, 1920, 1080, 0).w).toBe(1080);
    expect(groupFrame(square, 1920, 1080, 0).h).toBe(1080);
  });
  it('edits width and height independently, carries dimensions and keeps cell viewports inside the same frame', () => {
    const { p } = fixture();
    const strip = collagePlan(p, ['a', 'a', 'a'], 'photobooth', 'none', 0, 4).tracks[0]!;
    strip.layout!.size = { width: 720, height: 1600 };
    const box = groupFrame(strip, 1080, 1920, 0);
    expect(box).toMatchObject({ w: 720, h: 1600 });
    const slot = cellViewport(strip, strip.items[0] as import('../model/types').VideoItem, 0, 0, 1080, 1920)!;
    expect(slot.w * 1080).toBeCloseTo(720 * 0.84);
    expect(slot.h * 1920).toBeCloseTo(1600 * 0.27);
    const next = collagePlan(p, ['a', 'a', 'a'], 'photobooth', 'none', 0, 4).tracks[0]!;
    carryTemplateEdits(next, strip);
    expect(next.layout!.size).toEqual({ width: 720, height: 1600 });
    expect(next.layout!.size).not.toBe(strip.layout!.size);
  });
  it('also offers A/B joins for adjacent text or shape assets, while excluding audio', () => {
    const { p } = fixture();
    const a = createTextItem(0),
      b = createTextItem(3);
    p.tracks[0]!.items = [a, b];
    expect(transitionPairs(p).map((pair) => [pair.from.id, pair.to.id])).toEqual([[a.id, b.id]]);
  });
});
