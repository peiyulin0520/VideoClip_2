import { expect, test } from '@playwright/test';
import { createProjectWith, clips, openTab, setCropOffset, waitForPreviewReady, seekTo } from './helpers';
import type { Project } from '../src/model/types';
const current = (page: import('@playwright/test').Page): Promise<Project> =>
  page.evaluate(() =>
    (window as unknown as { __videoclip: { project: () => Project } }).__videoclip.project(),
  );
test('自由裁切描邊時完整來源持續可見，只有檢查結果才隱藏未選區', async ({ page }) => {
  await createProjectWith(page, ['solid-red.webm']);
  await clips(page).first().tap();
  await openTab(page, '剪輯');
  await page.getByRole('button', { name: '裁切', exact: true }).tap();
  await page.getByRole('button', { name: '自由裁切', exact: true }).tap();
  await setCropOffset(page);
  const stage = page.getByTestId('crop-stage');
  await stage.scrollIntoViewIfNeeded();
  const b = (await stage.boundingBox())!;
  await page.mouse.move(b.x + b.width * 0.3, b.y + b.height * 0.3);
  await page.mouse.down();
  for (const [x, y] of [
    [0.65, 0.3],
    [0.65, 0.65],
    [0.3, 0.65],
    [0.3, 0.3],
  ])
    await page.mouse.move(b.x + b.width * x!, b.y + b.height * y!, { steps: 5 });
  await page.mouse.up();
  const alpha = () =>
    page
      .locator('.crop-result')
      .evaluate(
        (el: HTMLCanvasElement) =>
          el.getContext('2d')!.getImageData(Math.floor(el.width * 0.05), Math.floor(el.height * 0.05), 1, 1)
            .data[3],
      );
  await expect.poll(alpha).toBe(255);
  await page.screenshot({ path: 'docs/screenshots/nov16/crop-source-visible.png' });
  await page.getByRole('button', { name: '檢查裁切結果', exact: true }).tap();
  await expect.poll(alpha).toBe(0);
  await page.getByRole('button', { name: '繼續調整裁切', exact: true }).tap();
  await expect.poll(alpha).toBe(255);
  await page.getByRole('button', { name: '關閉且不儲存', exact: true }).tap();
});
test('音訊緊湊列保留操作及音量，原始解析度和來源影格率可實際匯出', async ({ page }) => {
  test.setTimeout(90000);
  await createProjectWith(page, ['timing-video.webm']);
  await waitForPreviewReady(page);
  await openTab(page, '音訊');
  const row = page.locator('.audio-row').first();
  for (const width of [320, 390, 430]) {
    await page.setViewportSize({ width, height: 844 });
    expect((await row.boundingBox())!.height).toBeLessThan(150);
    expect(await row.evaluate((el) => el.scrollWidth - el.clientWidth)).toBeLessThanOrEqual(1);
  }
  await row.scrollIntoViewIfNeeded();
  await page.screenshot({ path: 'docs/screenshots/nov16/compact-audio.png' });
  const p = await current(page),
    a = p.assets[0]!;
  expect(a.frameRate).toBeGreaterThan(20);
  await page.getByRole('button', { name: '匯出影片', exact: true }).tap();
  await expect(page.locator('[aria-label="匯出影格率"] option[value="0"]')).toBeEnabled();
  await page.getByLabel('匯出解析度', { exact: true }).selectOption('0');
  await page.getByLabel('匯出影格率', { exact: true }).selectOption('0');
  await page.screenshot({ path: 'docs/screenshots/nov16/native-export-options.png' });
  await page.getByRole('button', { name: '開始匯出', exact: true }).tap();
  const link = page.getByRole('link', { name: '下載影片', exact: true });
  await expect(link).toBeVisible({ timeout: 60000 });
  const info = await page.evaluate(
    async (url) =>
      await (
        window as unknown as {
          __videoclip: { inspectMovie: (u: string, t: number) => Promise<{ width: number; height: number }> };
        }
      ).__videoclip.inspectMovie(url!, 0.1),
    await link.getAttribute('href'),
  );
  expect(info.width).toBeGreaterThanOrEqual(a.width - 2);
  expect(info.height).toBeGreaterThanOrEqual(a.height - 2);
});
test('設定可啟用低頻播放效能，實際播放及轉場有格數與耗時，回零重播仍有聲音', async ({ page }) => {
  await page.addInitScript(() =>
    localStorage.setItem(
      'lm2-preferences',
      JSON.stringify({ showPerf: true, preview: 540, previewModeVersion: 2 }),
    ),
  );
  await createProjectWith(page, ['tone-video.webm', 'solid-green.webm']);
  await waitForPreviewReady(page);
  await openTab(page, '特效');
  await page.getByRole('button', { name: '疊化', exact: true }).tap();
  const p = await current(page),
    join = p.tracks[0]!.items[1]!.start;
  await seekTo(page, Math.max(0, join - 0.6));
  await expect
    .poll(() =>
      page.evaluate(() => (window as unknown as { __videoclip: { time: () => number } }).__videoclip.time()),
    )
    .toBeCloseTo(Math.max(0, join - 0.6), 1);
  await page.getByRole('button', { name: '播放', exact: true }).tap();
  await expect
    .poll(() =>
      page.evaluate(
        () =>
          (
            window as unknown as { __videoclip: { playbackStats: () => { fps: number } } }
          ).__videoclip.playbackStats().fps,
      ),
    )
    .toBeGreaterThan(5);
  await expect
    .poll(() =>
      page.evaluate(
        () =>
          (
            window as unknown as { __videoclip: { playbackStats: () => { transition: { frames: number } } } }
          ).__videoclip.playbackStats().transition.frames,
      ),
    )
    .toBeGreaterThan(0);
  await expect(page.getByTestId('perf-overlay')).toBeVisible();
  await page.getByTestId('stage').scrollIntoViewIfNeeded();
  await page.screenshot({ path: 'docs/screenshots/nov16/playback-performance.png' });
  await page.getByRole('button', { name: '暫停', exact: true }).tap();
  await seekTo(page, 0);
  await expect
    .poll(() =>
      page.evaluate(() => (window as unknown as { __videoclip: { time: () => number } }).__videoclip.time()),
    )
    .toBeCloseTo(0, 1);
  await page.getByRole('button', { name: '播放', exact: true }).tap();
  await expect
    .poll(() =>
      page.evaluate(() =>
        (window as unknown as { __videoclip: { audioEnergy: () => number } }).__videoclip.audioEnergy(),
      ),
    )
    .toBeGreaterThan(0.01);
  await page.getByRole('button', { name: '暫停', exact: true }).tap();
  await page.getByRole('link', { name: '回首頁', exact: true }).tap();
  await page.goto('./#/settings');
  const setting = page.getByRole('checkbox', { name: '顯示播放效能', exact: true });
  await expect(setting).toBeChecked();
  await setting.uncheck();
  await expect(setting).not.toBeChecked();
});
