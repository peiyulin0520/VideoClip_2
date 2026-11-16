import { expect, test, type Page } from '@playwright/test';
import type { Project } from '../src/model/types';
import { groupFrame } from '../src/engine/templateGeometry';
import {
  createProjectWith,
  openTab,
  waitForPreviewReady,
  exportFrame,
  isRed,
  isGreen,
  seekTo,
  expandAllGroups,
  samplePreview,
  type RGBA,
} from './helpers';
const current = (page: Page): Promise<Project> =>
  page.evaluate(() =>
    (window as unknown as { __videoclip: { project: () => Project } }).__videoclip.project(),
  );
const group = async (page: Page) => (await current(page)).tracks.find((t) => t.layout?.version === 2)!;
async function createFrame(page: Page, rows = 2) {
  await openTab(page, '版型', false);
  await page.getByRole('button', { name: `1:${rows}`, exact: true }).tap();
  await page.getByRole('button', { name: '新增空白框架', exact: true }).tap();
  await expect.poll(async () => (await group(page))?.layout?.version).toBe(2);
}
async function addSource(page: Page, cell: number, name: string) {
  await openTab(page, '版型', false);
  await page.getByRole('button', { name: `第 ${cell} 格素材`, exact: true }).tap();
  const d = page.getByRole('dialog', { name: `第 ${cell} 格素材`, exact: true });
  await d.getByLabel('格子新增素材', { exact: true }).selectOption({ label: name });
  await d.getByRole('button', { name: '加入此格的新影像列', exact: true }).tap();
  await d.getByRole('button', { name: '完成', exact: true }).tap();
}
async function drag(page: Page, label: string, dx: number, dy: number) {
  const target = page.getByRole('button', { name: label, exact: true });
  await target.scrollIntoViewIfNeeded();
  const r = (await target.boundingBox())!;
  await page.mouse.move(r.x + r.width / 2, r.y + r.height / 2);
  await page.mouse.down();
  await page.mouse.move(r.x + r.width / 2 + dx, r.y + r.height / 2 + dy, { steps: 5 });
  await page.mouse.up();
}
async function slider(page: Page, label: string, value: number) {
  await page.getByRole('slider', { name: label, exact: true }).evaluate((el, v) => {
    Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value')!.set!.call(el, String(v));
    el.dispatchEvent(new Event('input', { bubbles: true }));
  }, value);
}
test('空框架、自訂列欄、外框拖曳可取消；分界調整立即清除舊線並與匯出、重開一致', async ({ page }) => {
  test.setTimeout(90000);
  await createProjectWith(page, ['solid-red.webm', 'solid-green.webm']);
  await waitForPreviewReady(page);
  await createFrame(page);
  expect((await group(page)).items).toHaveLength(0);
  expect((await group(page)).layout!.frameItem!.templateRole).toBe('frame');
  await addSource(page, 1, 'solid-red.webm');
  await addSource(page, 2, 'solid-green.webm');
  await slider(page, '外框粗細', 38);
  await slider(page, '分隔線粗細', 30);
  const before = await group(page),
    p = await current(page),
    f = groupFrame(before, p.width, p.height, 0.3);
  const initial = await exportFrame(page, 0.3, [[0.5, 0.5]]);
  expect(initial.samples[0]![0]).toBeGreaterThan(200);
  await page.getByRole('button', { name: '調整外框大小', exact: true }).tap();
  await drag(page, '外框r把手', -22, 0);
  await page.getByRole('button', { name: '關閉且不儲存', exact: true }).tap();
  expect((await group(page)).layout).toEqual(before.layout);
  await page.getByRole('button', { name: '調整格子分界', exact: true }).tap();
  const stage = (await page.locator('.framework-resize-stage').boundingBox())!;
  await drag(page, '第1格b分界', 0, stage.height * (f.h / p.height) * 0.15);
  await page.getByRole('button', { name: '套用框架調整', exact: true }).tap();
  const changed = await group(page);
  expect(changed.layout!.cells![0]!.h).toBeCloseTo(0.65, 1);
  expect(changed.layout!.cells![1]!.y).toBeCloseTo(changed.layout!.cells![0]!.h);
  const y = 0.5 + ((changed.layout!.cells![0]!.h - 0.5) * f.h) / p.height;
  const result = await exportFrame(page, 0.3, [
    [0.5, 0.5],
    [0.5, y],
    [0.5, 0.78],
  ]);
  expect(isRed(result.samples[0]! as RGBA)).toBe(true);
  expect(result.samples[1]![0]).toBeGreaterThan(200);
  expect(isGreen(result.samples[2]! as RGBA)).toBe(true);
  await page.getByRole('button', { name: '調整外框大小', exact: true }).tap();
  await drag(page, '外框r把手', -22, 0);
  await page.getByRole('button', { name: '套用框架調整', exact: true }).tap();
  expect((await group(page)).layout!.box!.w).toBeLessThan(before.layout!.box!.w);
  await page.getByLabel('框架欄數', { exact: true }).fill('2');
  expect((await group(page)).layout!.cells).toHaveLength(4);
  expect((await group(page)).items).toHaveLength(2);
  await page.screenshot({ path: 'docs/screenshots/nov16/framework-custom.png' });
  await page.reload();
  await waitForPreviewReady(page);
  expect((await group(page)).layout!.cells).toHaveLength(4);
  expect((await group(page)).items).toHaveLength(2);
});
test('同一格可多列影像，分類群組可收合；文字加入群組後可排在兩影像之間', async ({ page }) => {
  await createProjectWith(page, ['solid-red.webm', 'solid-green.webm']);
  await createFrame(page, 1);
  await addSource(page, 1, 'solid-red.webm');
  await addSource(page, 1, 'solid-green.webm');
  const g = await group(page);
  expect(g.items).toHaveLength(2);
  expect(g.items.map((i) => i.templateCell)).toEqual([1, 1]);
  await openTab(page, '文字');
  await page.getByLabel('新增素材位置', { exact: true }).selectOption(g.id);
  await page.getByRole('button', { name: /新增文字/ }).tap();
  await page.getByLabel('文字內容', { exact: true }).fill('MMMM');
  const text = (await group(page)).items.find((i) => i.type === 'text')!;
  expect(text.templateRole).toBe('member');
  await seekTo(page, 0.3);
  await openTab(page, '圖層');
  const header = page.getByTestId('framework-layer-group');
  await expect(header.getByTestId('layer-row')).toHaveCount(0);
  await header.getByRole('button', { name: new RegExp(g.name) }).tap();
  await expect(header.getByTestId('layer-row')).toHaveCount(3);
  await header.getByRole('button', { name: 'solid-green.webm 往上一層', exact: true }).tap();
  const ordered = (await group(page)).layout!.order!;
  expect(ordered.indexOf(text.id)).toBeLessThan(ordered.indexOf(g.items[1]!.id));
  const pixels = await exportFrame(page, 0.3, [[0.5, 0.5]]);
  expect(isGreen(pixels.samples[0]! as RGBA)).toBe(true);
  await expandAllGroups(page);
  await page.getByRole('button', { name: '展開版型素材', exact: true }).tap();
  await expect(page.locator('.framework-family-toggle')).toHaveCount(2);
  await expect(page.locator('[data-template-child="true"]')).toHaveCount(3);
  await page.locator('.framework-family-toggle').filter({ hasText: '影像' }).tap();
  await expect(page.locator('[data-template-child="true"]')).toHaveCount(1);
  await page.screenshot({ path: 'docs/screenshots/nov16/framework-layers.png' });
});
test('格內可縮放原影像、單獨定格與刪除，保留空框架及另一格內容', async ({ page }) => {
  await createProjectWith(page, ['photo.png', 'solid-green.webm']);
  await createFrame(page);
  await addSource(page, 1, 'photo.png');
  await addSource(page, 2, 'solid-green.webm');
  const g = await group(page);
  await openTab(page, '版型', false);
  await page.getByRole('button', { name: '第 1 格素材', exact: true }).tap();
  await page.getByRole('button', { name: '選取素材', exact: true }).tap();
  await openTab(page, '圖層');
  await slider(page, '圖層大小', 150);
  expect((await group(page)).items[0]!.transform.scale).toBe(1.5);
  expect((await group(page)).layout!.transform!.scale).toBe(1);
  expect('crop' in (await group(page)).items[0]!).toBe(false);
  await openTab(page, '剪輯');
  await page.getByRole('button', { name: '刪除', exact: true }).tap();
  expect((await group(page)).items).toHaveLength(1);
  expect((await group(page)).items[0]!.id).toBe(g.items[1]!.id);
  expect((await group(page)).layout!.frameItem).toBeTruthy();
  await expect
    .poll(() =>
      page.evaluate(
        async () =>
          (
            await (
              window as unknown as { __videoclip: { savedProject: () => Promise<Project> } }
            ).__videoclip.savedProject()
          ).tracks.find((t) => t.layout?.version === 2)!.items.length,
      ),
    )
    .toBe(1);
  await page.reload();
  await waitForPreviewReady(page);
  expect((await group(page)).items).toHaveLength(1);
});
test('依序播放前後停留畫面、填色及透明可切換，真實預覽與原檔匯出同一幾何', async ({ page }) => {
  await createProjectWith(page, ['solid-red.webm', 'solid-green.webm']);
  // A transparent cell reveals the project underneath. Hide the original red base so that
  // the pixel assertion distinguishes transparency from the intentional red underlay.
  const base = (await current(page)).tracks[0]!;
  await page.locator(`[data-track-id="${base.id}"]`).getByTestId('track-chip').tap();
  await page.getByRole('button', { name: '隱藏這條軌道', exact: true }).tap();
  await createFrame(page);
  await addSource(page, 1, 'solid-red.webm');
  await addSource(page, 2, 'solid-green.webm');
  await page.getByLabel('版型播放方式', { exact: true }).selectOption('sequential');
  const g = await group(page);
  expect(g.items[1]!.start).toBeGreaterThan(g.items[0]!.start);
  const t = g.items[1]!.start + 0.2;
  const held = await exportFrame(page, t, [
    [0.5, 0.25],
    [0.5, 0.75],
  ]);
  expect(isRed(held.samples[0]! as RGBA)).toBe(true);
  expect(isGreen(held.samples[1]! as RGBA)).toBe(true);
  await page.getByLabel('版型空檔處理', { exact: true }).selectOption('transparent');
  const clear = await exportFrame(page, t, [
    [0.5, 0.25],
    [0.5, 0.75],
  ]);
  expect(isRed(clear.samples[0]! as RGBA)).toBe(false);
  expect(isGreen(clear.samples[1]! as RGBA)).toBe(true);
  await page.getByLabel('版型空檔處理', { exact: true }).selectOption('fill');
  const fill = await exportFrame(page, t, [[0.5, 0.25]]);
  expect(fill.samples[0]![0]).toBeGreaterThan(150);
  await page.getByLabel('版型空檔處理', { exact: true }).selectOption('hold');
  await seekTo(page, t);
  await expect.poll(async () => isGreen(await samplePreview(page, 0.5, 0.75))).toBe(true);
  await page.screenshot({ path: 'docs/screenshots/nov16/framework-sequential.png' });
});

test('版型整段影片可實際匯出並保留原音，子素材特效可獨立選取', async ({ page }) => {
  test.setTimeout(90000);
  await createProjectWith(page, ['tone-video.webm', 'solid-green.webm']);
  await createFrame(page);
  await addSource(page, 1, 'tone-video.webm');
  await addSource(page, 2, 'solid-green.webm');
  const g = await group(page);
  await page.getByRole('button', { name: '第 2 格素材', exact: true }).tap();
  await page.getByRole('button', { name: '選取素材', exact: true }).tap();
  await openTab(page, '特效');
  await page.getByRole('button', { name: '單一素材', exact: true }).tap();
  await expect(page.getByLabel('單一動畫素材', { exact: true })).toHaveValue(g.items[1]!.id);
  await page.getByRole('tab', { name: '整段特效', exact: true }).tap();
  await page.getByRole('button', { name: '呼吸', exact: true }).tap();
  expect((await group(page)).items[1]!.continuous?.kind).toBe('breathe');
  expect((await group(page)).items[0]!.continuous).toBeUndefined();
  expect((await group(page)).layout!.continuous).toBeUndefined();
  await page.getByRole('button', { name: '匯出影片', exact: true }).tap();
  await page.getByLabel('匯出解析度', { exact: true }).selectOption('360');
  await page.getByRole('button', { name: '開始匯出', exact: true }).tap();
  const link = page.getByRole('link', { name: '下載影片', exact: true });
  await expect(link).toBeVisible({ timeout: 60000 });
  const info = await page.evaluate(
    async (url) =>
      (
        window as unknown as {
          __videoclip: {
            inspectMovie: (
              url: string,
              t: number,
              pts: [number, number][],
            ) => Promise<{ audio: boolean; rms: number; samples: number[][] }>;
          };
        }
      ).__videoclip.inspectMovie(url!, 0.3, [[0.5, 0.75]]),
    await link.getAttribute('href'),
  );
  expect(info.audio).toBe(true);
  expect(info.rms).toBeGreaterThan(0.01);
  expect(isGreen(info.samples[0]! as RGBA)).toBe(true);
});

test('框架預設、自訂顏色與透明度、播放格序按鈕可操作且不交換素材所在格子', async ({ page }) => {
  await createProjectWith(page, ['solid-red.webm', 'solid-green.webm']);
  await createFrame(page);
  for (const n of [3, 4, 1, 2]) {
    await page.getByRole('button', { name: `1:${n}`, exact: true }).tap();
    expect((await group(page)).layout!.count).toBe(n);
  }
  await addSource(page, 1, 'solid-red.webm');
  await addSource(page, 2, 'solid-green.webm');
  await slider(page, '外框粗細', 80);
  await slider(page, '分隔線粗細', 60);
  await page.getByRole('button', { name: '版型顏色自訂', exact: true }).tap();
  for (const [channel, value] of [
    ['R', '20'],
    ['G', '80'],
    ['B', '230'],
  ] as const)
    await page.getByRole('spinbutton', { name: `色彩 ${channel}`, exact: true }).fill(value);
  await page.getByRole('button', { name: '套用顏色', exact: true }).tap();
  const g = await group(page),
    p = await current(page),
    f = groupFrame(g, p.width, p.height, 0.2),
    pt: [number, number] = [(f.cx - f.w / 2 + f.w * 0.015) / p.width, f.cy / p.height];
  const colored = await exportFrame(page, 0.2, [pt]);
  expect(colored.samples[0]![2]).toBeGreaterThan(180);
  expect(colored.samples[0]![0]).toBeLessThan(50);
  await slider(page, '版型框架透明度', 0);
  const hidden = await exportFrame(page, 0.2, [pt]);
  expect(isRed(hidden.samples[0]! as RGBA)).toBe(true);
  await slider(page, '版型框架透明度', 100);
  await page.getByLabel('版型播放方式', { exact: true }).selectOption('sequential');
  await page.getByRole('button', { name: '第2格提前播放', exact: true }).tap();
  expect((await group(page)).layout!.cellOrder).toEqual([2, 1]);
  expect((await group(page)).items.map((i) => i.templateCell)).toEqual([1, 2]);
  await page.getByRole('button', { name: '第2格延後播放', exact: true }).tap();
  expect((await group(page)).layout!.cellOrder).toEqual([1, 2]);
  await page.locator('.framework-cell-order').scrollIntoViewIfNeeded();
  await page.screenshot({ path: 'docs/screenshots/nov16/framework-playback-order.png' });
  await page.getByRole('button', { name: '新增另一個版型', exact: true }).tap();
  await page.getByRole('button', { name: '新增空白框架', exact: true }).tap();
  expect((await current(page)).tracks.filter((t) => t.layout?.version === 2)).toHaveLength(2);
});
