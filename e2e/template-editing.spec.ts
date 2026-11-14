import { expect, test, type Page } from '@playwright/test';
import type { Project, VideoItem } from '../src/model/types';
import {
  createProjectWith,
  openTab,
  openTemplateCell,
  fixture,
  waitForPreviewReady,
  seekTo,
  exportFrame,
  isRed,
  isGreen,
  isBlue,
} from './helpers';
const current = (page: Page): Promise<Project> =>
  page.evaluate(() =>
    (window as unknown as { __videoclip: { project: () => Project } }).__videoclip.project(),
  );
async function makeTemplate(page: Page) {
  await openTab(page, '版型');
  await page
    .getByTestId('template-files')
    .setInputFiles(['tone-video.webm', 'solid-green.webm', 'solid-blue.webm'].map(fixture));
  await expect(page.locator('.busy')).toHaveCount(0);
  await waitForPreviewReady(page);
  await page.getByRole('button', { name: '套用多格版型', exact: true }).tap();
  await expect.poll(async () => (await current(page)).tracks.filter((t) => t.template).length).toBe(1);
}
test('點版型格子可有聲選段、起點連動終點、局部 undo/redo 與 X、多組互不覆寫', async ({ page }) => {
  await createProjectWith(page, ['solid-red.webm']);
  await makeTemplate(page);
  const original = (await current(page)).tracks.find((t) => t.template)!;
  let dialog = await openTemplateCell(page, 0);
  await dialog.getByLabel('每格素材名稱', { exact: true }).fill('現場演唱');
  await dialog.getByLabel('每格長度', { exact: true }).fill('1');
  await dialog.getByLabel('每格來源起點', { exact: true }).fill('1');
  await expect(dialog.getByLabel('每格來源終點', { exact: true })).toHaveValue('2');
  await dialog.getByRole('button', { name: '播放片段預覽', exact: true }).tap();
  await expect
    .poll(() => dialog.locator('video').evaluate((v: HTMLVideoElement) => !v.paused && !v.muted))
    .toBe(true);
  await dialog.getByRole('button', { name: '暫停片段預覽', exact: true }).tap();
  await dialog.getByRole('button', { name: 'undo', exact: true }).tap();
  await dialog.getByRole('button', { name: 'redo', exact: true }).tap();
  const left = (await dialog.locator('.source-preview-base').boundingBox())!,
    right = (await dialog.getByTestId('source-range').boundingBox())!;
  expect(left.x + left.width).toBeLessThanOrEqual(right.x);
  await page.screenshot({ path: 'docs/screenshots/editing/template-source-popup.png' });
  await dialog.getByRole('button', { name: '關閉且不儲存', exact: true }).tap();
  expect((await current(page)).tracks.find((t) => t.template)!.items).toEqual(original.items);
  dialog = await openTemplateCell(page, 0);
  await dialog.getByLabel('每格素材名稱', { exact: true }).fill('現場演唱');
  await dialog.getByRole('button', { name: '套用片段範圍', exact: true }).tap();
  expect((await current(page)).tracks.find((t) => t.template)!.items[0]!.name).toBe('現場演唱');
  await page.getByRole('button', { name: '＋ 新增另一組版型', exact: true }).tap();
  await page.getByRole('button', { name: '直式膠卷', exact: true }).tap();
  await page.getByRole('button', { name: '套用多格版型', exact: true }).tap();
  const groups = (await current(page)).tracks.filter((t) => t.template);
  expect(groups).toHaveLength(2);
  expect(groups.find((t) => t.id === original.id)!.items[0]!.name).toBe('現場演唱');
  await openTab(page, '圖層');
  await expect(page.getByTestId('layer-list')).toContainText('現場演唱');
});

test('輪序在同列、同時分列；已播格停最後一幀且靜音，輸出相同並可加入群組色塊', async ({ page }) => {
  test.setTimeout(120000);
  await createProjectWith(page, ['solid-red.webm']);
  await makeTemplate(page);
  for (let i = 0; i < 3; i++) {
    const dialog = await openTemplateCell(page, i);
    await dialog.getByLabel('每格長度', { exact: true }).fill('1');
    await dialog.getByRole('button', { name: '套用片段範圍', exact: true }).tap();
  }
  await openTab(page, '特效');
  await page.getByRole('button', { name: '輪序播放、播完停格', exact: true }).tap();
  let group = (await current(page)).tracks.find((t) => t.template)!;
  expect(group.items.map((i) => i.start)).toEqual([0, 1, 2]);
  expect(group.layout!.duration).toBe(3);
  await page.getByRole('button', { name: '展開版型素材', exact: true }).tap();
  await expect(page.locator(`[data-track-id="${group.id}"][data-template-child=true]`)).toHaveCount(1);
  await seekTo(page, 2.5);
  await expect
    .poll(() =>
      page
        .locator(`.pool video[data-item-id="${group.items[0]!.id}"]`)
        .evaluate((v: HTMLVideoElement) => v.paused && v.currentTime > 0.9 && v.currentTime < 1.05),
    )
    .toBe(true);
  const frame = await exportFrame(page, 2.5, [
    [0.5, 0.18],
    [0.5, 0.48],
    [0.5, 0.78],
  ]);
  expect(isRed(frame.samples[0]! as [number, number, number, number])).toBe(true);
  expect(isGreen(frame.samples[1]! as [number, number, number, number])).toBe(true);
  expect(isBlue(frame.samples[2]! as [number, number, number, number])).toBe(true);
  await page.screenshot({ path: 'docs/screenshots/editing/template-sequential-hold.png' });
  await page.getByRole('button', { name: '同時播放', exact: true }).tap();
  await expect(page.locator(`[data-track-id="${group.id}"][data-template-child=true]`)).toHaveCount(3);
  await page.locator('.template-playback-settings summary').tap();
  await page.getByRole('button', { name: '新增群組色塊', exact: true }).tap();
  await expect.poll(async () => (await current(page)).tracks.find((t) => t.template)!.items.length).toBe(4);
  group = (await current(page)).tracks.find((t) => t.template)!;
  expect((group.items[3] as VideoItem).slot).toBeDefined();
});
