// 動態字卡：把字卡（item.kinetic）在 t 秒（字卡自己的時間）畫成一張「框」大小的圖。框外面不畫（看不到）。
import { cssFamily, requestFont } from '../../fonts/fontStore';
import type { TextItem } from '../../model/types';
import { canvasFamily, renderText } from '../textRender';
import { fadeEdges, inkOn, splitWords, type KineticDef, type Stage } from './core';
import { kineticContent, kineticFrame } from './hit';
import { kineticById, resolveBg, schemeOf } from './index';

export type KineticRender = {
  canvas: HTMLCanvasElement;
  w: number;
  h: number;
  /** 內容有變就不一樣（compositor 用它判斷要不要重傳貼圖）；框圖固定在同一張畫布上重畫 */
  key: string;
  /** 點選、選取框用的範圍（像素，相對畫布左上角） */
  content: { x: number; y: number; w: number; h: number };
};

const STEP = 60; // 每秒 60 步：同一步畫面一樣

const canvases = new Map<string, HTMLCanvasElement>();
const painted = new WeakMap<HTMLCanvasElement, string>();
const MAX_CANVASES = 16;

/** 字卡裡的詞：照字卡文字拆；還沒輸入（或拆不出詞）就用那一式的範例字 */
export function kineticWords(item: TextItem, example: string[]): string[] {
  if (item.card.placeholder) return example;
  const text = item.card.runs.map((r) => r.text).join(' ');
  const w = splitWords(text);
  return w.length ? w : example;
}

/** t＝字卡自己的時間（開始後幾秒）；W、H＝合成畫布（畫面）大小。回傳 null＝這個 id 還沒改寫好（不畫） */
export function renderKinetic(item: TextItem, t: number, W: number, H: number): KineticRender | null {
  const k = item.kinetic;
  const def = k ? kineticById(k.id) : undefined;
  if (!k || !def) return null;
  const run = item.card.runs[0];
  const fontId = run?.fontId ?? '';
  requestFont(fontId);
  const words = kineticWords(item, def.words);
  const clock = kineticClock(t, k, def.len(words));
  const step = clock.held ? -1 : Math.floor(clock.time * STEP + 1e-6);
  const sch = schemeOf(def);
  const fg = run?.color ?? sch.fg;
  const hi = k.accent ?? sch.hi;
  const hifg = k.accent ? inkOn(k.accent) : sch.hifg;
  const bg = resolveBg(k.bg);
  const fade = k.fade ?? def.fade ?? 'none';
  const fr = kineticFrame(item, W, H);
  const key = [
    item.id,
    k.id,
    step,
    fr.w,
    fr.h,
    words.join('|'),
    k.subtitle ?? '',
    JSON.stringify(item.card),
    fg,
    hi,
    bg ?? '',
    fade,
    cssFamily(fontId) ? 1 : 0,
  ].join('~');

  const ck = `${item.id}|${fr.w}x${fr.h}`;
  let canvas = canvases.get(ck);
  if (!canvas) {
    canvas = document.createElement('canvas');
    canvas.width = fr.w;
    canvas.height = fr.h;
    canvases.set(ck, canvas);
    if (canvases.size > MAX_CANVASES) canvases.delete(canvases.keys().next().value!);
  }
  if (painted.get(canvas) === key)
    return { canvas, w: fr.w, h: fr.h, key, content: kineticContent(item, W, H) };
  if (clock.held) {
    paintComplete(canvas, item, def, bg);
  } else
    paintKinetic(
      canvas,
      def,
      { words, fg, paper: sch.bg, hi, hifg, bg, family: canvasFamily(fontId), subtitle: k.subtitle },
      step / STEP,
      fade,
    );
  if (!clock.held && k.subtitle && !['crawl', 'swapline'].includes(k.id)) {
    const g = canvas.getContext('2d')!;
    g.save();
    g.font = `${Math.max(10, Math.min(fr.w, fr.h) * 0.06)}px ${canvasFamily(fontId)}`;
    g.fillStyle = fg;
    g.textAlign = 'center';
    g.textBaseline = 'bottom';
    g.fillText(k.subtitle, fr.w / 2, fr.h * 0.96, fr.w * 0.9);
    g.restore();
  }
  painted.set(canvas, key);
  return { canvas, w: fr.w, h: fr.h, key, content: kineticContent(item, W, H) };
}

/** 把某一式在 t 秒畫到 canvas 上（整張清掉重畫；單位＝這張畫布的大小）。卡片縮圖、字卡的框共用 */
export function paintKinetic(
  canvas: HTMLCanvasElement,
  def: KineticDef,
  p: Pick<Stage, 'words' | 'fg' | 'paper' | 'hi' | 'hifg' | 'bg' | 'family' | 'subtitle'>,
  t: number,
  fade: 'none' | 'v' | 'h' = 'none',
) {
  const W = canvas.width;
  const H = canvas.height;
  const g = canvas.getContext('2d')!;
  g.setTransform(1, 0, 0, 1, 0, 0);
  g.clearRect(0, 0, W, H);
  g.globalAlpha = 1;
  if (p.bg) {
    g.fillStyle = p.bg;
    g.fillRect(0, 0, W, H);
  }
  g.save();
  def.draw({ g, W, H, cqmin: Math.min(W, H) / 100, cqw: W / 100, cqh: H / 100, ...p }, t);
  g.restore();
  fadeEdges(g, W, H, fade);
}

/** Hold switches before the reference's fade-out, keeping all source text readable indefinitely. */
export function kineticClock(t: number, k: NonNullable<TextItem['kinetic']>, natural: number | null) {
  const cycle = Math.max(0.4, k.duration ?? natural ?? 4),
    elapsed = Math.max(0, t) * (k.speed ?? 1);
  const held = k.playback !== 'loop' && elapsed >= Math.max(0.2, Math.min(cycle * 0.8, cycle - 0.3));
  return { held, time: held ? 0 : ((elapsed % cycle) * (natural ?? cycle)) / cycle };
}
function paintComplete(canvas: HTMLCanvasElement, item: TextItem, def: KineticDef, bg: string | null) {
  const g = canvas.getContext('2d')!;
  g.setTransform(1, 0, 0, 1, 0, 0);
  g.clearRect(0, 0, canvas.width, canvas.height);
  if (bg) {
    g.fillStyle = bg;
    g.fillRect(0, 0, canvas.width, canvas.height);
  }
  const card = {
    ...item.card,
    width: 970,
    runs: item.card.runs.map((r, i) => ({
      ...r,
      text: i === 0 && item.card.placeholder ? def.words.join(' ') : r.text,
    })),
  };
  const rendered = renderText(card, Math.min(canvas.width / 1080, canvas.height / 540), 1);
  const scale = Math.min(1, (canvas.width * 0.9) / rendered.w, (canvas.height * 0.78) / rendered.h);
  g.drawImage(
    rendered.canvas,
    (canvas.width - rendered.w * scale) / 2,
    (canvas.height - rendered.h * scale) / 2,
    rendered.w * scale,
    rendered.h * scale,
  );
  const subtitle = item.kinetic?.subtitle;
  if (subtitle) {
    g.font = `${Math.max(10, Math.min(canvas.width, canvas.height) * 0.065)}px ${canvasFamily(item.card.runs[0]?.fontId ?? 'system')}`;
    g.fillStyle = item.card.runs[0]?.color ?? '#fff';
    g.textAlign = 'center';
    g.textBaseline = 'bottom';
    g.fillText(subtitle, canvas.width / 2, canvas.height * 0.95, canvas.width * 0.9);
  }
}
