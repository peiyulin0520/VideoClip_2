import type { Project } from '../model/types';
import { transitionPairs } from './transitions';
type Effect = NonNullable<Project['effects']>[number];
export const projectItemIds = (p: Project) =>
  new Set(
    p.tracks.flatMap((t) => [
      ...t.items.map((it) => it.id),
      ...(t.layout?.captionText ? [t.layout.captionText.id] : []),
      ...(t.layout?.frameItem ? [t.layout.frameItem.id] : []),
    ]),
  );
/** Old unbound screen effects belonged to the clip at their original application time. */
export function effectOwners(p: Project, fx: Effect): string[] {
  const explicit = [fx.ownerId, fx.targetId, fx.transitionFromId, fx.transitionToId].filter(
    (id): id is string => !!id,
  );
  if (explicit.length) return explicit;
  const pair = transitionPairs(p).find(
    (pair) => Math.abs(fx.start - Math.max(0, pair.to.start - 0.3)) < 0.06,
  );
  if (pair && ['flash', 'light-leak', 'fade-black', 'fade-white'].includes(fx.preset))
    return [pair.from.id, pair.to.id];
  const visual = p.tracks
    .filter((t) => !t.hidden)
    .flatMap((t) => t.items.filter((it) => it.type !== 'audio' && it.type !== 'text'));
  const main = p.tracks.find((t) => t.kind === 'main')?.items.filter((it) => it.type !== 'audio') ?? [];
  const at = (items: typeof main) =>
    items.find((it) => fx.start >= it.start && fx.start < it.start + it.duration);
  const owner =
    at(main) ??
    at(visual.slice().reverse()) ??
    visual.slice().sort((a, b) => Math.abs(a.start - fx.start) - Math.abs(b.start - fx.start))[0];
  return owner ? [owner.id] : [];
}
/** Run inside the same undo transaction, covering clip, group, lane and batch deletion. */
export function pruneRemovedEffects(next: Project, previous: Project) {
  const before = projectItemIds(previous),
    after = projectItemIds(next);
  const removed = new Set([...before].filter((id) => !after.has(id)));
  if (!removed.size) return;
  if (next.transitions)
    next.transitions = next.transitions.filter((tr) => !removed.has(tr.fromId) && !removed.has(tr.toId));
  if (next.effects)
    next.effects = next.effects.filter((fx) => !effectOwners(previous, fx).some((id) => removed.has(id)));
}
