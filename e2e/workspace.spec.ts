import { expect, test, type Page } from '@playwright/test';
import type { Project } from '../src/model/types';
import { createProjectWith, addOverlays, openTab } from './helpers';
const shots = 'docs/screenshots/workspace';
async function layers(page: Page) {
  await createProjectWith(page, ['solid-blue.webm']);
  await addOverlays(
    page,
    Array.from({ length: 12 }, () => 'photo.png'),
  );
  await expect(page.getByTestId('track')).toHaveCount(13);
  await page.getByRole('button', { name: '回到預覽', exact: true }).tap();
}
async function swipe(page: Page, x: number, y: number, dx: number, dy: number) {
  const cdp = await page.context().newCDPSession(page);
  await cdp.send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: [{ x, y, id: 1 }] });
  for (let i = 1; i <= 12; i++)
    await cdp.send('Input.dispatchTouchEvent', {
      type: 'touchMove',
      touchPoints: [{ x: x + (dx * i) / 12, y: y + (dy * i) / 12, id: 1 }],
    });
  await cdp.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] });
  await cdp.detach();
}
const scrollTop = (page: Page) => page.locator('.editor').evaluate((el) => el.scrollTop);

test('十三層在整頁依序展開；手指捲動時預覽離開畫面，時間軸沒有狹小的垂直捲動區', async ({ page }) => {
  test.setTimeout(60000);
  await layers(page);
  const preview = page.locator('.stage-wrap'),
    first = (await preview.boundingBox())!;
  expect(first.height).toBeLessThan(page.viewportSize()!.height * 0.32);
  const dimensions = await page
    .getByTestId('timeline-scroll')
    .evaluate((el) => ({ inner: el.clientHeight, content: el.scrollHeight }));
  expect(dimensions.inner).toBeGreaterThan(600);
  expect(dimensions.content - dimensions.inner).toBeLessThanOrEqual(1);
  await page.screenshot({ path: `${shots}/compact-preview.png` });
  await swipe(page, 20, first.y + first.height * 0.7, 0, -180);
  await expect.poll(() => scrollTop(page)).toBeGreaterThan(50);
  expect((await preview.boundingBox())!.y).toBeLessThan(first.y - 50);
  const row = page.getByTestId('track').last();
  await row.evaluate((el) => el.scrollIntoView({ block: 'center' }));
  const rowBox = (await row.boundingBox())!,
    tools = (await page.locator('.bottombar').boundingBox())!;
  expect(rowBox.y).toBeGreaterThanOrEqual((await page.locator('.playbar').boundingBox())!.y + 44);
  expect(rowBox.y + rowBox.height).toBeLessThanOrEqual(page.viewportSize()!.height);
  expect(tools.y).toBeGreaterThanOrEqual(rowBox.y + rowBox.height);
  await page.screenshot({ path: `${shots}/all-layers-page.png` });
});

test('查看圖層、工具與回到預覽可直接切換，填文字不會被拉回時間軸', async ({ page }) => {
  test.setTimeout(60000);
  await layers(page);
  await page.getByRole('button', { name: '查看全部圖層', exact: true }).tap();
  await expect.poll(() => scrollTop(page)).toBeGreaterThan(100);
  await page.getByRole('button', { name: '編輯工具', exact: true }).tap();
  await openTab(page, '文字');
  await page.getByRole('button', { name: /新增文字/ }).tap();
  const input = page.getByLabel('文字內容');
  await input.scrollIntoViewIfNeeded();
  await input.fill('每一層都看得清楚');
  const p: Project = await page.evaluate(() =>
    (window as unknown as { __videoclip: { project: () => Project } }).__videoclip.project(),
  );
  expect(
    p.tracks.some((t) =>
      t.items.some((it) => it.type === 'text' && it.card.runs[0]?.text === '每一層都看得清楚'),
    ),
  ).toBe(true);
  await page.screenshot({ path: `${shots}/editing-tools.png` });
  const inputBox = (await input.boundingBox())!;
  expect(inputBox.y).toBeGreaterThanOrEqual((await page.locator('.playbar').boundingBox())!.y + 44);
  expect(inputBox.y + inputBox.height).toBeLessThanOrEqual(page.viewportSize()!.height);
  await page.getByRole('button', { name: '回到預覽', exact: true }).tap();
  await expect.poll(() => scrollTop(page)).toBe(0);
  const compact = (await page.getByTestId('stage').boundingBox())!.height;
  await page.getByRole('button', { name: '放大預覽', exact: true }).tap();
  await expect
    .poll(async () => (await page.getByTestId('stage').boundingBox())!.height)
    .toBeGreaterThan(compact * 2);
  await page.getByRole('button', { name: '縮回預覽', exact: true }).tap();
  await expect
    .poll(async () => (await page.getByTestId('stage').boundingBox())!.height)
    .toBeCloseTo(compact, 0);
});

test('上下查看圖層與左右移動播放頭各自獨立，狹窄短螢幕仍可操作工具', async ({ page }) => {
  test.setTimeout(60000);
  await page.setViewportSize({ width: 320, height: 568 });
  await layers(page);
  await page
    .getByTestId('track')
    .nth(6)
    .evaluate((el) => el.scrollIntoView({ block: 'center' }));
  const row = (await page.getByTestId('track').nth(6).boundingBox())!,
    before = await scrollTop(page);
  await swipe(page, 280, row.y + row.height / 2, -130, 0);
  await expect
    .poll(() => page.getByTestId('timeline-scroll').evaluate((el) => el.scrollLeft))
    .toBeGreaterThan(30);
  expect(Math.abs((await scrollTop(page)) - before)).toBeLessThan(5);
  const w = await page
    .locator('.editor')
    .evaluate((el) => ({ content: el.scrollWidth, view: el.clientWidth }));
  expect(w.content).toBeLessThanOrEqual(w.view + 1);
  await page.getByRole('button', { name: '編輯工具', exact: true }).tap();
  await expect(page.getByRole('tab', { name: '剪輯', exact: true })).toBeInViewport();
  await page.screenshot({ path: `${shots}/narrow-screen-tools.png` });
});

test('功能設定也在整頁展開，從字塊設定滑動會帶動整頁而非小面板', async ({ page }) => {
  await createProjectWith(page, ['solid-blue.webm']);
  await openTab(page, '文字');
  await page.getByRole('button', { name: /新增文字/ }).tap();
  await page.getByRole('tab', { name: '字塊', exact: true }).tap();
  await page.getByRole('radio', { name: '方形', exact: true }).tap();
  const panel = page.locator('.bottombar > .panel');
  const sizes = await panel.evaluate((el) => ({
    height: el.clientHeight,
    content: el.scrollHeight,
    overflow: getComputedStyle(el).overflowY,
  }));
  expect(sizes.height).toBeGreaterThan(600);
  expect(sizes.content - sizes.height).toBeLessThanOrEqual(1);
  expect(sizes.overflow).toBe('visible');
  const radio = page.getByRole('radio', { name: '方形', exact: true });
  await radio.evaluate((el) => el.scrollIntoView({ block: 'center' }));
  const box = (await radio.boundingBox())!,
    before = await scrollTop(page);
  await swipe(page, box.x + box.width / 2, box.y + box.height / 2, 0, -100);
  await expect.poll(() => scrollTop(page)).toBeGreaterThan(before + 25);
  expect(await panel.evaluate((el) => el.scrollTop)).toBe(0);
  const final = page.getByRole('slider', { name: '內距 下', exact: true });
  await final.scrollIntoViewIfNeeded();
  await expect(final).toBeInViewport();
  await page.screenshot({ path: `${shots}/single-page-controls.png` });
  await page.getByRole('button', { name: '回到預覽', exact: true }).tap();
  await expect.poll(() => scrollTop(page)).toBe(0);
});
