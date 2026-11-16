import type { Project } from '../model/types';
import { templateLane } from './templateModel';
/** Reserve simultaneous decoders when the project changes, never one element per source file.
 * A held template cell needs one spare; unloaded reserves have no active codec or audio graph. */
export function decoderBudget(project: Project) {
  const events: { at: number; delta: number }[] = [];
  const add = (start: number, end: number, count = 1) => {
    if (end > start) {
      events.push({ at: start, delta: count }, { at: end, delta: -count });
    }
  };
  for (const track of project.tracks) {
    if (track.hidden) continue;
    const l = track.template ? track.layout : undefined;
    const videos = track.items.filter((it) => it.type === 'video' && !templateLane(track, it)?.hidden);
    for (const item of videos)
      add(
        Math.max(item.start, l?.start ?? 0),
        Math.min(item.start + item.duration, l ? l.start + l.duration : Infinity),
      );
    if (l?.version === 2 && l.gapMode === 'hold') {
      const cells = new Set(videos.flatMap((i) => (i.templateCell ? [i.templateCell] : [])));
      add(l.start, l.start + l.duration, cells.size);
    } else if (l?.playback === 'sequential') add(l.start, l.start + l.duration, videos.length);
  }
  let active = 0,
    peak = 0;
  for (const e of events.sort((a, b) => a.at - b.at || a.delta - b.delta)) {
    active += e.delta;
    peak = Math.max(peak, active);
  }
  return peak + 2;
}
