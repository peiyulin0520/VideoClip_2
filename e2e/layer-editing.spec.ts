import { expect, test, type Page } from '@playwright/test';
import type { Project } from '../src/model/types';
import {
  createProjectWith,
  addOverlays,
  openTab,
  selectedItemId,
  pinchSelection,
  isRed,
  isBlue,
  samplePreview,
  exportFrame,
  dragTimelineItem,
  fixture,
} from './helpers';
const shots = 'docs/screenshots/layer-editing';
const current = (page: Page): Promise<Project> =>
  page.evaluate(() =>
    (window as unknown as { __videoclip: { project: () => Project } }).__videoclip.project(),
  );
async function timeline(page: Page) {
  await page.getByRole('button', { name: '縮小時間軸', exact: true }).tap();
  await page.getByRole('button', { name: '縮小時間軸', exact: true }).tap();
  await page.locator('.timeline').evaluate((el) => el.scrollIntoView({ block: 'start' }));
}

test('六種主題的深色媒體按鈕與文字都清楚，米色可從設定選取並保留', async ({ page }) => {
  test.setTimeout(90000);
  await createProjectWith(page, ['solid-red.webm']);
  const editorUrl = page.url();
  for (const theme of ['dark', 'mono', 'light', 'fresh', 'warm', 'beige']) {
    await page.getByRole('link', { name: '回首頁', exact: true }).tap();
    await page.getByRole('link', { name: '設定', exact: true }).tap();
    await page.getByLabel('網頁風格').selectOption(theme);
    await page.goto(editorUrl);
    await expect(page.getByTestId('track')).toHaveCount(1);
    await expect(page.locator('html')).toHaveAttribute('data-theme', theme);
    await expect.poll(async () => isRed(await samplePreview(page, 0.5, 0.5))).toBe(true);
    const contrast = await page.evaluate(() => {
      const luminance = (color: string) => {
        const rgb = color
          .match(/[\d.]+/g)!
          .map(Number)
          .slice(0, 3)
          .map((n) => {
            const c = n / 255;
            return c <= 0.04045 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4;
          });
        return rgb[0]! * 0.2126 + rgb[1]! * 0.7152 + rgb[2]! * 0.0722;
      };
      return [
        '.track-chip',
        '.ratio-btn',
        '.preview-expand',
        '.export-button',
        '.clip-label',
        '.tab.active',
      ].map((selector) => {
        const s = getComputedStyle(document.querySelector(selector)!);
        const background =
          selector === '.clip-label'
            ? getComputedStyle(document.querySelector('.clip')!, '::before').backgroundColor
            : selector === '.tab.active'
              ? getComputedStyle(document.querySelector('.tabs')!).backgroundColor
              : s.backgroundColor;
        const a = luminance(s.color),
          b = luminance(background);
        return { selector, ratio: (Math.max(a, b) + 0.05) / (Math.min(a, b) + 0.05) };
      });
    });
    for (const entry of contrast)
      expect(entry.ratio, `${theme} ${entry.selector}`).toBeGreaterThanOrEqual(4.5);
    await page.screenshot({ path: `${shots}/theme-${theme}.png` });
  }
});

test('預覽可直接觸控選取原影片並用雙指縮放，露出的底層也可直接點選', async ({ page }) => {
  await createProjectWith(page, ['solid-red.webm']);
  const id = (await current(page)).tracks[0]!.items[0]!.id;
  await page.getByTestId('stage').tap();
  expect(await selectedItemId(page)).toBe(id);
  await pinchSelection(page, 1.5);
  expect((await current(page)).tracks[0]!.items[0]!.transform.scale).toBeGreaterThan(1.3);
  await addOverlays(page, ['solid-blue.webm']);
  await page.getByRole('button', { name: '回到預覽', exact: true }).tap();
  const stage = page.getByTestId('stage'),
    box = (await stage.boundingBox())!;
  await stage.tap({ position: { x: box.width * 0.08, y: box.height * 0.08 } });
  expect(await selectedItemId(page)).toBe(id);
  const blueId = (await current(page)).tracks[1]!.items[0]!.id;
  await addOverlays(page, ['animated-sticker.gif']);
  await page.getByRole('button', { name: '回到預覽', exact: true }).tap();
  await expect.poll(async () => isRed(await samplePreview(page, 0.5, 0.5))).toBe(true);
  await stage.tap({ position: { x: box.width * 0.27, y: box.height * 0.37 } });
  expect(await selectedItemId(page)).toBe(blueId); // Transparent sticker corner exposes the blue video.
  await stage.tap();
  expect(await selectedItemId(page)).toBe((await current(page)).tracks[2]!.items[0]!.id);
  await page.screenshot({ path: `${shots}/direct-preview-selection.png` });
});

test('長按可選被遮住的影像，暫時置頂可編輯，完成與匯出仍使用原始層次', async ({ page }) => {
  await createProjectWith(page, ['solid-red.webm']);
  await addOverlays(page, ['solid-green.webm', 'solid-blue.webm']);
  await page.getByRole('button', { name: '回到預覽', exact: true }).tap();
  const before = await current(page),
    ids = before.tracks.map((t) => t.id);
  const box = (await page.getByTestId('stage').boundingBox())!;
  const session = await page.context().newCDPSession(page);
  await session.send('Input.dispatchTouchEvent', {
    type: 'touchStart',
    touchPoints: [{ x: box.x + box.width / 2, y: box.y + box.height / 2, id: 1 }],
  });
  await page.waitForTimeout(650);
  await session.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] });
  await session.detach();
  await expect(page.getByRole('dialog', { name: '選取被遮住的素材' })).toBeVisible();
  await expect(page.getByRole('radio', { name: /^暫時編輯 / })).toHaveCount(3);
  await page.screenshot({ path: `${shots}/covered-layer-picker.png` });
  await page.getByRole('radio', { name: '暫時編輯 solid-red.webm', exact: true }).tap();
  await expect(page.getByTestId('preview-isolation')).toBeVisible();
  await expect.poll(async () => isRed(await samplePreview(page, 0.5, 0.5))).toBe(true);
  expect((await current(page)).tracks).toEqual(before.tracks);
  const frame = await exportFrame(page, 0.5, [[0.5, 0.5]]);
  expect(isBlue(frame.samples[0] as [number, number, number, number])).toBe(true);
  await pinchSelection(page, 0.8);
  expect((await current(page)).tracks[0]!.items[0]!.transform.scale).toBeLessThan(0.9);
  await page.screenshot({ path: `${shots}/temporary-preview-lift.png` });
  await page.getByRole('button', { name: '完成', exact: true }).tap();
  await expect(page.getByTestId('preview-isolation')).toHaveCount(0);
  await expect.poll(async () => isBlue(await samplePreview(page, 0.5, 0.5))).toBe(true);
  expect((await current(page)).tracks.map((t) => t.id)).toEqual(ids);
});

test('長按單一影像跨軌並改時間，同軌其他素材不動，一步復原可回復', async ({ page }) => {
  await createProjectWith(page, ['clip-a.webm', 'clip-b.webm']);
  await addOverlays(page, ['photo.png']);
  await timeline(page);
  const before = await current(page),
    source = before.tracks[0]!,
    target = before.tracks[1]!;
  const clip = page.locator(`.clip[data-item-id="${source.items[0]!.id}"]`),
    a = (await clip.boundingBox())!;
  const b = (await page.locator(`[data-track-id="${target.id}"]`).boundingBox())!;
  await dragTimelineItem(page, clip, 4 * (60 / 1.5 / 1.5), b.y + b.height / 2 - a.y - a.height / 2);
  await expect.poll(async () => (await current(page)).tracks[1]!.items.length).toBe(2);
  let now = await current(page);
  expect(now.tracks[0]!.items).toEqual([source.items[1]!]);
  expect(now.tracks[1]!.items.find((it) => it.id === source.items[0]!.id)!.start).toBeCloseTo(4, 1);
  await page.screenshot({ path: `${shots}/independent-clip-transfer.png` });
  await page.getByRole('button', { name: '復原', exact: true }).tap();
  now = await current(page);
  expect(now.tracks).toEqual(before.tracks);
});

test('不同類型禁止混放，字卡可拖到原底層以下建立字卡專層', async ({ page }) => {
  await createProjectWith(page, ['clip-a.webm', 'clip-b.webm']);
  await addOverlays(page, ['photo.png']);
  await openTab(page, '文字');
  await page.getByRole('button', { name: /新增文字/ }).tap();
  await openTab(page, '音訊');
  await page.getByTestId('music-files').setInputFiles(fixture('music.wav'));
  await expect(page.getByTestId('track')).toHaveCount(4);
  await timeline(page);
  const before = await current(page),
    id = before.tracks[0]!.items[0]!.id;
  const source = page.locator(`.clip[data-item-id="${id}"]`),
    a = (await source.boundingBox())!;
  const audio = before.tracks.find((t) => t.kind === 'audio')!,
    b = (await page.locator(`[data-track-id="${audio.id}"]`).boundingBox())!;
  await dragTimelineItem(page, source, 0, b.y + b.height / 2 - a.y - a.height / 2, async () => {
    await expect(page.getByTestId('item-drop-hint')).toHaveAttribute('data-valid', 'false');
    await page.screenshot({ path: `${shots}/reject-mixed-lane.png` });
  });
  expect((await current(page)).tracks).toEqual(before.tracks);
  const text = before.tracks.find((t) => t.kind === 'text')!,
    textId = text.items[0]!.id;
  const textClip = page.locator(`.clip[data-item-id="${textId}"]`),
    c = (await textClip.boundingBox())!;
  const lowest = (await page.getByTestId('track').last().boundingBox())!;
  await dragTimelineItem(page, textClip, 0, lowest.y + lowest.height + 3 - c.y - c.height / 2);
  await expect.poll(async () => (await current(page)).tracks[0]!.items[0]?.id).toBe(textId);
  const now = await current(page);
  expect(now.tracks[0]!.kind).toBe('text');
  expect(now.tracks[1]!.kind).toBe('main');
  for (const track of now.tracks)
    for (const item of track.items) {
      if (track.kind === 'text') expect(item.type).toBe('text');
      else if (track.kind === 'audio') expect(item.type).toBe('audio');
      else expect(['video', 'image']).toContain(item.type);
    }
  await page.screenshot({ path: `${shots}/typed-new-lane-below-image.png` });
});
