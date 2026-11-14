import type { Project } from '../src/model/types';
import { expect, test } from '@playwright/test';
import { createProjectWith, openTab, setCropOffset } from './helpers';

test('裁切工具同列、筆刷獨立保留、縮放不丟座標、undo/redo 與 X 捨棄', async ({ page }) => {
  await createProjectWith(page, ['solid-red.webm']);
  await openTab(page, '剪輯');
  await page.getByRole('button', { name: '裁切', exact: true }).tap();
  const tools = page.locator('.crop-tools .chip');
  expect(await tools.count()).toBe(4);
  const boxes = await tools.evaluateAll((es) =>
    es.map((e) => ({ y: e.getBoundingClientRect().y, h: e.getBoundingClientRect().height })),
  );
  expect(Math.max(...boxes.map((b) => b.y)) - Math.min(...boxes.map((b) => b.y))).toBeLessThan(2);
  await page.getByRole('button', { name: '筆刷', exact: true }).tap();
  await setCropOffset(page);
  const c = page.locator('.crop-result'),
    before = await c.elementHandle();
  const stage = page.getByTestId('crop-stage');
  await stage.scrollIntoViewIfNeeded();
  const b = (await stage.boundingBox())!;
  await page.mouse.move(b.x + b.width * 0.5, b.y + b.height * 0.5);
  await page.mouse.down();
  await page.mouse.move(b.x + b.width * 0.6, b.y + b.height * 0.5, { steps: 4 });
  await page.mouse.up();
  await page.getByRole('button', { name: '放大裁切預覽', exact: true }).tap();
  await page.getByRole('button', { name: 'undo', exact: true }).tap();
  await page.getByRole('button', { name: 'redo', exact: true }).tap();
  expect(await c.evaluate((el, original) => el === original, before)).toBe(true);
  await page.screenshot({ path: 'docs/screenshots/editing/crop-tools-zoom.png' });
  await page.getByRole('button', { name: '關閉且不儲存', exact: true }).tap();
  expect(
    await page.evaluate(
      () =>
        (
          (window as unknown as { __videoclip: { project: () => Project } }).__videoclip.project().tracks[0]!
            .items[0] as import('../src/model/types').VideoItem
        ).mask,
    ),
  ).toBeUndefined();
});

test('選段預覽由播放按鈕啟用原音，秒數及 undo/redo 在同列', async ({ page }) => {
  await createProjectWith(page, ['tone-video.webm']);
  await openTab(page, '剪輯');
  await page.getByRole('button', { name: '片段範圍', exact: true }).tap();
  await page.getByRole('button', { name: '播放片段預覽', exact: true }).tap();
  await expect
    .poll(() =>
      page.locator('video.range-preview').evaluate((el: HTMLVideoElement) => !el.paused && !el.muted),
    )
    .toBe(true);
  await expect(
    page.locator('.source-playback-row').getByRole('button', { name: 'undo', exact: true }),
  ).toBeVisible();
  await page.getByRole('button', { name: '關閉且不儲存', exact: true }).tap();
  await page.getByRole('tab', { name: '剪輯', exact: true }).tap();
  await expect(page.getByRole('button', { name: '片段範圍', exact: true })).toBeVisible();
});
