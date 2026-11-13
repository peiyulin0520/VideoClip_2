import type { Project } from '../model/types';
import { TRANSITIONS, VIDEO_EFFECTS } from './effectCatalog';
import { EFFECTS } from './sceneEffects';
import { animationRanges } from './animationTiming';
import { transitionPairs } from './transitions';
export type TimelineEffectBadge = {
  id: string;
  trackId: string;
  itemId: string;
  time: number;
  kind: 'single' | 'pair' | 'screen';
  names: string[];
  symbols: string[];
  edge?: 'enter' | 'exit';
  toId?: string;
  effectId?: string;
};
const symbols: Record<string, string> = {
  crossfade: '淡',
  flash: '閃',
  'fade-black': '黑',
  'fade-white': '白',
  'light-leak': '光',
  grid4: '四',
  grid9: '九',
  'zoom-in': '縮',
  'zoom-out': '縮',
  spin: '轉',
  'page-turn': '頁',
  blur: '糊',
  glitch: '障',
  'film-up': '膠',
  'film-left': '膠',
  projector: '映',
  circle: '圓',
  shake: '震',
  pulse: '縮',
  'soft-blur': '柔',
  mono: '黑',
  'warm-tone': '暖',
  'cool-tone': '冷',
  grain: '粒',
  'glitch-video': '擾',
  'rgb-split': '散',
  vignette: '暗',
  snow: '雪',
  sparkle: '星',
};
export function effectSymbol(preset: string) {
  return (
    symbols[preset] ??
    (preset.startsWith('push-')
      ? '推'
      : preset.startsWith('slide-')
        ? '滑'
        : preset.startsWith('wipe-')
          ? '擦'
          : preset.startsWith('split-')
            ? '分'
            : '效')
  );
}
const name = (preset: string) =>
  [...TRANSITIONS, ...VIDEO_EFFECTS, ...EFFECTS].find((e) => e.id === preset)?.label ?? '特效';
/** Positions are true timeline times; grouping does not shift anchors to make room for badges. */
export function timelineEffectBadges(project: Project): TimelineEffectBadge[] {
  const out: TimelineEffectBadge[] = [];
  const add = (badge: Omit<TimelineEffectBadge, 'names' | 'symbols'>, preset: string) => {
    const existing = out.find((x) => x.id === badge.id);
    if (existing) {
      existing.names.push(name(preset));
      existing.symbols.push(effectSymbol(preset));
    } else out.push({ ...badge, names: [name(preset)], symbols: [effectSymbol(preset)] });
  };
  for (const pair of transitionPairs(project)) {
    for (const tr of project.transitions ?? [])
      if (tr.fromId === pair.from.id && tr.toId === pair.to.id && tr.ranges?.length !== 0)
        add(
          {
            id: `pair:${pair.from.id}`,
            trackId: pair.track.id,
            itemId: pair.from.id,
            toId: pair.to.id,
            time: pair.to.start,
            kind: 'pair',
          },
          tr.preset,
        );
    for (const fx of project.effects ?? [])
      if (fx.transitionFromId === pair.from.id && fx.transitionToId === pair.to.id && fx.ranges?.length !== 0)
        add(
          {
            id: `pair:${pair.from.id}`,
            trackId: pair.track.id,
            itemId: pair.from.id,
            toId: pair.to.id,
            time: pair.to.start,
            kind: 'pair',
          },
          fx.preset,
        );
  }
  for (const track of project.tracks) {
    const targets =
      track.template && track.layout
        ? [{ ...track.layout, id: track.items[0]?.id }]
        : track.items.filter((it) => it.type !== 'audio');
    for (const target of targets)
      if (target.id)
        for (const edge of ['enter', 'exit'] as const) {
          const animation = target.animations?.[edge];
          if (animation)
            for (const [at] of animationRanges(animation, edge, target.duration))
              add(
                {
                  id: `single:${target.id}:${edge}`,
                  trackId: track.id,
                  itemId: target.id,
                  time: target.start + at,
                  kind: 'single',
                  edge,
                },
                animation.preset,
              );
        }
  }
  for (const fx of project.effects ?? []) {
    if (fx.transitionFromId) continue;
    for (const [time] of fx.ranges ?? [[fx.start, fx.start + fx.duration]]) {
      const track =
        project.tracks.find((tr) => tr.items.some((it) => it.id === fx.targetId)) ??
        project.tracks.find((tr) => tr.kind === 'main') ??
        project.tracks.find((tr) => tr.items.some((it) => it.type !== 'audio'));
      const item =
        track?.items.find((it) => it.id === fx.targetId) ??
        track?.items.find((it) => it.type !== 'audio' && time >= it.start && time < it.start + it.duration);
      if (track && item)
        add(
          {
            id: `screen:${fx.id}:${time}`,
            trackId: track.id,
            itemId: item.id,
            time,
            kind: fx.targetId ? 'single' : 'screen',
            effectId: fx.id,
          },
          fx.preset,
        );
    }
  }
  return out.sort((a, b) => a.time - b.time);
}

/** Same-time badges share one hit target; neither scope hides the other at a join. */
export function groupTimelineEffectBadges(badges: TimelineEffectBadge[], combineTracks = false) {
  const groups: TimelineEffectBadge[][] = [];
  for (const badge of badges) {
    const found = groups.find(
      (group) =>
        (combineTracks || group[0]!.trackId === badge.trackId) &&
        Math.abs(group[0]!.time - badge.time) < 0.005,
    );
    if (found) found.push(badge);
    else groups.push([badge]);
  }
  return groups;
}
