import { setCropOffset } from './helpers';
import { expandAllGroups } from './helpers';
import { expect, test, type Page } from '@playwright/test';
import type { Project } from '../src/model/types';
import {
  createProjectWith,
  addOverlays,
  clips,
  fixture,
  openTab,
  seekTo,
  samplePreview,
  isRed,
  isGreen,
  isBlue,
} from './helpers';

const shots = 'docs/screenshots/completion';
const current = (page: Page): Promise<Project> =>
  page.evaluate(() =>
    (window as unknown as { __videoclip: { project: () => Project } }).__videoclip.project(),
  );
const energy = (page: Page) =>
  page.evaluate(() =>
    (window as unknown as { __videoclip: { audioEnergy: () => number } }).__videoclip.audioEnergy(),
  );
async function range(page: Page, label: string, value: number) {
  await page.getByRole('slider', { name: label, exact: true }).evaluate((el, v) => {
    const input = el as HTMLInputElement;
    Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value')!.set!.call(input, String(v));
    input.dispatchEvent(new Event('input', { bubbles: true }));
  }, value);
}
type Movie = {
  duration: number;
  width: number;
  height: number;
  audio: boolean;
  rms: number;
  bytes: number;
  samples: number[][];
  whitePixels: number;
};
async function inspect(page: Page, t: number, points: [number, number][] = []): Promise<Movie> {
  const url = await page.getByLabel('匯出影片預覽').getAttribute('src');
  return page.evaluate(
    ([url, t, points]) =>
      (
        window as unknown as {
          __videoclip: { inspectMovie: (u: string, t: number, p: [number, number][]) => Promise<Movie> };
        }
      ).__videoclip.inspectMovie(url as string, t as number, points as [number, number][]),
    [url, t, points],
  );
}
async function beginExport(page: Page, method = 'offline') {
  await page.getByRole('button', { name: '匯出影片', exact: true }).tap();
  await page.getByLabel('匯出解析度').selectOption('360');
  await page.getByLabel('匯出影格率').selectOption('24');
  await page.getByLabel('匯出方式').selectOption(method);
  await page.getByRole('button', { name: '開始匯出', exact: true }).tap();
  await expect(page.getByRole('link', { name: '下載影片', exact: true })).toBeVisible({ timeout: 90000 });
}

test('留白作為可排序修剪素材插在中間；自由主軌可拖出真正空隙', async ({ page }) => {
  await createProjectWith(page, ['clip-a.webm', 'clip-b.webm']);
  await seekTo(page, 1);
  await openTab(page, '素材');
  await page.getByRole('button', { name: '留白色塊', exact: true }).tap();
  await page.getByRole('button', { name: '白色', exact: true }).tap();
  await page.getByRole('button', { name: '插入留白片段', exact: true }).tap();
  await expect(clips(page)).toHaveCount(4);
  const p = await current(page),
    blank = p.tracks[0]!.items.find(
      (it) => it.type !== 'text' && p.assets.find((a) => a.id === it.assetId)?.generated,
    )!;
  expect(blank.start).toBe(1);
  expect(blank.duration).toBe(3);
  await seekTo(page, 2);
  await expect
    .poll(async () => {
      const c = await samplePreview(page, 0.5, 0.5);
      return !!c && c[0] > 235 && c[1] > 235 && c[2] > 235;
    })
    .toBe(true);
  await page.screenshot({ path: `${shots}/blank-between-clips.png` });
  expect((await current(page)).freeMain).toBe(true);
  const clip = page.getByTestId('clip').filter({ hasText: '留白' });
  const box = (await clip.boundingBox())!;
  await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2);
  await page.mouse.down();
  await page.waitForTimeout(450);
  await page.mouse.move(box.x + box.width / 2 + 240, box.y + box.height / 2, { steps: 4 });
  await page.mouse.up();
  await expect
    .poll(async () => (await current(page)).tracks[0]!.items.find((x) => x.id === blank.id)!.start)
    .toBeGreaterThan(4);
  await seekTo(page, 2);
  await expect
    .poll(async () => {
      const c = await samplePreview(page, 0.5, 0.5);
      return !!c && c[0] < 15 && c[1] < 15 && c[2] < 15;
    })
    .toBe(true);
});

test('自己貼圖的收藏跨專案保留，移除收藏不刪已加入的素材', async ({ page }) => {
  await createProjectWith(page, ['solid-blue.webm']);
  await openTab(page, '素材');
  await page.getByLabel('同時存到我的素材庫').check();
  await page.getByTestId('sticker-files').setInputFiles(fixture('photo.png'));
  await expect(page.getByRole('button', { name: '使用素材 photo.png', exact: true })).toBeVisible();
  await page.reload();
  await expandAllGroups(page);
  await openTab(page, '素材');
  await expect(page.getByRole('button', { name: '使用素材 photo.png', exact: true })).toBeVisible();
  await createProjectWith(page, ['solid-red.webm']);
  await openTab(page, '素材');
  await page.getByRole('button', { name: '使用素材 photo.png', exact: true }).tap();
  await expect(clips(page)).toHaveCount(2);
  await page.getByRole('button', { name: '刪除收藏 photo.png', exact: true }).tap();
  await expect(page.getByRole('button', { name: '使用素材 photo.png', exact: true })).toHaveCount(0);
  await page.reload();
  await expandAllGroups(page);
  await expect(clips(page)).toHaveCount(2);
  await page.screenshot({ path: `${shots}/saved-material-in-project.png` });
});

test('畫筆、橡皮擦、粗細透明度與收藏畫作可用', async ({ page }) => {
  await createProjectWith(page, ['solid-blue.webm']);
  await openTab(page, '素材');
  await page.getByLabel('同時存到我的素材庫').check();
  await page.getByRole('button', { name: '＋ 畫畫', exact: true }).tap();
  const canvas = page.getByTestId('drawing-canvas'),
    box = (await canvas.boundingBox())!;
  await page.mouse.move(box.x + box.width * 0.2, box.y + box.height * 0.4);
  await page.mouse.down();
  await page.mouse.move(box.x + box.width * 0.8, box.y + box.height * 0.6, { steps: 5 });
  await page.mouse.up();
  await page.getByRole('button', { name: '橡皮擦', exact: true }).tap();
  await range(page, '筆刷粗細', 70);
  await range(page, '筆刷透明度', 70);
  await page.mouse.move(box.x + box.width * 0.5, box.y + box.height * 0.4);
  await page.mouse.down();
  await page.mouse.move(box.x + box.width * 0.5, box.y + box.height * 0.6, { steps: 3 });
  await page.mouse.up();
  await page.getByRole('button', { name: '復原筆畫', exact: true }).tap();
  await page.getByLabel('畫作名稱').fill('我的線條');
  await page.screenshot({ path: `${shots}/drawing.png` });
  await page.getByRole('button', { name: '加入畫作', exact: true }).tap();
  await expect(page.getByRole('button', { name: '使用素材 我的線條.png', exact: true })).toBeVisible();
  await page.reload();
  await expandAllGroups(page);
  await openTab(page, '素材');
  await expect(page.getByRole('button', { name: '使用素材 我的線條.png', exact: true })).toBeVisible();
});

test('GIPHY Key 僅本裝置保留，搜尋動態透明貼圖，不進共用收藏', async ({ page, browser }) => {
  const gif = fixture('animated-sticker.gif');
  let requests = 0;
  await page.route('https://api.giphy.com/v1/stickers/**', async (route) => {
    requests++;
    const url = new URL(route.request().url());
    expect(url.searchParams.get('api_key')).toBe('device-test-key');
    await route.fulfill({
      headers: { 'access-control-allow-origin': '*' },
      json: {
        data: [
          {
            id: 'test-gif',
            title: '測試圓圈',
            url: 'https://giphy.com/stickers/test-gif',
            images: {
              original: { url: 'https://media.giphy.com/media/test-gif/giphy.gif' },
              fixed_width: { url: 'https://media.giphy.com/media/test-gif/giphy.gif' },
            },
          },
        ],
      },
    });
  });
  await page.route('https://media.giphy.com/**', (route) =>
    route.fulfill({ path: gif, contentType: 'image/gif', headers: { 'access-control-allow-origin': '*' } }),
  );
  await createProjectWith(page, ['solid-blue.webm']);
  await openTab(page, '素材');
  await page.getByRole('button', { name: 'GIPHY 貼圖', exact: true }).tap();
  await page.getByLabel('GIPHY API Key').fill('device-test-key');
  await page.getByRole('button', { name: '儲存 Key', exact: true }).tap();
  await page.getByLabel('搜尋 GIPHY 貼圖').fill('圓圈');
  await page.getByRole('button', { name: '搜尋貼圖', exact: true }).tap();
  await page.getByRole('button', { name: '加入貼圖 測試圓圈', exact: true }).tap();
  await expect(clips(page)).toHaveCount(2);
  await seekTo(page, 0.1);
  await expect.poll(async () => isRed(await samplePreview(page, 0.5, 0.5))).toBe(true);
  await seekTo(page, 0.4);
  await expect.poll(async () => isGreen(await samplePreview(page, 0.5, 0.5))).toBe(true);
  await expect.poll(async () => isBlue(await samplePreview(page, 0.3, 0.39))).toBe(true);
  await page.reload();
  await expandAllGroups(page);
  await openTab(page, '素材');
  await page.getByRole('button', { name: 'GIPHY 貼圖', exact: true }).tap();
  await expect(page.getByLabel('GIPHY API Key')).toHaveCount(0);
  await expect(page.getByRole('button', { name: '儲存 Key', exact: true })).toHaveCount(0);
  await page.getByRole('button', { name: '搜尋貼圖', exact: true }).tap();
  expect(requests).toBe(2);
  await page.screenshot({ path: `${shots}/giphy.png` });
  await page.getByRole('button', { name: '我的素材', exact: true }).tap();
  await expect(page.getByText('還沒有收藏。', { exact: false })).toBeVisible();
  const other = await browser.newContext({ hasTouch: true, viewport: { width: 390, height: 664 } }),
    otherPage = await other.newPage();
  await createProjectWith(otherPage, ['solid-blue.webm']);
  await openTab(otherPage, '素材');
  await otherPage.getByRole('button', { name: 'GIPHY 貼圖', exact: true }).tap();
  await expect(otherPage.getByLabel('GIPHY API Key')).toHaveValue('');
  await other.close();
});

test('手動描邊與拖曳四邊裁切真的在畫面留下透明區域', async ({ page }) => {
  await createProjectWith(page, ['solid-red.webm']);
  await addOverlays(page, ['solid-green.webm']);
  await expect(clips(page)).toHaveCount(2);
  await openTab(page, '剪輯');
  await page.getByRole('button', { name: '裁切', exact: true }).tap();
  await page.getByRole('button', { name: '自由裁切', exact: true }).tap();
  await setCropOffset(page);
  const box = (await page.getByTestId('crop-stage').boundingBox())!;
  await page.mouse.move(box.x + box.width * 0.05, box.y + box.height * 0.05);
  await page.mouse.down();
  await page.mouse.move(box.x + box.width * 0.48, box.y + box.height * 0.05, { steps: 3 });
  await page.mouse.move(box.x + box.width * 0.48, box.y + box.height * 0.95, { steps: 3 });
  await page.mouse.move(box.x + box.width * 0.05, box.y + box.height * 0.95, { steps: 3 });
  await page.mouse.up();
  await page.getByRole('button', { name: '套用裁切', exact: true }).tap();
  await expect.poll(async () => isGreen(await samplePreview(page, 0.4, 0.5))).toBe(true);
  await expect.poll(async () => isRed(await samplePreview(page, 0.6, 0.5))).toBe(true);
  await page.screenshot({ path: `${shots}/lasso-mask.png` });
  await page.getByRole('button', { name: '裁切', exact: true }).tap();
  await page.getByRole('button', { name: '重設裁切', exact: true }).tap();
  await page.getByRole('button', { name: '一般裁切', exact: true }).tap();
  const stage = (await page.getByTestId('crop-stage').boundingBox())!,
    handle = (await page.getByRole('button', { name: '裁切拖曳 l', exact: true }).boundingBox())!;
  await page.mouse.move(handle.x + handle.width / 2, handle.y + handle.height / 2);
  await page.mouse.down();
  await page.mouse.move(stage.x + stage.width * 0.4, stage.y + stage.height * 0.5, { steps: 4 });
  await page.mouse.up();
  await page.getByRole('button', { name: '套用裁切', exact: true }).tap();
  const selected = (await current(page)).tracks[1]!.items[0]!;
  expect(selected.crop!.l).toBeCloseTo(0.4, 1);
  await expect.poll(async () => isRed(await samplePreview(page, 0.3, 0.5))).toBe(true);
  await expect.poll(async () => isGreen(await samplePreview(page, 0.5, 0.5))).toBe(true);
});

test('原片音訊真的播放；關閉原音後靜音，分離與配樂有獨立軌道', async ({ page }) => {
  await createProjectWith(page, ['tone-video.webm']);
  await openTab(page, '音訊');
  await page.getByRole('button', { name: '播放', exact: true }).tap();
  await expect.poll(() => energy(page)).toBeGreaterThan(0.01);
  const checkbox = page.getByRole('checkbox', { name: /保留音訊/ }).first();
  await checkbox.uncheck();
  await expect.poll(() => energy(page)).toBeLessThan(0.001);
  if (await page.getByRole('button', { name: '暫停', exact: true }).count())
    await page.getByRole('button', { name: '暫停', exact: true }).tap();
  await checkbox.check();
  await page.getByRole('button', { name: '分離原音', exact: true }).tap();
  await expect(clips(page)).toHaveCount(2);
  await page.getByTestId('music-files').setInputFiles(fixture('music.wav'));
  await expect(clips(page)).toHaveCount(3);
  await page.screenshot({ path: `${shots}/audio-tracks.png` });
  const p = await current(page);
  expect(p.tracks.filter((t) => t.kind === 'audio')).toHaveLength(2);
  expect((p.tracks[0]!.items[0] as { audioEnabled?: boolean }).audioEnabled).toBe(false);
});

test('完整影片含文字與原音，下載的是可解碼的影片檔', async ({ page }) => {
  test.setTimeout(120000);
  await createProjectWith(page, ['tone-video.webm']);
  await openTab(page, '文字');
  await page.getByRole('button', { name: /新增文字/ }).tap();
  await page.getByLabel('文字內容').fill('輸出測試');
  await beginExport(page);
  const output = await inspect(page, 1, [[0.1, 0.1]]);
  expect(output.duration).toBeCloseTo(3, 1);
  expect(output.audio).toBe(true);
  expect(output.rms).toBeGreaterThan(0.01);
  expect(output.whitePixels).toBeGreaterThan(20);
  expect(output.samples[0]![0]).toBeGreaterThan(200);
  expect(output.height).toBeLessThanOrEqual(360);
  expect(output.width % 2).toBe(0);
  expect(output.bytes).toBeGreaterThan(2000);
  await expect
    .poll(() => page.getByLabel('匯出影片預覽').evaluate((el) => (el as HTMLVideoElement).readyState))
    .toBeGreaterThanOrEqual(2);
  await page.getByLabel('匯出影片預覽').evaluate((el) => {
    (el as HTMLVideoElement).currentTime = 1;
  });
  await expect
    .poll(() => page.getByLabel('匯出影片預覽').evaluate((el) => (el as HTMLVideoElement).seeking))
    .toBe(false);
  await page.screenshot({ path: `${shots}/export-complete.png` });
  const download = page.waitForEvent('download');
  await page.getByRole('link', { name: '下載影片', exact: true }).click();
  expect((await download).suggestedFilename()).toMatch(/\.(mp4|webm)$/);
});

test('配樂匯出保留延後出現的空白音訊，留白與動態透明 GIF 可一起輸出', async ({ page }) => {
  test.setTimeout(120000);
  await createProjectWith(page, ['solid-blue.webm']);
  await openTab(page, '素材');
  await page.getByTestId('sticker-files').setInputFiles(fixture('animated-sticker.gif'));
  await expect(clips(page)).toHaveCount(2);
  await seekTo(page, 1);
  await openTab(page, '音訊');
  await page.getByTestId('music-files').setInputFiles(fixture('music.wav'));
  await expect(clips(page)).toHaveCount(3);
  await beginExport(page);
  const a = await inspect(page, 0.1, [
      [0.5, 0.5],
      [0.3, 0.39],
    ]),
    b = await inspect(page, 0.4, [[0.5, 0.5]]),
    c = await inspect(page, 1.2);
  expect(a.samples[0]![0]).toBeGreaterThan(200);
  expect(a.samples[1]![2]).toBeGreaterThan(200);
  expect(b.samples[0]![1]).toBeGreaterThan(200);
  expect(a.audio).toBe(true);
  expect(a.rms).toBeLessThan(0.001);
  expect(c.rms).toBeGreaterThan(0.01);
});

test('相容即時匯出可以產生可播放的完整影片', async ({ page }) => {
  test.setTimeout(90000);
  await createProjectWith(page, ['photo.png']);
  await beginExport(page, 'realtime');
  const result = await inspect(page, 1);
  expect(result.duration).toBeGreaterThan(2.8);
  expect(result.duration).toBeLessThan(4);
  expect(result.bytes).toBeGreaterThan(1000);
  expect(result.audio).toBe(false);
});

test('主題與預覽偏好重開保留；同裝置續用不走還原流程', async ({ page }) => {
  await page.goto('./#/settings');
  await page.getByRole('button', { name: '同一台裝置，繼續使用', exact: true }).tap();
  await expect(page.getByTestId('welcome')).toHaveCount(0);
  await page.getByRole('radio', { name: '溫暖棕色', exact: true }).tap();
  await page.getByLabel('預覽品質').selectOption('720');
  await page.reload();
  await expandAllGroups(page);
  await expect(page.locator('html')).toHaveAttribute('data-theme', 'warm');
  await expect(page.getByLabel('預覽品質')).toHaveValue('720');
  await expect(page.getByTestId('welcome')).toHaveCount(0);
  await page.screenshot({ path: `${shots}/warm-theme.png` });
});
