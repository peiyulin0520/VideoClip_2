import type { Keyframe, ResolvedAnimatedValues } from '../model/types';
export const LOCAL_MOTIONS = [
  { kind: 'shake', name: '震一下', badge: '震' },
  { kind: 'pop', name: '彈一下', badge: '彈' },
  { kind: 'sway', name: '晃一下', badge: '晃' },
  { kind: 'jump', name: '跳一下', badge: '跳' },
] as const;
/** Analytic transforms only: shared by preview/export, zero textures/filters/decoders. */
export function applyKeyframeMotion(
  values: ResolvedAnimatedValues,
  frames: Keyframe[] | undefined,
  time: number,
): ResolvedAnimatedValues {
  let result = values;
  for (const frame of frames ?? []) {
    const motion = frame.motion;
    if (!motion) continue;
    const local = time - frame.time + (motion.elapsed ?? 0),
      p = local / Math.max(0.01, motion.duration);
    if (p <= 0 || p >= 1) continue;
    if (result === values) result = { ...values };
    const envelope = Math.sin(Math.PI * p),
      strength = Math.max(0, Math.min(3, motion.strength));
    switch (motion.kind) {
      case 'shake':
        result.x += Math.sin(p * Math.PI * 12) * envelope * 0.025 * strength;
        break;
      case 'pop':
        result.scale *= 1 + Math.sin(p * Math.PI * 3) * envelope * 0.15 * strength;
        break;
      case 'sway':
        result.x += Math.sin(p * Math.PI * 4) * envelope * 0.025 * strength;
        result.rotation += Math.sin(p * Math.PI * 4) * envelope * 7 * strength;
        break;
      case 'jump':
        result.y -= envelope * 0.07 * strength;
        break;
    }
  }
  return result;
}
