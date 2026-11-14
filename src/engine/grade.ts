import type { ColorAdjustment } from '../model/types';

export const DEFAULT_ADJUSTMENT: Required<ColorAdjustment> = {
  brightness: 1,
  saturation: 1,
  temperature: 0,
  tint: '#ffffff',
  exposure: 0,
  contrast: 1,
  highlights: 0,
  shadows: 0,
  blacks: 0,
  vibrance: 0,
  fade: 0,
};
export const TONE_KEYS = [
  'brightness',
  'saturation',
  'temperature',
  'exposure',
  'contrast',
  'highlights',
  'shadows',
  'blacks',
  'vibrance',
  'fade',
] as const;
export type ToneKey = (typeof TONE_KEYS)[number];
export function resolveAdjustment(value?: ColorAdjustment): Required<ColorAdjustment> {
  const result = { ...DEFAULT_ADJUSTMENT, ...value };
  for (const key of TONE_KEYS) if (!Number.isFinite(result[key])) result[key] = DEFAULT_ADJUSTMENT[key];
  return result;
}
export function hasGrade(value?: ColorAdjustment) {
  return (
    !!value && TONE_KEYS.some((key) => (value[key] ?? DEFAULT_ADJUSTMENT[key]) !== DEFAULT_ADJUSTMENT[key])
  );
}
export const gradeKey = (value: ColorAdjustment) =>
  TONE_KEYS.map((k) => value[k] ?? DEFAULT_ADJUSTMENT[k]).join('|');
export type TonePreset = { id: string; name: string; values: Required<ColorAdjustment> };
const preset = (id: string, name: string, patch: Partial<ColorAdjustment> = {}): TonePreset => ({
  id,
  name,
  values: { ...DEFAULT_ADJUSTMENT, ...patch },
});
export const TONE_PRESETS: TonePreset[] = [
  preset('original', '原色'),
  preset('mono', '黑白片', { saturation: 0, contrast: 1.08 }),
  preset('retro', '復古風', {
    brightness: 1.02,
    contrast: 0.88,
    saturation: 0.72,
    temperature: 0.42,
    highlights: -0.18,
    shadows: 0.08,
    blacks: -0.12,
    fade: 0.18,
  }),
  preset('fresh', '清新風', {
    brightness: 1.04,
    exposure: 0.1,
    contrast: 0.95,
    saturation: 1.06,
    temperature: -0.08,
    highlights: -0.1,
    shadows: 0.12,
    vibrance: 0.18,
    fade: 0.03,
  }),
  preset('cool', '冷色調', { temperature: -0.65, contrast: 1.04, saturation: 0.94, shadows: 0.05 }),
  preset('warm', '暖色調', { temperature: 0.65, brightness: 1.02, saturation: 1.04, highlights: -0.08 }),
  preset('vivid', '鮮豔', { contrast: 1.08, saturation: 1.18, vibrance: 0.35, blacks: 0.08 }),
  preset('cinema', '電影風', {
    contrast: 1.2,
    saturation: 0.82,
    temperature: -0.18,
    highlights: -0.2,
    shadows: 0.05,
    blacks: 0.18,
    fade: 0.04,
  }),
  preset('cream', '奶油', {
    brightness: 1.04,
    contrast: 0.88,
    saturation: 0.86,
    temperature: 0.2,
    highlights: -0.18,
    shadows: 0.12,
    fade: 0.12,
  }),
  preset('japan', '日系', {
    exposure: 0.12,
    contrast: 0.9,
    saturation: 0.88,
    temperature: 0.12,
    highlights: -0.12,
    shadows: 0.18,
    fade: 0.08,
  }),
  preset('forest', '森林', {
    contrast: 1.1,
    saturation: 0.9,
    temperature: -0.24,
    highlights: -0.22,
    blacks: 0.12,
    vibrance: 0.12,
  }),
  preset('sunset', '夕陽', {
    temperature: 0.85,
    contrast: 1.08,
    saturation: 1.08,
    highlights: -0.12,
    shadows: 0.05,
    vibrance: 0.18,
  }),
  preset('mono-contrast', '高對比黑白', { saturation: 0, contrast: 1.4, blacks: 0.18, highlights: -0.08 }),
];
const smooth = (a: number, b: number, x: number) => {
  const t = Math.min(1, Math.max(0, (x - a) / (b - a)));
  return t * t * (3 - 2 * t);
};
/** Static preset swatches and a reference for pixel validation; never runs over movie frames. */
export function gradeRGB(rgb: readonly number[], input: ColorAdjustment): [number, number, number] {
  const p = resolveAdjustment(input),
    gain = p.brightness * 2 ** p.exposure;
  let c = rgb.map((v) => (v * gain - 0.5) * p.contrast + 0.5);
  const lum = c[0]! * 0.2126 + c[1]! * 0.7152 + c[2]! * 0.0722;
  const tonal =
    p.highlights * 0.35 * smooth(0.4, 1, lum) +
    p.shadows * 0.25 * (1 - smooth(0, 0.6, lum)) -
    p.blacks * 0.35 * (1 - smooth(0, 0.55, lum));
  c = c.map((v) => v + tonal);
  c = c.map((v) => v * (1 - p.fade * 0.16) + p.fade * 0.16);
  const luma = c[0]! * 0.2126 + c[1]! * 0.7152 + c[2]! * 0.0722;
  const chroma = Math.min(1, Math.max(0, Math.max(...c) - Math.min(...c)));
  const sat = Math.max(0, p.saturation * (1 + p.vibrance * (1 - chroma)));
  const temp = p.temperature * 0.18;
  return c.map((v, i) =>
    Math.min(1, Math.max(0, (luma + (v - luma) * sat) * [1 + temp, 1, 1 - temp][i]!)),
  ) as [number, number, number];
}
