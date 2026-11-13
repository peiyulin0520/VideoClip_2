import { create } from 'zustand';
export const THEMES = {
  dark: '經典深色',
  mono: '黑白',
  light: '清爽白色',
  fresh: '清新薄荷',
  warm: '溫暖棕色',
  beige: '米色紙感',
};
export type Theme = keyof typeof THEMES;
export const THEME_SWATCHES: Record<Theme, [string, string]> = {
  dark: ['#19191f', '#ffffff'],
  mono: ['#111111', '#ffffff'],
  light: ['#fafaf8', '#252b2b'],
  fresh: ['#e2f0e7', '#2f715a'],
  warm: ['#e9d9c4', '#4d382a'],
  beige: ['#eae6db', '#292923'],
};
const KEY = 'lm2-preferences';
function initial(): { theme?: Theme; preview?: number } {
  try {
    return JSON.parse(localStorage.getItem(KEY) ?? '{}');
  } catch {
    return {};
  }
}
const saved = initial();
export const usePreferences = create<{
  theme: Theme;
  preview: number;
  set: (patch: Partial<{ theme: Theme; preview: number }>) => void;
}>((set, get) => ({
  theme: saved.theme && saved.theme in THEMES ? saved.theme : 'beige',
  preview: [720, 1080, 1920].includes(saved.preview ?? 0) ? saved.preview! : 1080,
  set: (patch) => {
    set(patch);
    const { theme, preview } = get();
    try {
      localStorage.setItem(KEY, JSON.stringify({ theme, preview }));
    } catch {
      /* unavailable */
    }
  },
}));
