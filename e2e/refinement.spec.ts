import { expect, test, type Page } from '@playwright/test';
import type { Project, VideoItem } from '../src/model/types';
import {
  createProjectWith,
  addOverlays,
  openTab,
  clips,
  samplePreview,
  isRed,
  isGreen,
  exportFrame,
  seekTo,
} from './helpers';
const shots = 'docs/screenshots/refinement';
async function capture(page: Page, options: { path: string }) {
  await expect(page.locator('.toast')).toHaveCount(0);
  await page.screenshot(options);
}

const current = (page: Page): Promise<Project> =>
  page.evaluate(() =>
    (window as unknown as { __videoclip: { project: () => Project } }).__videoclip.project(),
  );
async function slider(page: Page, label: string, value: number) {
  await page.getByRole('slider', { name: label, exact: true }).evaluate((el, v) => {
    Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value')!.set!.call(el, String(v));
    el.dispatchEvent(new Event('input', { bubbles: true }));
  }, value);
}
async function stroke(page: Page, testid: string, points: [number, number][]) {
  await page.getByTestId(testid).scrollIntoViewIfNeeded();
  const b = (await page.getByTestId(testid).boundingBox())!;
  await page.mouse.move(b.x + points[0]![0] * b.width, b.y + points[0]![1] * b.height);
  await page.mouse.down();
  for (const [x, y] of points.slice(1))
    await page.mouse.move(b.x + x * b.width, b.y + y * b.height, { steps: 4 });
  await page.mouse.up();
}

test('裁切後保留筆刷補缺角，橡皮擦去多餘區域，重開與輸出一致', async ({ page }) => {
  await createProjectWith(page, ['solid-red.webm']);
  await addOverlays(page, ['solid-green.webm']);
  await openTab(page, '剪輯');
  await page.getByRole('button', { name: '裁切', exact: true }).tap();
  await page.getByRole('button', { name: '自由描邊保留區域', exact: true }).tap();
  await stroke(page, 'crop-stage', [
    [0.05, 0.05],
    [0.48, 0.05],
    [0.48, 0.95],
    [0.05, 0.95],
    [0.05, 0.05],
  ]);
  await page.getByRole('button', { name: '保留筆刷', exact: true }).tap();
  await slider(page, '保留筆刷粗細', 20);
  await stroke(page, 'crop-stage', [
    [0.45, 0.5],
    [0.8, 0.5],
  ]);
  await page.getByRole('button', { name: '裁切橡皮擦', exact: true }).tap();
  await slider(page, '裁切橡皮擦粗細', 12);
  await stroke(page, 'crop-stage', [
    [0.3, 0.3],
    [0.3, 0.7],
  ]);
  await capture(page, { path: `${shots}/crop-refine.png` });
  await page.getByRole('button', { name: '套用裁切', exact: true }).tap();
  const item = (await current(page)).tracks[1]!.items[0] as VideoItem;
  expect(item.mask!.strokes).toHaveLength(2);
  await expect.poll(async () => isGreen(await samplePreview(page, 0.625, 0.5))).toBe(true);
  await expect.poll(async () => isRed(await samplePreview(page, 0.4, 0.5))).toBe(true);
  const frame = await exportFrame(page, 0, [
    [0.625, 0.5],
    [0.4, 0.5],
  ]);
  expect(isGreen(frame.samples[0]! as [number, number, number, number])).toBe(true);
  expect(isRed(frame.samples[1]! as [number, number, number, number])).toBe(true);
  await page.getByRole('link', { name: '回首頁', exact: true }).tap();
  await page.goBack();
  await expect(clips(page)).toHaveCount(2);
  await expect.poll(async () => isRed(await samplePreview(page, 0.4, 0.5))).toBe(true);
  await capture(page, { path: `${shots}/crop-refined-result.png` });
});

test('透明字塊、次級選單與深底前景可讀，裝飾距離使用像素', async ({ page }) => {
  await createProjectWith(page, ['solid-red.webm']);
  await openTab(page, '文字');
  await page.getByRole('button', { name: /新增文字/ }).tap();
  await page.getByRole('tab', { name: '字塊', exact: true }).tap();
  await page.getByRole('radio', { name: '圓角', exact: true }).tap();
  expect(
    (await current(page)).tracks.flatMap((t) => t.items).find((i) => i.type === 'text')!.card.box!.opacity,
  ).toBe(0);
  const categories = page.getByLabel('字塊分類');
  expect(
    await categories
      .locator('.active')
      .first()
      .evaluate((el) => getComputedStyle(el).backgroundColor),
  ).not.toBe(
    await page
      .getByRole('tab', { name: '字塊', exact: true })
      .evaluate((el) => getComputedStyle(el).backgroundColor),
  );
  await page.getByRole('button', { name: '字塊填滿顏色自訂', exact: true }).tap();
  await page.getByLabel('色彩 R', { exact: true }).fill('50');
  await page.getByLabel('色彩 G', { exact: true }).fill('80');
  await page.getByLabel('色彩 B', { exact: true }).fill('100');
  await page.getByRole('button', { name: '套用顏色', exact: true }).tap();
  expect(
    (await current(page)).tracks.flatMap((t) => t.items).find((i) => i.type === 'text')!.card.box,
  ).toMatchObject({ fill: '#325064', opacity: 1 });
  await capture(page, { path: `${shots}/box-submenu-and-fill.png` });
  await page.getByRole('tab', { name: '裝飾', exact: true }).tap();
  await page.getByRole('button', { name: '裝飾 波浪底線', exact: true }).tap();
  await slider(page, '波浪底線與文字距離', 120);
  await expect(
    page
      .locator('.slider-row')
      .filter({ has: page.getByRole('slider', { name: '波浪底線與文字距離', exact: true }) }),
  ).toContainText('+120 px');
  await page.getByRole('tablist', { name: '字卡設定' }).getByRole('tab', { name: '文字', exact: true }).tap();
  await page.getByRole('button', { name: '字體', exact: true }).tap();
  const selected = page.locator('.font-row.active');
  await expect(selected).toBeVisible();
  expect(await selected.evaluate((el) => getComputedStyle(el).color)).toBe('rgb(255, 250, 240)');
  await capture(page, { path: `${shots}/font-selected-contrast.png` });
});

test('毛筆與鉛筆畫出不同筆觸並可儲存為素材', async ({ page }) => {
  await createProjectWith(page, ['solid-blue.webm']);
  await openTab(page, '素材');
  await page.getByRole('button', { name: '＋ 畫畫', exact: true }).tap();
  await slider(page, '筆刷粗細', 45);
  await page.getByRole('button', { name: '毛筆', exact: true }).tap();
  await stroke(page, 'drawing-canvas', [
    [0.1, 0.2],
    [0.3, 0.35],
    [0.6, 0.2],
    [0.8, 0.4],
  ]);
  await page.getByRole('button', { name: '鉛筆', exact: true }).tap();
  await stroke(page, 'drawing-canvas', [
    [0.1, 0.65],
    [0.35, 0.5],
    [0.65, 0.75],
    [0.85, 0.6],
  ]);
  const count = await page.getByTestId('drawing-canvas').evaluate((el) => {
    const c = el as HTMLCanvasElement,
      data = c.getContext('2d')!.getImageData(0, 0, c.width, c.height).data;
    return data.some((v, i) => i % 4 === 3 && v > 0);
  });
  expect(count).toBe(true);
  await capture(page, { path: `${shots}/ink-pencil-brushes.png` });
  await page.getByRole('button', { name: '加入畫作', exact: true }).tap();
  await expect(clips(page)).toHaveCount(2);
});

test('音訊來源有縮圖，多組倒三角排除中間聲音但影片不縮短', async ({ page }) => {
  await createProjectWith(page, ['tone-video.webm']);
  await openTab(page, '音訊');
  await expect(page.locator('.audio-source img')).toBeVisible();
  const original = (await current(page)).tracks[0]!.items[0]!;
  await page.getByRole('button', { name: '聲音片段範圍', exact: true }).tap();
  const video = page.getByLabel('音訊對應影片');
  await expect(video).toBeVisible();
  const strip = page.locator('.source-thumbs');
  await strip.tap({ position: { x: (await strip.boundingBox())!.width * 0.5, y: 30 } });
  await page.getByRole('button', { name: '將目前前後 0.25 秒靜音', exact: true }).tap();
  await expect(page.locator('.source-marker')).toHaveCount(4);
  await expect.poll(() => video.evaluate((el) => (el as HTMLVideoElement).currentTime)).toBeCloseTo(1.5, 1);
  const box = (await strip.boundingBox())!;
  await strip.tap({ position: { x: box.width * 0.8, y: 30 } });
  await page.getByRole('button', { name: '將目前前後 0.25 秒靜音', exact: true }).tap();
  await expect(page.locator('.source-marker')).toHaveCount(6);
  await capture(page, { path: `${shots}/multi-audio-markers.png` });
  await page.getByRole('button', { name: '套用聲音選段', exact: true }).tap();
  const after = (await current(page)).tracks[0]!.items[0] as VideoItem;
  expect(after.audioRanges).toHaveLength(3);
  expect(after.start).toBe(original.start);
  expect(after.duration).toBe(original.duration);
  expect(after.trimIn).toBe((original as VideoItem).trimIn);
  await page.getByRole('button', { name: '聲音片段範圍', exact: true }).tap();
  await page.getByRole('button', { name: '移除第1段聲音', exact: true }).tap();
  await expect(page.locator('.source-marker')).toHaveCount(4);
  await page.getByRole('button', { name: '還原完整聲音', exact: true }).tap();
  await expect(page.locator('.source-marker')).toHaveCount(2);
  const marker = page.getByRole('button', { name: '來源起點標記', exact: true });
  await marker.focus();
  await page.keyboard.press('ArrowRight');
  await expect(page.locator('.audio-intervals')).toContainText('0.05');
  await page.getByRole('button', { name: '播放選段試聽', exact: true }).tap();
  await expect.poll(() => video.evaluate((el) => (el as HTMLVideoElement).paused)).toBe(false);
  await page.getByRole('button', { name: '暫停選段試聽', exact: true }).tap();
  await page.getByRole('button', { name: '取消', exact: true }).tap();
  await page.getByRole('link', { name: '回首頁', exact: true }).tap();
  await page.goBack();
  await expect(clips(page)).toHaveCount(1);
  expect(((await current(page)).tracks[0]!.items[0] as VideoItem).audioRanges).toHaveLength(3);
});

test('0 秒靠近圖層圖示，色塊不重疊時共用一層，浮動按鈕回到預覽', async ({ page }) => {
  await createProjectWith(page, ['solid-blue.webm']);
  const tick = (await page.locator('.tick').first().boundingBox())!,
    chip = (await page.locator('.track-chip').first().boundingBox())!;
  expect(tick.x - chip.x - chip.width).toBeLessThan(24);
  await openTab(page, '素材');
  await page.getByRole('button', { name: '留白色塊', exact: true }).tap();
  await page.getByRole('button', { name: '色塊顏色自訂', exact: true }).tap();
  await page.getByLabel('色彩 R', { exact: true }).fill('123');
  await page.getByRole('button', { name: '套用顏色', exact: true }).tap();
  await page.getByRole('button', { name: '加入色塊圖層', exact: true }).tap();
  await expect(clips(page)).toHaveCount(2);
  await seekTo(page, 3);
  await page.getByRole('button', { name: '加入色塊圖層', exact: true }).tap();
  await expect(clips(page)).toHaveCount(3);
  let p = await current(page);
  expect(p.tracks.filter((t) => t.name === '留白色塊')).toHaveLength(1);
  expect(p.tracks.find((t) => t.name === '留白色塊')!.items).toHaveLength(2);
  await seekTo(page, 0);
  await page.getByRole('button', { name: '加入色塊圖層', exact: true }).tap();
  await expect(clips(page)).toHaveCount(4);
  p = await current(page);
  expect(p.tracks.filter((t) => t.name === '留白色塊')).toHaveLength(2);
  await page.locator('.bottombar').scrollIntoViewIfNeeded();
  await capture(page, { path: `${shots}/shared-solids-and-return.png` });
  await page.locator('.editor').evaluate((el) => {
    el.scrollTop = Math.max(1, el.scrollTop - 80);
  });
  await page.getByRole('button', { name: '回到最上方預覽', exact: true }).tap();
  await expect.poll(() => page.locator('.editor').evaluate((el) => el.scrollTop)).toBe(0);
});

for (const theme of ['dark', 'mono', 'light', 'fresh', 'warm', 'beige'])
  test(`自訂顏色與選取字體/圖層在 ${theme} 主題有足夠對比`, async ({ page }) => {
    await page.addInitScript(
      (t) => localStorage.setItem('lm2-preferences', JSON.stringify({ theme: t })),
      theme,
    );
    await createProjectWith(page, ['solid-red.webm']);
    await openTab(page, '文字');
    await page.getByRole('button', { name: /新增文字/ }).tap();
    const contrast = async (selector: string) =>
      page
        .locator(selector)
        .first()
        .evaluate((el) => {
          const s = getComputedStyle(el);
          const lum = (color: string) => {
            const c = color
              .match(/[\d.]+/g)!
              .slice(0, 3)
              .map(Number)
              .map((v) => (v / 255 <= 0.04045 ? v / 255 / 12.92 : ((v / 255 + 0.055) / 1.055) ** 2.4));
            return c[0]! * 0.2126 + c[1]! * 0.7152 + c[2]! * 0.0722;
          };
          const a = lum(s.color),
            b = lum(s.backgroundColor);
          return (Math.max(a, b) + 0.05) / (Math.min(a, b) + 0.05);
        });
    expect(await contrast('.color-custom-button')).toBeGreaterThanOrEqual(4.5);
    await page.getByRole('button', { name: '字體', exact: true }).tap();
    expect(await contrast('.font-row.active')).toBeGreaterThanOrEqual(4.5);
    await capture(page, { path: `${shots}/font-${theme}.png` });
    const image = page.locator('[data-font-key="fancy-free"] .font-prev-img');
    await image.scrollIntoViewIfNeeded();
    const imageContrast = await image.evaluate(async (el) => {
      const img = el as HTMLImageElement;
      await img.decode();
      const c = document.createElement('canvas');
      c.width = img.naturalWidth;
      c.height = img.naturalHeight;
      const ctx = c.getContext('2d')!;
      ctx.filter = getComputedStyle(img).filter;
      ctx.drawImage(img, 0, 0);
      const data = ctx.getImageData(0, 0, c.width, c.height).data;
      let ink: number[] = [];
      for (let i = 0; i < data.length; i += 4)
        if (data[i + 3]! > 240) {
          ink = [data[i]!, data[i + 1]!, data[i + 2]!];
          break;
        }
      const lum = (c: number[]) => {
        const l = c.map((v) => (v / 255 <= 0.04045 ? v / 255 / 12.92 : ((v / 255 + 0.055) / 1.055) ** 2.4));
        return l[0]! * 0.2126 + l[1]! * 0.7152 + l[2]! * 0.0722;
      };
      const bg = getComputedStyle(img.closest('.sheet')!)
          .backgroundColor.match(/[\d.]+/g)!
          .slice(0, 3)
          .map(Number),
        a = lum(ink),
        b = lum(bg);
      return (Math.max(a, b) + 0.05) / (Math.min(a, b) + 0.05);
    });
    expect(imageContrast).toBeGreaterThanOrEqual(4.5);
    await capture(page, { path: `${shots}/font-image-${theme}.png` });
    await page.locator('.font-row.active').tap();
    await openTab(page, '圖層');
    expect(await contrast('.layer-row.selected')).toBeGreaterThanOrEqual(4.5);
    await capture(page, { path: `${shots}/layers-${theme}.png` });
    await page.getByRole('button', { name: '濾色', exact: true }).tap();
    await expect(page.getByTestId('blend-help')).toContainText('黑色會消失');
  });

test('匯出保留兩側聲音與中間靜音，畫面長度不變', async ({ page }) => {
  test.setTimeout(120000);
  await createProjectWith(page, ['tone-video.webm']);
  await openTab(page, '音訊');
  await page.getByRole('button', { name: '聲音片段範圍', exact: true }).tap();
  const strip = page.locator('.source-thumbs');
  await strip.tap({ position: { x: (await strip.boundingBox())!.width / 2, y: 30 } });
  await page.getByRole('button', { name: '將目前前後 0.25 秒靜音', exact: true }).tap();
  await page.getByRole('button', { name: '套用聲音選段', exact: true }).tap();
  await page.getByRole('button', { name: '匯出影片', exact: true }).tap();
  await page.getByLabel('匯出解析度').selectOption('360');
  await page.getByLabel('匯出影格率').selectOption('24');
  await page.getByRole('button', { name: '開始匯出', exact: true }).tap();
  await expect(page.getByRole('link', { name: '下載影片', exact: true })).toBeVisible({ timeout: 90000 });
  const url = (await page.getByLabel('匯出影片預覽').getAttribute('src'))!;
  const energies = await page.evaluate(async (url) => {
    const hook = (
      window as unknown as {
        __videoclip: {
          inspectMovie: (
            url: string,
            t: number,
            p: [number, number][],
          ) => Promise<{ rms: number; duration: number; samples: number[][] }>;
        };
      }
    ).__videoclip;
    const result = [];
    for (const t of [0.5, 1.45, 2.2]) result.push(await hook.inspectMovie(url, t, [[0.5, 0.5]]));
    return result;
  }, url);
  expect(energies[0]!.rms).toBeGreaterThan(0.01);
  expect(energies[1]!.rms).toBeLessThan(0.001);
  expect(energies[2]!.rms).toBeGreaterThan(0.01);
  expect(energies[1]!.duration).toBeCloseTo(3, 1);
  expect(energies[1]!.samples[0]![0]).toBeGreaterThan(200);
  await capture(page, { path: `${shots}/audio-ranges-export.png` });
});
