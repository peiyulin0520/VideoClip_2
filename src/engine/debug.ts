import { getProject } from '../storage/projects';
import { useProjectStore } from '../store/projectStore';
import { urlFor } from './assetUrls';
import { ensureFont } from '../fonts/fontStore';
import type { TextCard } from '../model/types';
import { renderFrame } from './exportFrame';
import { renderText } from './textRender';
import { ALL_FORMATS, AudioBufferSink, BlobSource, CanvasSink, Input } from 'mediabunny';
import type { Player } from './player';

/** 測試/除錯用：localStorage 的 lm2-debug 設成 1 才會掛出 window.__videoclip。正常使用者看不到。 */
export function installDebugHook(player: Player) {
  const on = (() => {
    try {
      return localStorage.getItem('lm2-debug') === '1';
    } catch {
      return false;
    }
  })();
  if (!on) return;
  const hook = {
    project: () => JSON.parse(JSON.stringify(useProjectStore.getState().project)),
    savedProject: () => getProject(useProjectStore.getState().project!.id),
    time: () => player.time,
    selected: () => useProjectStore.getState().selectedId,
    audioEnergy: () => player.audioEnergy(),
    mediaStats: () => player.compositor.mediaStats(),
    async inspectMovie(url: string, t: number, points: [number, number][] = []) {
      if (!url.startsWith('blob:')) throw Error('Only local exported movies');
      const blob = await (await fetch(url)).blob();
      const input = new Input({ source: new BlobSource(blob), formats: ALL_FORMATS });
      try {
        const duration = await input.computeDuration(),
          video = await input.getPrimaryVideoTrack(),
          audio = await input.getPrimaryAudioTrack();
        const frame = video ? await new CanvasSink(video).getCanvas(t) : null;
        const canvas = document.createElement('canvas');
        canvas.width = frame?.canvas.width ?? 1;
        canvas.height = frame?.canvas.height ?? 1;
        const ctx = canvas.getContext('2d')!;
        if (frame) ctx.drawImage(frame.canvas, 0, 0);
        let rms = 0;
        if (audio && (await audio.canDecode()))
          for await (const chunk of new AudioBufferSink(audio).buffers(
            Math.max(0, t),
            Math.min(duration, t + 0.2),
          )) {
            const data = chunk.buffer.getChannelData(0);
            rms = Math.max(rms, Math.sqrt(data.reduce((n, v) => n + v * v, 0) / data.length));
          }
        const pixels = ctx.getImageData(0, 0, canvas.width, canvas.height).data;
        let whitePixels = 0;
        for (let i = 0; i < pixels.length; i += 4)
          if (pixels[i]! > 230 && pixels[i + 1]! > 230 && pixels[i + 2]! > 230) whitePixels++;
        return {
          whitePixels,
          duration,
          width: video?.displayWidth ?? 0,
          height: video?.displayHeight ?? 0,
          audio: !!audio,
          rms,
          bytes: blob.size,
          samples: points.map(([x, y]) =>
            Array.from(
              ctx.getImageData(Math.floor(x * canvas.width), Math.floor(y * canvas.height), 1, 1).data,
            ),
          ),
        };
      } finally {
        input.dispose();
      }
    },
    /** 預覽畫面某區塊（0–1 比例）裡，和 rgb 差不多（每個色版差 tol 以內）的像素有幾個 */
    countColor(
      rgb: [number, number, number],
      tol: number,
      nx0: number,
      ny0: number,
      nx1: number,
      ny1: number,
    ) {
      const c = player.compositor;
      const px = c.readRegion(nx0 * c.width, ny0 * c.height, (nx1 - nx0) * c.width, (ny1 - ny0) * c.height);
      let n = 0;
      for (let i = 0; i < px.length; i += 4)
        if (
          Math.abs(px[i]! - rgb[0]) <= tol &&
          Math.abs(px[i + 1]! - rgb[1]) <= tol &&
          Math.abs(px[i + 2]! - rgb[2]) <= tol
        )
          n++;
      return n;
    },
    /** 預覽畫面上某一點的顏色，座標用 0–1 的比例 */
    samplePreview(nx: number, ny: number) {
      const c = player.compositor;
      return c.samplePixel(nx * c.width, ny * c.height);
    },
    /** 預覽畫面某區塊的內容雜湊：畫面有沒有變，不需要知道顏色 */
    regionHash(nx0: number, ny0: number, nx1: number, ny1: number) {
      const c = player.compositor;
      const px = c.readRegion(nx0 * c.width, ny0 * c.height, (nx1 - nx0) * c.width, (ny1 - ny0) * c.height);
      let h = 2166136261;
      for (let i = 0; i < px.length; i++) h = Math.imul(h ^ px[i]!, 16777619) >>> 0;
      return h;
    },
    /**
     * 把字卡用 scale 畫出來（會先載入字體），量「亮色的字」墨跡在畫布裡的上下左右邊界，
     * 驗證字塊內距跟設定的一樣。字塊要用深色、字用白色。
     */
    async cardInk(card: TextCard, scale = 1) {
      for (const r of card.runs) await ensureFont(r.fontId);
      const out = renderText(card, scale);
      const ctx = out.canvas.getContext('2d')!;
      const pw = out.canvas.width,
        ph = out.canvas.height,
        density = pw / out.w;
      const { data } = ctx.getImageData(0, 0, pw, ph);
      let top = Infinity;
      let bottom = -1;
      let left = Infinity;
      let right = -1;
      for (let y = 0; y < ph; y++)
        for (let x = 0; x < pw; x++) {
          const i = (y * pw + x) * 4;
          if (data[i + 3]! > 200 && data[i + 1]! > 128 && data[i + 2]! > 128) {
            top = Math.min(top, y);
            bottom = Math.max(bottom, y);
            left = Math.min(left, x);
            right = Math.max(right, x);
          }
        }
      return {
        w: out.w,
        h: out.h,
        top: top / density,
        bottom: (bottom + 1) / density - 1,
        left: left / density,
        right: (right + 1) / density - 1,
        pixelRatio: density,
      };
    },
    /** 把字卡畫成 PNG（dataURL），驗收截圖用；bg 是背景色（預設白） */
    async cardPng(card: TextCard, scale = 1, bg = '#ffffff') {
      for (const r of card.runs) await ensureFont(r.fontId);
      const out = renderText(card, scale);
      const cv = document.createElement('canvas');
      cv.width = out.w;
      cv.height = out.h;
      const ctx = cv.getContext('2d')!;
      ctx.fillStyle = bg;
      ctx.fillRect(0, 0, out.w, out.h);
      ctx.drawImage(out.canvas, 0, 0, out.w, out.h);
      return cv.toDataURL('image/png');
    },
    /** 用輸出解析度畫出 t 秒那一格（匯出共用的流程），回傳 PNG 大小與幾個取樣點的顏色 */
    async exportFrame(t: number, points: [number, number][]) {
      const p = useProjectStore.getState().project!;
      const { blob } = await renderFrame(p, t, (id) => urlFor(p.id, id));
      const bmp = await createImageBitmap(blob);
      const cv = document.createElement('canvas');
      cv.width = bmp.width;
      cv.height = bmp.height;
      const ctx = cv.getContext('2d')!;
      ctx.drawImage(bmp, 0, 0);
      return {
        width: bmp.width,
        height: bmp.height,
        bytes: blob.size,
        samples: points.map(([nx, ny]) =>
          Array.from(ctx.getImageData(Math.floor(nx * bmp.width), Math.floor(ny * bmp.height), 1, 1).data),
        ),
      };
    },
  };
  (window as unknown as { __videoclip: typeof hook }).__videoclip = hook;
}
