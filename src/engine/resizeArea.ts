// Adapted from read-only VideoClip18d775f; opposite-edge anchored resize.
type Edge = 'l' | 'r' | 't' | 'b' | 'tl' | 'tr' | 'bl' | 'br';
const MIN = 0.1; // 框最小占畫面寬、高的比例
const MAX = 1.5;
const clamp = (n: number, lo: number, hi: number) => Math.min(Math.max(n, lo), hi);

type Draft = { id: string; x: number; y: number; w: number; h: number };

/** 拖把手／框的換算（純函式，有單元測試）：d＝開始時的草稿；dx、dy＝手指在專案像素的移動量；W、H＝畫面；sc、rot＝字卡的縮放與旋轉（弧度） */
export function dragArea(
  d: Draft,
  mode: Edge | 'move',
  dx: number,
  dy: number,
  W: number,
  H: number,
  sc: number,
  rot: number,
): Draft {
  if (mode === 'move') return { ...d, x: d.x + dx / W, y: d.y + dy / H };
  const cos = Math.cos(rot);
  const sin = Math.sin(rot);
  // 手指移動量轉到框自己的方向（框旋轉過）
  const lx = dx * cos + dy * sin;
  const ly = -dx * sin + dy * cos;
  const w0 = d.w * W * sc;
  const h0 = d.h * H * sc;
  let L = -w0 / 2;
  let R = w0 / 2;
  let T = -h0 / 2;
  let B = h0 / 2;
  if (mode.includes('l')) L += lx;
  if (mode.includes('r')) R += lx;
  if (mode.includes('t')) T += ly;
  if (mode.includes('b')) B += ly;
  const minW = MIN * W * sc;
  const minH = MIN * H * sc;
  const maxW = MAX * W * sc;
  const maxH = MAX * H * sc;
  // 太小：動到的那一邊停住（對邊不動）；太大一樣
  const left = mode.includes('l');
  const top = mode.includes('t');
  if (R - L < minW) {
    if (left) L = R - minW;
    else R = L + minW;
  }
  if (B - T < minH) {
    if (top) T = B - minH;
    else B = T + minH;
  }
  if (R - L > maxW) {
    if (left) L = R - maxW;
    else R = L + maxW;
  }
  if (B - T > maxH) {
    if (top) T = B - maxH;
    else B = T + maxH;
  }
  const cxl = (L + R) / 2;
  const cyl = (T + B) / 2;
  return {
    ...d,
    w: clamp((R - L) / sc / W, MIN, MAX),
    h: clamp((B - T) / sc / H, MIN, MAX),
    x: d.x + (cxl * cos - cyl * sin) / W,
    y: d.y + (cxl * sin + cyl * cos) / H,
  };
}
