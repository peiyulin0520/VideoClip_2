import { maskContains } from './mediaMask';
import type { Asset, BlendMode, Crop, Item, TextItem } from '../model/types';
import type { Layer } from './timeline';

/** 畫面（canvas）像素座標下的物件方框；rotation 單位是度，順時針，繞中心 */
export type Box = { cx: number; cy: number; w: number; h: number; rotation: number };
export type TextSize = (item: TextItem, canvasW: number, canvasH: number) => { w: number; h: number };
export type GeoCtx = {
  canvasW: number;
  canvasH: number;
  assets: Asset[];
  textSize: TextSize;
  layoutMotion?: { x: number; y: number };
  motions?: Record<string, { x: number; y: number }>;
  templates?: ReturnType<typeof import('./templateGeometry').templateContexts>;
};

// 平台按鈕安全區：直式畫面底部約 250/1920、右側約 150/1080（見 docs 的字卡規則）
export const SAFE_BOTTOM = 250 / 1920;
export const SAFE_RIGHT = 150 / 1080;

export function fittedSize(
  srcW: number,
  srcH: number,
  cw: number,
  ch: number,
  fit: 'cover' | 'contain',
): { w: number; h: number } {
  if (srcW <= 0 || srcH <= 0) return { w: cw, h: ch };
  const k = fit === 'cover' ? Math.max(cw / srcW, ch / srcH) : Math.min(cw / srcW, ch / srcH);
  return { w: srcW * k, h: srcH * k };
}

export function croppedSource(asset: Asset, crop?: Crop): { w: number; h: number } {
  const c = crop ?? { l: 0, t: 0, r: 0, b: 0 };
  return {
    w: Math.max(asset.width * (1 - c.l - c.r), 1),
    h: Math.max(asset.height * (1 - c.t - c.b), 1),
  };
}

export function itemBox(item: Item, ctx: GeoCtx): Box | null {
  if (item.type === 'audio') return null;
  const { canvasW: cw, canvasH: ch } = ctx;
  const cell = ctx.templates?.[item.id];
  if (cell && item.type !== 'text') {
    const slot = cell.slot;
    if (!slot) return null;
    const a = ctx.assets.find((a) => a.id === item.assetId);
    if (!a) return null;
    const source = croppedSource(a, item.crop),
      size = fittedSize(source.w, source.h, slot.w * cw, slot.h * ch, item.fit);
    return {
      cx: (slot.x + slot.w / 2) * cw,
      cy: (slot.y + slot.h / 2) * ch,
      w: size.w,
      h: size.h,
      rotation: 0,
    };
  }
  const { x, y, scale, rotation } = item.transform;
  const motion = ctx.motions?.[item.id] ?? ctx.layoutMotion;
  let w: number;
  let h: number;
  if (item.type === 'text') {
    const s = ctx.textSize(item, cw, ch);
    w = s.w;
    h = s.h;
  } else {
    const asset = ctx.assets.find((a) => a.id === item.assetId);
    if (!asset) return null;
    const src = croppedSource(asset, item.crop);
    ({ w, h } = fittedSize(src.w, src.h, cw * (item.slot?.w ?? 1), ch * (item.slot?.h ?? 1), item.fit));
  }
  return {
    cx: (x + (item.type !== 'text' && item.slot ? (motion?.x ?? 0) : 0)) * cw,
    cy: (y + (item.type !== 'text' && item.slot ? (motion?.y ?? 0) : 0)) * ch,
    w: w * scale,
    h: h * scale,
    rotation,
  };
}

/** 把畫面座標的點轉到方框自己的座標（原點在中心、沒有旋轉） */
export function toLocal(box: Box, px: number, py: number): { x: number; y: number } {
  const a = (-box.rotation * Math.PI) / 180;
  const dx = px - box.cx;
  const dy = py - box.cy;
  return { x: dx * Math.cos(a) - dy * Math.sin(a), y: dx * Math.sin(a) + dy * Math.cos(a) };
}

export function pointInBox(box: Box, px: number, py: number): boolean {
  const p = toLocal(box, px, py);
  return Math.abs(p.x) <= box.w / 2 && Math.abs(p.y) <= box.h / 2;
}

export function boxCorners(box: Box): [number, number][] {
  const a = (box.rotation * Math.PI) / 180;
  const c = Math.cos(a);
  const s = Math.sin(a);
  return (
    [
      [-box.w / 2, -box.h / 2],
      [box.w / 2, -box.h / 2],
      [box.w / 2, box.h / 2],
      [-box.w / 2, box.h / 2],
    ] as [number, number][]
  ).map(([x, y]) => [box.cx + x * c - y * s, box.cy + x * s + y * c]);
}

export function aabb(box: Box): { l: number; t: number; r: number; b: number } {
  const pts = boxCorners(box);
  const xs = pts.map((p) => p[0]);
  const ys = pts.map((p) => p[1]);
  return { l: Math.min(...xs), r: Math.max(...xs), t: Math.min(...ys), b: Math.max(...ys) };
}

/** 點在哪個圖層上（最上面的優先）。鎖定的軌道、隱藏的軌道不會被選到。 */
export function hitLayers(layers: Layer[], ctx: GeoCtx, px: number, py: number): Layer[] {
  const hits: Layer[] = [];
  for (let i = layers.length - 1; i >= 0; i--) {
    const l = layers[i]!;
    if (l.track.locked || l.item.transform.opacity <= 0.01) continue;
    const cell = ctx.templates?.[l.item.id];
    if (cell?.anchor && pointInBox(cell.frame, px, py)) {
      hits.push(l);
      continue;
    }
    if (cell && !cell.slot) continue;
    if (l.item.type !== 'text' && l.item.slot) {
      const source = cell?.slot ?? l.item.slot;
      const motion = ctx.motions?.[l.item.id] ?? ctx.layoutMotion;
      const s = {
        ...source,
        x: source.x + (cell ? 0 : (motion?.x ?? 0)),
        y: source.y + (cell ? 0 : (motion?.y ?? 0)),
      };
      if (
        px < s.x * ctx.canvasW ||
        px > (s.x + s.w) * ctx.canvasW ||
        py < s.y * ctx.canvasH ||
        py > (s.y + s.h) * ctx.canvasH
      )
        continue;
    }
    const box = itemBox(l.item, ctx);
    if (!box || !pointInBox(box, px, py)) continue;
    if (l.item.type !== 'text' && l.item.mask) {
      const local = toLocal(box, px, py);
      const crop = l.item.crop ?? { l: 0, t: 0, r: 0, b: 0 };
      const x = crop.l + (local.x / box.w + 0.5) * (1 - crop.l - crop.r);
      const y = crop.t + (local.y / box.h + 0.5) * (1 - crop.t - crop.b);
      const assetId = l.item.assetId;
      const asset = ctx.assets.find((a) => a.id === assetId);
      if (!maskContains(l.item.mask, x, y, asset ? asset.width / asset.height : 1)) continue;
    }
    hits.push(l);
  }
  return hits;
}

export function topHit(layers: Layer[], ctx: GeoCtx, px: number, py: number): Layer | null {
  return hitLayers(layers, ctx, px, py)[0] ?? null;
}

export const BLEND_LABELS: Record<BlendMode, string> = {
  normal: '正常',
  multiply: '色彩加深',
  screen: '濾色',
  overlay: '覆蓋',
  add: '加亮',
};

// ---------- 吸附 ----------

export type Snap = { dx: number; dy: number; guideX: number | null; guideY: number | null };

/**
 * 移動時吸附：方框的中心線、左右/上下邊緣，靠近畫面中心線、畫面邊緣、平台安全區邊界時吸過去。
 * threshold 單位是畫面像素。
 */
export function snapMove(box: Box, cw: number, ch: number, threshold: number, safeZone = true): Snap {
  const r = aabb(box);
  const xTargets = [0, cw / 2, cw, ...(safeZone ? [cw * (1 - SAFE_RIGHT)] : [])];
  const yTargets = [0, ch / 2, ch, ...(safeZone ? [ch * (1 - SAFE_BOTTOM)] : [])];
  const pick = (own: number[], targets: number[]) => {
    let best: { d: number; guide: number } | null = null;
    for (const o of own)
      for (const t of targets) {
        const d = t - o;
        if (Math.abs(d) <= threshold && (!best || Math.abs(d) < Math.abs(best.d))) best = { d, guide: t };
      }
    return best;
  };
  const sx = pick([r.l, box.cx, r.r], xTargets);
  const sy = pick([r.t, box.cy, r.b], yTargets);
  return { dx: sx?.d ?? 0, dy: sy?.d ?? 0, guideX: sx?.guide ?? null, guideY: sy?.guide ?? null };
}

/** 旋轉時靠近 45 度的倍數就吸過去 */
export function snapRotation(deg: number, threshold = 4): number {
  const n = Math.round(deg / 45) * 45;
  return Math.abs(deg - n) <= threshold ? n : deg;
}
