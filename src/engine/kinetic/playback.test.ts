import { expect, it } from 'vitest';
import { KINETIC } from './index';
import { kineticClock } from './render';
import { continuousMotion } from '../continuousMotion';
it('every reference effect holds before its disappearance and remains complete at arbitrarily late times', () => {
  expect(KINETIC).toHaveLength(64);
  for (const def of KINETIC) {
    const natural = def.len(def.words),
      duration = natural ?? 4,
      k = { id: def.id, playback: 'hold' as const };
    expect(kineticClock(duration - 0.1, k, natural).held, def.id).toBe(true);
    expect(kineticClock(duration + 100, k, natural)).toMatchObject({ held: true, time: 0 });
  }
});
it('loop duration and speed remap deterministically without holding or losing the selected effect', () => {
  const k = { id: 'burst' as const, playback: 'loop' as const, duration: 2, speed: 2 };
  expect(kineticClock(0.25, k, 4)).toMatchObject({ held: false, time: 1 });
  expect(kineticClock(1.25, k, 4)).toEqual(kineticClock(0.25, k, 4));
});
it('continuous motions run through the full item and have deterministic neutral midpoints', () => {
  expect(continuousMotion({ kind: 'drift' }, 5, 10, 100, 200).y).toBeCloseTo(0);
  expect(continuousMotion({ kind: 'slide' }, 5, 10, 100, 200).x).toBeCloseTo(0, 8);
  expect(continuousMotion({ kind: 'slide' }, 0, 10, 100, 200).x).toBe(120);
  expect(continuousMotion({ kind: 'slide' }, 10, 10, 100, 200).x).toBe(-120);
  expect(continuousMotion({ kind: 'shake' }, 0.5, 10, 100, 200)).toEqual(
    continuousMotion({ kind: 'shake' }, 0.5, 10, 100, 200),
  );
});
