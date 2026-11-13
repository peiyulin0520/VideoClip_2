import { expect, test, type Page } from '@playwright/test';
import { createProjectWith, openTab, selectedItemId } from './helpers';
import type { Project, TextItem } from '../src/model/types';

const current = (page: Page): Promise<Project> =>
  page.evaluate(() =>
    (window as unknown as { __videoclip: { project: () => Project } }).__videoclip.project(),
  );
async function assertUiType(page: Page) {
  const result = await page.evaluate(() => {
    const notes = '.hint,.sheet-msg,.empty-note,.note,[role="note"]';
    const bad: string[] = [];
    let checked = 0;
    for (const root of Array.from(document.querySelectorAll('#root,.sheet'))) {
      const walk = document.createTreeWalker(root, NodeFilter.SHOW_TEXT);
      while (walk.nextNode()) {
        const node = walk.currentNode,
          el = node.parentElement;
        if (!el || !node.textContent?.trim()) continue;
        const range = document.createRange();
        range.selectNodeContents(node);
        if (!range.getBoundingClientRect().width || getComputedStyle(el).visibility === 'hidden') continue;
        const expected = el.closest('.timeline')
          ? el.closest('.family-toggle small,.clip-audio')
            ? 9
            : 11
          : el.closest(notes)
            ? 11
            : 14;
        const size = parseFloat(getComputedStyle(el).fontSize);
        checked++;
        const style = getComputedStyle(el);
        if (!(parseFloat(style.letterSpacing) < 0))
          bad.push(`Tracking: ${node.textContent.trim().slice(0, 20)}`);
        if (parseFloat(style.lineHeight) / size > 1.35)
          bad.push(`Leading: ${node.textContent.trim().slice(0, 20)}`);
        if (size !== expected)
          bad.push(`${el.tagName}.${el.className}: ${node.textContent.trim().slice(0, 35)} (${size})`);
      }
      for (const el of Array.from(root.querySelectorAll('input,select,textarea'))) {
        if (!el.getClientRects().length) continue;
        if (parseFloat(getComputedStyle(el).fontSize) !== 14) bad.push(`${el.tagName}: form text differs`);
      }
    }
    return { checked, bad };
  });
  expect(result.checked).toBeGreaterThan(0);
  expect(result.bad).toEqual([]);
}
async function shot(page: Page, name: string) {
  await expect(page.locator('.toast')).toHaveCount(0);
  await page.screenshot({ path: `docs/screenshots/uniform-type/${name}.png` });
}
test('操作介面14px、註解11px、時間軸維持較小字；框內距與窄螢幕仍可讀', async ({ page }) => {
  test.setTimeout(60000);
  await createProjectWith(page, ['tone-video.webm'], false);
  await openTab(page, '文字');
  await page.getByRole('button', { name: /新增文字/ }).tap();
  await expect(page.getByRole('textbox', { name: '文字內容', exact: true })).toBeVisible();
  const id = await selectedItemId(page);
  const before = (await current(page)).tracks.flatMap((t) => t.items).find((it) => it.id === id) as TextItem;
  await page.getByRole('button', { name: /^展開時間軸/ }).tap();
  await assertUiType(page);
  await page.getByRole('button', { name: '展開影像群組', exact: true }).tap();
  await page.getByRole('button', { name: '展開文字群組', exact: true }).tap();
  await assertUiType(page);
  await page.locator('.timeline').scrollIntoViewIfNeeded();
  await shot(page, 'small-timeline-labels');
  await page.getByRole('button', { name: /^收合時間軸/ }).tap();
  await assertUiType(page);
  const padding = await page.getByRole('textbox', { name: '文字內容', exact: true }).evaluate((el) => {
    const s = getComputedStyle(el);
    return [parseFloat(s.paddingTop), parseFloat(s.paddingLeft)];
  });
  expect(padding).toEqual([4, 6]);
  const chip = page
    .getByRole('tablist', { name: '字卡設定', exact: true })
    .getByRole('tab', { name: '文字', exact: true });
  expect(await chip.evaluate((el) => parseFloat(getComputedStyle(el).paddingLeft))).toBe(6);
  expect((await chip.boundingBox())!.height).toBeGreaterThanOrEqual(44);
  await page.getByRole('textbox', { name: '文字內容', exact: true }).scrollIntoViewIfNeeded();
  await shot(page, 'equal-type-and-tight-text-box');
  await page.setViewportSize({ width: 320, height: 700 });
  await page.locator('.playbar').scrollIntoViewIfNeeded();
  await assertUiType(page);
  expect(
    await page.locator('.playbar').evaluate((el) => el.scrollWidth - el.clientWidth),
  ).toBeLessThanOrEqual(1);
  const time = (await page.getByTestId('time').boundingBox())!;
  expect(time.height).toBeLessThanOrEqual(36);
  for (const button of await page.locator('.playbar button').all()) {
    const b = (await button.boundingBox())!;
    expect(b.width).toBeGreaterThanOrEqual(44);
    expect(b.height).toBeGreaterThanOrEqual(44);
    expect(b.x + b.width <= time.x + 1 || b.x >= time.x + time.width - 1).toBe(true);
  }
  await shot(page, 'uniform-timeline-and-playbar-320');
  await page.setViewportSize({ width: 390, height: 664 });
  await openTab(page, '圖層');
  await page.getByRole('button', { name: '定格細部調整', exact: true }).tap();
  await assertUiType(page);
  await shot(page, 'uniform-popup-and-notes');
  await page.getByRole('button', { name: '完成定格', exact: true }).tap();
  const after = (await current(page)).tracks.flatMap((t) => t.items).find((it) => it.id === id) as TextItem;
  expect(after.card).toEqual(before.card);
  await page.getByRole('link', { name: '回首頁', exact: true }).tap();
  await expect(page.getByTestId('project-card')).toBeVisible();
  await assertUiType(page);
  await page.getByRole('link', { name: '設定', exact: true }).tap();
  await expect(page.getByRole('heading', { name: '設定', exact: true })).toBeVisible();
  await assertUiType(page);
  await shot(page, 'uniform-home-and-settings');
});
