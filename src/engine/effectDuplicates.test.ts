import { describe, it, expect } from 'vitest';
import { createProject } from '../model/defaults';
import { uniqueEffects, withoutDuplicateEffects } from './effectDuplicates';
describe('one effect per join', () => {
  it('removes old repeated presets at the same join while preserving mixed effects and other joins', () => {
    const p = createProject('x');
    const a = { id: 'one', preset: 'crossfade' as const, fromId: 'a', toId: 'b', duration: 0.6 };
    p.transitions = [
      a,
      { ...a, id: 'duplicate' },
      { ...a, id: 'mix', preset: 'push-left' },
      { ...a, id: 'other', fromId: 'b', toId: 'c' },
    ];
    const normalized = withoutDuplicateEffects(p);
    expect(normalized.transitions!.map((t) => t.id)).toEqual(['one', 'mix', 'other']);
    expect(p.transitions).toHaveLength(4);
  });
  it('collapses linked overlays independently for each join and keeps the first saved duration', () => {
    const a = {
      id: 'one',
      preset: 'flash' as const,
      start: 2.7,
      duration: 0.6,
      strength: 1,
      transitionFromId: 'a',
      transitionToId: 'b',
    };
    expect(
      uniqueEffects([
        a,
        { ...a, id: 'two', start: 2.6 },
        { ...a, id: 'mix', preset: 'light-leak' },
        { ...a, id: 'other', transitionFromId: 'b', transitionToId: 'c' },
      ]).map((e) => e.id),
    ).toEqual(['one', 'mix', 'other']);
  });
  it('does not remove video effects or overlay events at different seconds', () => {
    const a = { id: 'one', preset: 'flash' as const, start: 2, duration: 0.6, strength: 1 };
    expect(
      uniqueEffects([
        a,
        { ...a, id: 'two', start: 4 },
        { ...a, id: 'v1', preset: 'mono' },
        { ...a, id: 'v2', preset: 'mono' },
      ]),
    ).toHaveLength(4);
  });
});
