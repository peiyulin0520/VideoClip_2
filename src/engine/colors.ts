export function hexRgb(hex: string): [number, number, number] {
  const s = /^#[\da-f]{6}$/i.test(hex) ? hex.slice(1) : 'ffffff';
  return [0, 2, 4].map((i) => parseInt(s.slice(i, i + 2), 16)) as [number, number, number];
}
export function rgbHex(rgb: number[]) {
  return (
    '#' +
    rgb
      .map((v) =>
        Math.round(Math.max(0, Math.min(255, v)))
          .toString(16)
          .padStart(2, '0'),
      )
      .join('')
  );
}
export function rgbHsv(rgb: number[]) {
  const [r, g, b] = rgb.map((v) => v / 255) as [number, number, number];
  const max = Math.max(r, g, b),
    min = Math.min(r, g, b),
    d = max - min;
  const h = !d ? 0 : max === r ? ((g - b) / d + 6) % 6 : max === g ? (b - r) / d + 2 : (r - g) / d + 4;
  return { h: h * 60, s: max ? d / max : 0, v: max };
}
export function hsvHex(h: number, s: number, v: number) {
  const f = (n: number) => {
    const k = (n + h / 60) % 6;
    return 255 * (v - v * s * Math.max(0, Math.min(k, 4 - k, 1)));
  };
  return rgbHex([f(5), f(3), f(1)]);
}

/** Readable companion colour for user-created solid backgrounds. */
export function contrastText(hex: string) {
  const l = hexRgb(hex).reduce((sum, v, i) => {
    const c = v / 255;
    return sum + [0.2126, 0.7152, 0.0722][i]! * (c <= 0.04045 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4);
  }, 0);
  return l > 0.179 ? '#111111' : '#ffffff';
}
