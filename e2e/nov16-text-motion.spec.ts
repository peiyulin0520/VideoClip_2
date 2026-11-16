import { KINETIC, KINETIC_GROUPS } from '../src/engine/kinetic';
import { expect, test, type Page } from '@playwright/test';
import { createProjectWith, openTab, seekTo, waitForPreviewReady } from './helpers';
import type { Project } from '../src/model/types';
const current = (page: Page): Promise<Project> =>
  page.evaluate(() =>
    (window as unknown as { __videoclip: { project: () => Project } }).__videoclip.project(),
  );
async function addText(page: Page) {
  await openTab(page, '文字');
  await page.getByRole('button', { name: /新增文字/ }).tap();
  await page.getByLabel('文字內容', { exact: true }).fill('完整顯示文字');
  return (await current(page)).tracks.flatMap((t) => t.items).find((i) => i.type === 'text')!;
}
async function slider(page: Page, name: string, value: number) {
  await page.getByRole('slider', { name, exact: true }).evaluate((el, v) => {
    Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value')!.set!.call(el, String(v));
    el.dispatchEvent(new Event('input', { bubbles: true }));
  }, value);
}
async function probe(page: Page, id: string, times: number[]) {
  return page.evaluate(
    ({ id, times }) =>
      (
        window as unknown as {
          __videoclip: { kineticProbe: (id: string, t: number[]) => { hash: number; pixels: number }[] };
        }
      ).__videoclip.kineticProbe(id, times),
    { id, times },
  );
}
test('64種參考字卡在真實Canvas都能呈現非空圖像', async ({ page }) => {
  test.setTimeout(90000);
  await createProjectWith(page, ['photo.png']);
  await waitForPreviewReady(page);
  const text = await addText(page);
  await openTab(page, '特效');
  await page.getByRole('tab', { name: '文字特效', exact: true }).tap();
  for (const group of KINETIC_GROUPS) {
    await page.getByRole('tab', { name: group.name, exact: true }).tap();
    for (const def of KINETIC.filter((d) => d.group === group.id)) {
      await page.getByRole('button', { name: `文字特效 ${def.zh}`, exact: true }).tap();
      expect(
        (await current(page)).tracks.flatMap((t) => t.items).find((i) => i.id === text.id),
      ).toMatchObject({ kinetic: { id: def.id } });
    }
  }
  const results = await page.evaluate(() =>
    (
      window as unknown as { __videoclip: { kineticCatalog: () => { id: string; pixels: number }[] } }
    ).__videoclip.kineticCatalog(),
  );
  expect(results).toHaveLength(64);
  for (const r of results) expect(r.pixels, r.id).toBeGreaterThan(8);
});
test('文字副標可編輯並保存；循環與完成後完整停留可以切換，晚期不消失', async ({ page }) => {
  await createProjectWith(page, ['photo.png']);
  const text = await addText(page);
  await openTab(page, '特效');
  await page.getByRole('tab', { name: '文字特效', exact: true }).tap();
  await page.getByRole('tab', { name: '流動', exact: true }).tap();
  await page.getByRole('button', { name: '文字特效 巨字橫移', exact: true }).tap();
  await slider(page, '文字特效一輪長度', 1);
  await openTab(page, '文字');
  await page.getByLabel('副標題內容', { exact: true }).fill('我自己的副標');
  await openTab(page, '特效');
  await page.getByRole('tab', { name: '文字特效', exact: true }).tap();
  const held = await probe(page, text.id, [0.9, 2.5, 20]);
  expect(held[0]!.pixels).toBeGreaterThan(50);
  expect(held[0]!.hash).toBe(held[1]!.hash);
  expect(held[1]!.hash).toBe(held[2]!.hash);
  await page.getByLabel('文字特效播放方式', { exact: true }).selectOption('loop');
  const moving = await probe(page, text.id, [0.15, 0.55, 1.15]);
  expect(moving[0]!.hash).not.toBe(moving[1]!.hash);
  expect(moving[0]!.hash).toBe(moving[2]!.hash);
  await page.getByLabel('文字特效播放方式', { exact: true }).selectOption('hold');
  await page.locator('[aria-label="文字特效播放方式"]').scrollIntoViewIfNeeded();
  await page.screenshot({ path: 'docs/screenshots/nov16/text-hold-controls.png' });
  await page.reload();
  await waitForPreviewReady(page);
  expect((await current(page)).tracks.flatMap((t) => t.items).find((i) => i.id === text.id)).toMatchObject({
    kinetic: { id: 'crawl', playback: 'hold', subtitle: '我自己的副標' },
  });
});
test('動態字卡與整段呼吸播放重用貼圖，影片與聲音持續前進', async ({ page }) => {
  await createProjectWith(page, ['tone-video.webm']);
  await waitForPreviewReady(page);
  await addText(page);
  await openTab(page, '特效');
  await page.getByRole('tab', { name: '文字特效', exact: true }).tap();
  await page.getByRole('button', { name: '文字特效 爆出', exact: true }).tap();
  await page.getByLabel('文字特效播放方式', { exact: true }).selectOption('loop');
  await page.getByRole('tab', { name: '整段特效', exact: true }).tap();
  await page.getByRole('button', { name: '呼吸', exact: true }).tap();
  await seekTo(page, 0);
  await page.getByRole('button', { name: '播放', exact: true }).tap();
  const time = () =>
    page.evaluate(() => (window as unknown as { __videoclip: { time: () => number } }).__videoclip.time());
  await expect.poll(time).toBeGreaterThan(0.4);
  const before = await page.evaluate(() =>
    (
      window as unknown as { __videoclip: { mediaStats: () => { allocations: number } } }
    ).__videoclip.mediaStats(),
  );
  await expect.poll(time).toBeGreaterThan(1.4);
  const result = await page.evaluate(() => {
    const h = (
      window as unknown as {
        __videoclip: { mediaStats: () => { allocations: number }; audioEnergy: () => number };
      }
    ).__videoclip;
    return { stats: h.mediaStats(), energy: h.audioEnergy() };
  });
  expect(result.stats.allocations - before.allocations).toBe(0);
  expect(result.energy).toBeGreaterThan(0.01);
  await page.getByRole('button', { name: '暫停', exact: true }).tap();
});

test('四種基本文字樣式的循環長度有效，完成後可保持完整文字', async ({ page }) => {
  await createProjectWith(page, ['photo.png']);
  const text = await addText(page);
  await openTab(page, '特效');
  await page.getByRole('tab', { name: '文字特效', exact: true }).tap();
  await page.getByRole('tab', { name: '基本', exact: true }).tap();
  for (const name of ['閃爍', '發光閃亮', '方格字', '震動']) {
    await page.getByRole('button', { name: `文字特效 ${name}`, exact: true }).tap();
    await slider(page, '文字特效一輪長度', 1);
    await page.getByLabel('文字特效播放方式', { exact: true }).selectOption('loop');
    const loop = await probe(page, text.id, [0.2, 1.2]);
    expect(loop[0]!.pixels, name).toBeGreaterThan(10);
    expect(loop[0]!.hash, name).toBe(loop[1]!.hash);
    await page.getByLabel('文字特效播放方式', { exact: true }).selectOption('hold');
    const held = await probe(page, text.id, [1.1, 2.5]);
    expect(held[0]!.pixels, name).toBeGreaterThan(10);
    expect(held[0]!.hash, name).toBe(held[1]!.hash);
  }
});
