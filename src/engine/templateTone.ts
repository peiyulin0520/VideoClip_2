import type { ColorAdjustment } from '../model/types';
import { resolveAdjustment, TONE_KEYS, DEFAULT_ADJUSTMENT } from './grade';
/** One shader pass combines the neutral-relative group and member adjustments. */
export function composeAdjustment(
  member: ColorAdjustment | undefined,
  group: ColorAdjustment,
): Required<ColorAdjustment> {
  const a = resolveAdjustment(member),
    b = resolveAdjustment(group),
    result = { ...a };
  for (const key of TONE_KEYS)
    result[key] = DEFAULT_ADJUSTMENT[key] === 1 ? a[key] * b[key] : a[key] + b[key];
  result.tint =
    '#' +
    [1, 3, 5]
      .map((i) =>
        Math.round((parseInt(a.tint.slice(i, i + 2), 16) * parseInt(b.tint.slice(i, i + 2), 16)) / 255)
          .toString(16)
          .padStart(2, '0'),
      )
      .join('');
  return result;
}
