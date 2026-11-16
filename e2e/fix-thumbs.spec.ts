import type { Project } from '../src/model/types';
import { expandAllGroups } from './helpers';
import { expect, test } from '@playwright/test';
import { clips, createProjectWith, fixture, project } from './helpers';

const SHOT = 'docs/screenshots/fix-safe-zone';

const thumbsOf = async (page: import('@playwright/test').Page) =>
  (await project(page)) as unknown as { assets: { name: string; thumbs: string[] }[] };

test('一般情況：匯入後時間軸有縮圖（不顯示檔名）', async ({ page }) => {
  await createProjectWith(page, ['clip-a.webm']);
  // 機器忙的時候縮圖可能晚一點才到（匯入先放行、播放器補圖），所以用輪詢
  await expect
    .poll(async () => (await thumbsOf(page)).assets[0]!.thumbs[0] ?? '', { timeout: 15_000 })
    .toMatch(/^data:image\/jpeg/);
  await expect
    .poll(
      async () =>
        ((await project(page)) as unknown as Project).assets[0]?.filmstrip?.frames.every((f) => !!f.src),
      { timeout: 30000 },
    )
    .toBe(true);
  await expect(page.getByTestId('clip-name')).toHaveCount(0);
});

test('模擬 iPhone：WebCodecs不可用時，原生影片依每2秒解碼縮圖，完整快取可重開', async ({ page }) => {
  await page.addInitScript(() => {
    // Mediabunny 沒有 WebCodecs 可用
    delete (window as unknown as { VideoDecoder?: unknown }).VideoDecoder;
    const events: { requested: number; presented: number; ready: number }[] = [];
    (window as unknown as { __thumbPresentations: typeof events }).__thumbPresentations = events;
    const request = HTMLVideoElement.prototype.requestVideoFrameCallback;
    HTMLVideoElement.prototype.requestVideoFrameCallback = function (callback) {
      return request.call(this, (now, info) => {
        if (this.style.width === '1px')
          events.push({ requested: this.currentTime, presented: info.mediaTime, ready: this.readyState });
        callback(now, info);
      });
    };
    // 匯入時用的隱藏 <video>（不是預覽的影片池）聽不到 loadeddata（模擬 iOS 沒有手勢時不載入畫面）
    const orig = EventTarget.prototype.addEventListener;
    EventTarget.prototype.addEventListener = function (this: EventTarget, type: string, ...rest: unknown[]) {
      if (
        type === 'loadeddata' &&
        this instanceof HTMLVideoElement &&
        !this.hasAttribute('webkit-playsinline')
      )
        return;
      return (orig as (...a: unknown[]) => void).call(this, type, ...rest);
    } as typeof orig;
  });
  test.setTimeout(60_000);
  // Metadata import does not wait for overview thumbnails; background native decoding is separate.
  await page.addInitScript(() => {
    localStorage.setItem('lm2-debug', '1');
    localStorage.setItem('lm2-skip-onboarding', '1');
  });
  await page.goto('./');
  await page.getByRole('button', { name: '新增專案' }).tap();
  await page.getByTestId('new-project-files').setInputFiles(fixture('clip-a.webm'));
  await expect(page).toHaveURL(/#\/p\//, { timeout: 30_000 });
  await expandAllGroups(page);
  await expect(clips(page)).toHaveCount(1, { timeout: 20_000 });
  // 補縮圖：播放器第一次畫出這支影片後，素材會有縮圖，時間軸不再顯示檔名
  await expect
    .poll(async () => (await thumbsOf(page)).assets[0]!.thumbs.length, { timeout: 20_000 })
    .toBeGreaterThan(0);
  try {
    await expect
      .poll(
        async () =>
          ((await project(page)) as unknown as Project).assets[0]?.filmstrip?.frames.every((f) => !!f.src),
        { timeout: 30000 },
      )
      .toBe(true);
  } catch (error) {
    console.log(
      'Native thumbnail diagnostics',
      await page.evaluate(() => ({
        events: (window as unknown as { __thumbPresentations: unknown }).__thumbPresentations,
        frames: (window as unknown as { __videoclip: { project: () => Project } }).__videoclip
          .project()
          .assets[0]?.filmstrip?.frames.map((frame) => ({ time: frame.time, ready: !!frame.src })),
      })),
    );
    throw error;
  }
  await expect(page.getByTestId('clip-name')).toHaveCount(0);
  const a = ((await project(page)) as unknown as Project).assets[0]!;
  const cached = a.filmstrip!;
  expect(cached.frames.map((f) => f.time)).toEqual(
    Array.from({ length: Math.ceil(a.duration / 2) }, (_, i) => i * 2),
  );
  expect(cached.frames.every((f) => !!f.src)).toBe(true);
  await expect(clips(page)).toHaveCount(1);
  await page.screenshot({ path: `${SHOT}/after-thumb-fallback.png` });

  // 補上的縮圖有存起來：等自動儲存後重新整理仍然在
  await page.waitForTimeout(1200);
  await page.reload();
  await expandAllGroups(page);
  await expect(clips(page)).toHaveCount(1, { timeout: 20_000 });
  expect((await thumbsOf(page)).assets[0]!.thumbs.length).toBeGreaterThan(0);
});
