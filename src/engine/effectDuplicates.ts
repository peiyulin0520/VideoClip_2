import type { Project } from '../model/types';
const overlayPresets = new Set(['flash', 'light-leak', 'fade-black', 'fade-white']);
export function uniqueEffects(effects: NonNullable<Project['effects']>) {
  const seen = new Set<string>();
  return effects.filter((effect) => {
    if (!overlayPresets.has(effect.preset)) return true;
    const key = JSON.stringify([
      effect.preset,
      effect.transitionFromId ?? effect.start,
      effect.transitionToId ?? effect.targetId,
    ]);
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}
/** Old repeated taps may already have saved identical transitions. Keep the first instance. */
export function withoutDuplicateEffects(project: Project): Project {
  const seen = new Set<string>();
  return {
    ...project,
    ...(project.effects ? { effects: uniqueEffects(project.effects) } : {}),
    ...(project.transitions
      ? {
          transitions: project.transitions.filter((tr) => {
            const key = JSON.stringify([tr.fromId, tr.toId, tr.preset]);
            if (seen.has(key)) return false;
            seen.add(key);
            return true;
          }),
        }
      : {}),
  };
}
