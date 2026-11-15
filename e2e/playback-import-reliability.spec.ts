import { expect, test, type Page } from '@playwright/test';
import { createProjectWith, waitForPreviewReady, seekTo } from './helpers';
import type { Project } from '../src/model/types';
type Hook = {
  time: () => number;
  audioMode: () => string;
  audioState: () => string;
  audioEnergy: () => number;
  project: () => Project;
};
const state = (page: Page) =>
  page.evaluate(() => {
    const h = (window as unknown as { __videoclip: Hook }).__videoclip;
    return { time: h.time(), mode: h.audioMode(), audio: h.audioState(), energy: h.audioEnergy() };
  });
async function playing(page: Page) {
  await page.getByRole('button', { name: '播放', exact: true }).tap();
  await expect.poll(async () => (await state(page)).energy).toBeGreaterThan(0.005);
}
test('完整縮圖與轉檔尚未完成也能進入編輯；播放立即停止背景解碼，暫停再準備', async ({ page }) => {
  await page.addInitScript(() => {
    const Native = window.Worker;
    const w = window as unknown as { optionalStarted: number; optionalStopped: number };
    w.optionalStarted = w.optionalStopped = 0;
    window.Worker = new Proxy(Native, {
      construct(target, args) {
        if (String(args[0]).includes('previewProxy')) {
          w.optionalStarted++;
          return {
            postMessage() {},
            terminate() {
              w.optionalStopped++;
            },
            onerror: null,
            onmessage: null,
          };
        }
        return Reflect.construct(target, args);
      },
    });
  });
  await createProjectWith(page, ['timing-video.webm']);
  await waitForPreviewReady(page);
  await expect
    .poll(() => page.evaluate(() => (window as unknown as { optionalStarted: number }).optionalStarted))
    .toBe(1);
  const partial = await page.evaluate(
    () => (window as unknown as { __videoclip: Hook }).__videoclip.project().assets[0],
  );
  expect(partial?.previewFiles).toBeUndefined();
  expect(partial?.filmstrip).toBeUndefined();
  await expect(page.getByRole('button', { name: '播放', exact: true })).toBeVisible();
  await expect(page.locator('.pool video')).not.toHaveCount(0);
  await page.screenshot({ path: 'docs/screenshots/playback-import/edit-before-background-ready.png' });
  await playing(page);
  await expect
    .poll(() => page.evaluate(() => (window as unknown as { optionalStopped: number }).optionalStopped))
    .toBe(1);
  await expect(page.getByTestId('media-preparation')).toContainText('播放優先');
  await expect.poll(async () => (await state(page)).time).toBeGreaterThan(1);
  expect(await page.evaluate(() => (window as unknown as { optionalStarted: number }).optionalStarted)).toBe(
    1,
  );
  await page.getByRole('button', { name: '暫停', exact: true }).tap();
  await expect
    .poll(() => page.evaluate(() => (window as unknown as { optionalStarted: number }).optionalStarted))
    .toBe(2);
});
test('第一次明確播放就有原音，切預覽畫質沿用同一音訊授權，拖回零秒仍可重播', async ({ page }) => {
  await page.addInitScript(() => {
    const Native = window.AudioContext;
    const w = window as unknown as { contexts: AudioContext[] };
    w.contexts = [];
    window.AudioContext = new Proxy(Native, {
      construct(target, args) {
        const context = Reflect.construct(target, args) as AudioContext;
        w.contexts.push(context);
        return context;
      },
    });
  });
  await createProjectWith(page, ['timing-video.webm']);
  await waitForPreviewReady(page);
  expect((await state(page)).mode).toBe('webaudio');
  await expect
    .poll(() =>
      page.locator('.pool video').evaluateAll((els) => els.every((el) => (el as HTMLVideoElement).paused)),
    )
    .toBe(true);
  expect(await page.evaluate(() => (window as unknown as { contexts: unknown[] }).contexts.length)).toBe(0);
  await playing(page);
  await page.getByRole('button', { name: '預覽畫質', exact: true }).tap();
  await page.getByRole('button', { name: '標準', exact: true }).tap();
  await waitForPreviewReady(page);
  await expect.poll(async () => (await state(page)).energy).toBeGreaterThan(0.005);
  expect(await page.evaluate(() => (window as unknown as { contexts: unknown[] }).contexts.length)).toBe(1);
  await page.getByRole('button', { name: '暫停', exact: true }).tap();
  await seekTo(page, 0);
  await expect.poll(async () => (await state(page)).time).toBeLessThan(0.1);
  await playing(page);
  await expect.poll(async () => (await state(page)).time).toBeGreaterThan(0.6);
  await page.getByRole('button', { name: '暫停', exact: true }).tap();
  await page.screenshot({ path: 'docs/screenshots/playback-import/replay-with-original-sound.png' });
});
test('沒有AudioSession的iOS走原生聲音，按下播放當下取消靜音且真實音軌持續輸出', async ({ page }) => {
  await page.addInitScript(() => {
    localStorage.setItem('lm2-test-native-audio', '1');
    Object.defineProperty(navigator, 'audioSession', { configurable: true, value: undefined });
    const play = HTMLMediaElement.prototype.play;
    const w = window as unknown as { firstAudible: boolean[] };
    w.firstAudible = [];
    HTMLMediaElement.prototype.play = function () {
      if (this.closest('.pool') && this.dataset.previewIntent === 'play') w.firstAudible.push(!this.muted);
      return play.call(this);
    };
  });
  await createProjectWith(page, ['timing-video.webm']);
  await waitForPreviewReady(page);
  expect((await state(page)).mode).toBe('element');
  await page.getByRole('button', { name: '播放', exact: true }).tap();
  await expect.poll(async () => (await state(page)).time).toBeGreaterThan(0.5);
  expect(await page.evaluate(() => (window as unknown as { firstAudible: boolean[] }).firstAudible[0])).toBe(
    true,
  );
  const meter = await page.evaluate(async () => {
    const video = Array.from(document.querySelectorAll<HTMLVideoElement>('.pool video')).find(
      (v) => !v.paused,
    )!;
    const stream = (video as HTMLVideoElement & { captureStream: () => MediaStream }).captureStream();
    const context = new AudioContext();
    await context.resume();
    const analyser = context.createAnalyser();
    const source = context.createMediaStreamSource(stream);
    source.connect(analyser);
    const buffer = new Float32Array(analyser.fftSize);
    let peak = 0;
    for (let i = 0; i < 20; i++) {
      await new Promise((resolve) => setTimeout(resolve, 30));
      analyser.getFloatTimeDomainData(buffer);
      peak = Math.max(peak, ...buffer.map(Math.abs));
    }
    source.disconnect();
    await context.close();
    return { peak, audioTracks: stream.getAudioTracks().length, muted: video.muted, paused: video.paused };
  });
  expect(meter.audioTracks).toBeGreaterThan(0);
  expect(meter.peak).toBeGreaterThan(0.005);
  expect(meter.muted).toBe(false);
  expect(meter.paused).toBe(false);
});
test('短暫缺畫格時持續解碼和播放，不反覆暫停全部來源或重設時間', async ({ page }) => {
  await page.addInitScript(() => {
    const descriptor = Object.getOwnPropertyDescriptor(HTMLMediaElement.prototype, 'readyState')!;
    const pause = HTMLMediaElement.prototype.pause;
    const w = window as unknown as { forceGap: boolean; pauseCalls: number };
    w.forceGap = false;
    w.pauseCalls = 0;
    Object.defineProperty(HTMLMediaElement.prototype, 'readyState', {
      configurable: true,
      get() {
        return w.forceGap && this.closest('.pool') ? 1 : descriptor.get!.call(this);
      },
    });
    HTMLMediaElement.prototype.pause = function () {
      if (this.closest('.pool') && this.dataset.previewIntent === 'play') w.pauseCalls++;
      return pause.call(this);
    };
  });
  await createProjectWith(page, ['timing-video.webm']);
  await waitForPreviewReady(page);
  await playing(page);
  await expect.poll(async () => (await state(page)).time).toBeGreaterThan(0.5);
  const before = await state(page);
  const result = await page.evaluate(async () => {
    const w = window as unknown as { forceGap: boolean; pauseCalls: number; __videoclip: Hook };
    const calls = w.pauseCalls;
    w.forceGap = true;
    await new Promise((resolve) => setTimeout(resolve, 350));
    w.forceGap = false;
    return { pauses: w.pauseCalls - calls, time: w.__videoclip.time() };
  });
  expect(result.pauses).toBe(0);
  expect(result.time - before.time).toBeGreaterThan(0.25);
  await expect.poll(async () => (await state(page)).energy).toBeGreaterThan(0.005);
  await expect(page.getByRole('button', { name: '暫停', exact: true })).toBeVisible();
});
