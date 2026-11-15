import { expect, test, type Page } from '@playwright/test';
import type { Project } from '../src/model/types';
import { createProjectWith, openTab, seekTo, waitForPreviewReady, exportFrame } from './helpers';
const current = (page: Page): Promise<Project> =>
  page.evaluate(() =>
    (window as unknown as { __videoclip: { project: () => Project } }).__videoclip.project(),
  );
async function slider(page: Page, name: string, value: number) {
  await page.getByRole('slider', { name, exact: true }).evaluate((el, v) => {
    Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value')!.set!.call(el, String(v));
    el.dispatchEvent(new Event('input', { bubbles: true }));
  }, value);
}
async function shot(page: Page, name: string) {
  await expect(page.locator('.toast')).toHaveCount(0);
  await page.screenshot({ path: `docs/screenshots/effects-caption/${name}.png` });
}
test('刪除素材時連同其畫面特效與標記移除，復原及重做一起恢復或移除', async ({ page }) => {
  await createProjectWith(page, ['solid-red.webm', 'solid-green.webm']);
  const id = (await current(page)).tracks[0]!.items[0]!.id;
  await page.locator(`.clip[data-item-id="${id}"]`).tap();
  await openTab(page, '特效');
  await page.getByRole('tab', { name: '影片特效', exact: true }).tap();
  await page.getByRole('button', { name: '黑白電影', exact: true }).tap();
  expect((await current(page)).effects![0]!.ownerId).toBe(id);
  await expect(page.getByTestId('timeline-effect-badge')).toHaveCount(1);
  await openTab(page, '剪輯');
  await page.getByRole('button', { name: '刪除', exact: true }).tap();
  expect((await current(page)).effects).toHaveLength(0);
  await expect(page.getByTestId('timeline-effect-badge')).toHaveCount(0);
  await page.getByRole('button', { name: '復原', exact: true }).tap();
  expect((await current(page)).effects).toHaveLength(1);
  await expect(page.getByTestId('timeline-effect-badge')).toHaveCount(1);
  await page.getByRole('button', { name: '重做', exact: true }).tap();
  await expect(page.getByTestId('timeline-effect-badge')).toHaveCount(0);
  await shot(page, 'deleted-effects-cleaned');
});
test('銜接特效刪除其中一邊後消失，另一素材的特效保留', async ({ page }) => {
  await createProjectWith(page, ['solid-red.webm', 'solid-green.webm']);
  const p = await current(page),
    a = p.tracks[0]!.items[0]!,
    b = p.tracks[0]!.items[1]!;
  await page.locator(`.clip[data-item-id="${a.id}"]`).tap();
  await openTab(page, '特效');
  await page.getByRole('button', { name: '暖光掃過', exact: true }).tap();
  await page.getByRole('tab', { name: '影片特效', exact: true }).tap();
  await page.getByRole('button', { name: '黑白電影', exact: true }).tap();
  expect((await current(page)).effects).toHaveLength(2);
  await page.locator(`.clip[data-item-id="${b.id}"]`).tap();
  await openTab(page, '剪輯');
  await page.getByRole('button', { name: '刪除', exact: true }).tap();
  expect((await current(page)).effects!.map((f) => f.preset)).toEqual(['mono']);
  await expect(page.getByTestId('timeline-effect-badge')).toHaveCount(1);
});
test('舊的無素材特效仍有時間軸標記，可點選定位與移除', async ({ page }) => {
  await createProjectWith(page, ['solid-red.webm', 'solid-green.webm']);
  const id = (await current(page)).id;
  await page.getByRole('link', { name: '回首頁', exact: true }).tap();
  await page.evaluate(async (id) => {
    const request = indexedDB.open('little-moments-videoclip-2', 3);
    const db = await new Promise<IDBDatabase>((resolve, reject) => {
      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(request.error);
    });
    const tx = db.transaction('projects', 'readwrite'),
      table = tx.objectStore('projects'),
      get = table.get(id);
    get.onsuccess = () => {
      const p = get.result as Project;
      p.effects = [
        {
          id: 'legacy',
          preset: 'flash',
          start: 2,
          duration: 1,
          strength: 1,
          transitionFromId: 'deleted-source',
          transitionToId: p.tracks[0]!.items[0]!.id,
        },
      ];
      table.put(p);
    };
    await new Promise<void>((resolve, reject) => {
      tx.oncomplete = () => resolve();
      tx.onerror = () => reject(tx.error);
    });
    db.close();
  }, id);
  await page.goto(`./#/p/${id}`);
  await waitForPreviewReady(page);
  const badge = page.getByTestId('timeline-effect-badge');
  await expect(badge).toHaveCount(1);
  await badge.tap();
  const dialog = page.getByRole('dialog', { name: '特效起迄', exact: true });
  await expect(dialog).toBeVisible();
  await dialog.getByRole('button', { name: '關閉且不儲存', exact: true }).tap();
  await page.getByRole('button', { name: '移除特效', exact: true }).tap();
  await expect(badge).toHaveCount(0);
});
test('特效三層選項樣式不同，文字與素材導覽共用主層樣式，窄螢幕無橫向溢出', async ({ page }) => {
  await createProjectWith(page, ['solid-red.webm', 'solid-green.webm']);
  await openTab(page, '特效');
  const primary = page.getByRole('tab', { name: '轉場', exact: true }),
    secondary = page.getByRole('button', { name: '兩個素材銜接', exact: true }),
    tertiary = page.getByRole('button', { name: '全部', exact: true });
  const styles = await Promise.all(
    [primary, secondary, tertiary].map((b) =>
      b.evaluate((el) => {
        const c = getComputedStyle(el);
        return {
          bg: c.backgroundColor,
          shadow: c.boxShadow,
          border: c.borderBottomWidth,
          radius: c.borderRadius,
        };
      }),
    ),
  );
  expect(styles[0]!.bg).toBe('rgba(0, 0, 0, 0)');
  expect(styles[0]!.radius).toBe('0px');
  expect(styles[1]!.bg).not.toBe(styles[0]!.bg);
  expect(styles[2]!.shadow).not.toBe(styles[1]!.shadow);
  for (const width of [320, 390, 430]) {
    await page.setViewportSize({ width, height: 844 });
    expect(
      await page.locator('[aria-label="轉場與畫面特效"]').evaluate((el) => el.scrollWidth - el.clientWidth),
    ).toBeLessThanOrEqual(1);
    for (const button of [primary, secondary, tertiary])
      expect((await button.boundingBox())!.height).toBeGreaterThanOrEqual(44);
  }
  await shot(page, 'effect-levels');
  await openTab(page, '素材');
  await expect(page.locator('[aria-label="素材類型"]')).toHaveClass(/option-primary/);
});
test('音訊三操作與素材名稱左右並排，320至430px保留觸控大小且按鈕可操作', async ({ page }) => {
  await createProjectWith(page, ['timing-video.webm']);
  await openTab(page, '音訊');
  const row = page.locator('.audio-row').first();
  for (const width of [320, 390, 430]) {
    await page.setViewportSize({ width, height: 844 });
    const b = await row.locator('.audio-entry-header').evaluate((el) => {
      const a = el.querySelector('.audio-actions')!.getBoundingClientRect(),
        source = el.querySelector('.audio-source')!.getBoundingClientRect();
      return {
        right: a.right,
        left: source.left,
        over: el.scrollWidth - el.clientWidth,
        buttons: Array.from(el.querySelectorAll('.audio-actions button')).map((b) => {
          const r = b.getBoundingClientRect();
          return { w: r.width, h: r.height };
        }),
      };
    });
    expect(b.right).toBeLessThanOrEqual(b.left);
    expect(b.over).toBeLessThanOrEqual(1);
    for (const size of b.buttons) {
      expect(size.w).toBeGreaterThanOrEqual(44);
      expect(size.h).toBeGreaterThanOrEqual(44);
    }
  }
  await shot(page, 'audio-actions-left');
  await row.getByRole('button', { name: '片段範圍', exact: true }).tap();
  await page.getByRole('dialog').getByRole('button', { name: '關閉且不儲存', exact: true }).tap();
  await row.getByRole('button', { name: '移除原音', exact: true }).tap();
  await expect(row.getByRole('checkbox')).not.toBeChecked();
  await row.getByRole('checkbox').check();
  await row.getByRole('button', { name: '分離原音', exact: true }).tap();
  const detached = page
    .locator('.audio-row')
    .filter({ has: page.getByRole('button', { name: '刪除音軌', exact: true }) });
  await expect(detached).toHaveCount(1);
  await detached.getByRole('button', { name: '刪除音軌', exact: true }).tap();
  await expect(detached).toHaveCount(0);
});
async function template(page: Page) {
  await createProjectWith(page, ['solid-red.webm']);
  await openTab(page, '版型');
  await page.getByLabel('版型文字', { exact: true }).fill('MMMM');
  await slider(page, '版型文字大小', 96);
  await page.getByRole('button', { name: '字體', exact: true }).tap();
  await page.locator('[data-font-key="noto-serif-tc"]').tap();
  await expect(page.getByRole('dialog', { name: '選擇字體', exact: true })).toHaveCount(0);
  await expect(page.getByRole('img', { name: '版型文字比例示意', exact: true })).toHaveAttribute(
    'data-caption-size',
    '96',
  );
  await page.getByRole('button', { name: '套用多格版型', exact: true }).tap();
  await waitForPreviewReady(page);
  return (await current(page)).tracks.find((t) => t.template)!;
}
test('版型小示意呈現文字比例，展開群組可在文字頁編輯字體與大小，保存後重開不遺失', async ({ page }) => {
  const group = await template(page),
    id = group.layout!.captionText!.id;
  expect(group.items).toHaveLength(3);
  expect(group.layout!.captionText!.card.runs[0]).toMatchObject({ fontId: 'noto-serif-tc', size: 96 });
  await page
    .locator(`[data-track-id="${group.id}"]`)
    .getByRole('button', { name: '展開版型素材', exact: true })
    .tap();
  const text = page.locator('[data-template-caption=true]').getByTestId('clip');
  await expect(text).toHaveCount(1);
  await text.tap();
  await openTab(page, '文字');
  await page.getByLabel('文字內容', { exact: true }).fill('Our November');
  await slider(page, '大小', 120);
  const updated = (await current(page)).tracks.find((t) => t.id === group.id)!.layout!;
  expect(updated.caption).toBe('Our November');
  expect(updated.captionText!.id).toBe(id);
  expect(updated.captionText!.card.runs[0]!.size).toBe(120);
  await openTab(page, '版型');
  await expect(page.getByLabel('版型文字', { exact: true })).toHaveValue('Our November');
  await expect(page.getByRole('img', { name: '版型文字比例示意', exact: true })).toHaveAttribute(
    'data-caption-size',
    '120',
  );
  await shot(page, 'caption-proportion');
  await page.reload();
  await waitForPreviewReady(page);
  expect(
    (await current(page)).tracks.find((t) => t.id === group.id)!.layout!.captionText!.card.runs[0]!.size,
  ).toBe(120);
});
test('版型文字實際匯出，群組縮放定格播放沿用文字貼圖', async ({ page }) => {
  test.setTimeout(90000);
  const group = await template(page);
  const points: [number, number][] = [];
  for (let y = 0.92; y <= 0.99; y += 0.01) for (let x = 0.3; x <= 0.7; x += 0.025) points.push([x, y]);
  const frame = await exportFrame(page, 0.2, points);
  expect(frame.samples.some((c) => c[0]! < 160 && c[1]! < 160 && c[2]! < 160)).toBe(true);
  await seekTo(page, 0);
  await page.getByRole('button', { name: '定格', exact: true }).tap();
  await seekTo(page, 1.5);
  await expect
    .poll(() =>
      page.evaluate(() => (window as unknown as { __videoclip: { time: () => number } }).__videoclip.time()),
    )
    .toBeCloseTo(1.5, 1);
  await slider(page, '模板整組大小', 160);
  expect((await current(page)).tracks.find((t) => t.id === group.id)!.layout!.keyframes).toHaveLength(2);
  await seekTo(page, 0);
  await expect
    .poll(() =>
      page.evaluate(() => (window as unknown as { __videoclip: { time: () => number } }).__videoclip.time()),
    )
    .toBeCloseTo(0, 1);
  await page.getByRole('button', { name: '播放', exact: true }).tap();
  await expect
    .poll(() =>
      page.evaluate(() => (window as unknown as { __videoclip: { time: () => number } }).__videoclip.time()),
    )
    .toBeGreaterThan(0.3);
  const before = await page.evaluate(() =>
    (
      window as unknown as { __videoclip: { mediaStats: () => { allocations: number } } }
    ).__videoclip.mediaStats(),
  );
  await expect
    .poll(() =>
      page.evaluate(() => (window as unknown as { __videoclip: { time: () => number } }).__videoclip.time()),
    )
    .toBeGreaterThan(1.2);
  const after = await page.evaluate(() =>
    (
      window as unknown as { __videoclip: { mediaStats: () => { allocations: number } } }
    ).__videoclip.mediaStats(),
  );
  expect(after.allocations - before.allocations).toBe(0);
  await page.getByRole('button', { name: '暫停', exact: true }).tap();
});
