import { afterEach, expect, it, vi } from 'vitest';
import { videoEffectOverlay } from './videoEffects';
import type { Project } from '../model/types';
afterEach(() => vi.restoreAllMocks());
it('particle animation reuses its canvas across frames but does not share mutable canvases across effects', () => {
  vi.spyOn(HTMLCanvasElement.prototype, 'getContext').mockReturnValue({
    clearRect: vi.fn(),
    fillRect: vi.fn(),
  } as never);
  const e = { id: 'canvas-reuse', preset: 'grain', start: 0, duration: 30, strength: 1 } as NonNullable<
    Project['effects']
  >[number];
  const first = videoEffectOverlay(e, 0, 320, 568, 'project-one')!;
  for (let i = 1; i < 120; i++)
    expect(videoEffectOverlay(e, i / 12, 320, 568, 'project-one')!.source).toBe(first.source);
  const other = videoEffectOverlay({ ...e, id: 'other' }, 1, 320, 568, 'project-two')!;
  expect(other.source).not.toBe(first.source);
  expect(videoEffectOverlay(e, 2, 320, 568, 'project-one')!.sourceStamp).toBe(24);
});
