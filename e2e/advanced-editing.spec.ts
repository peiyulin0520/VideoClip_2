import { expandAllGroups } from './helpers';
import { test, expect, type Page, type Locator } from '@playwright/test';
import type { Project, VideoItem } from '../src/model/types';
import { TRANSITIONS, VIDEO_EFFECTS } from '../src/engine/effectCatalog';
import {
  createProjectWith,
  clips,
  openTab,
  addOverlays,
  fixture,
  seekTo,
  samplePreview,
  exportFrame,
  isRed,
  isGreen,
} from './helpers';
const shots = 'docs/screenshots/advanced-editing';
const current = async (page: Page): Promise<Project> => {
  await page.waitForFunction(() => !!(window as unknown as { __videoclip?: unknown }).__videoclip);
  return page.evaluate(() =>
    (window as unknown as { __videoclip: { project: () => Project } }).__videoclip.project(),
  );
};
async function shot(page: Page, name: string) {
  await expect(page.locator('.toast')).toHaveCount(0);
  await page.screenshot({ path: `${shots}/${name}.png` });
}
async function sourcePoint(page: Page, fraction: number) {
  const el = page.locator('.sheet .source-thumbs').first();
  await el.scrollIntoViewIfNeeded();
  await el.tap({ position: { x: (await el.boundingBox())!.width * fraction, y: 30 } });
}
async function shortFirstRange(page: Page, minimum: number) {
  const marker = page.locator('.sheet').getByRole('button', { name: '來源終點標記', exact: true });
  await marker.press('Home');
  for (let i = 0; i < Math.round((0.5 - minimum) / 0.05); i++) await marker.press('ArrowRight');
}
async function slider(page: Page, name: string, value: number) {
  await page.getByRole('slider', { name, exact: true }).evaluate((el, v) => {
    Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value')!.set!.call(el, String(v));
    el.dispatchEvent(new Event('input', { bubbles: true }));
  }, value);
}
async function hold(page: Page, locator: Locator) {
  await locator.evaluate((el) => el.scrollIntoView({ block: 'center' }));
  const b = (await locator.boundingBox())!,
    cdp = await page.context().newCDPSession(page);
  try {
    await cdp.send('Input.dispatchTouchEvent', {
      type: 'touchStart',
      touchPoints: [{ x: b.x + b.width / 2, y: b.y + b.height / 2, id: 1 }],
    });
    await page.waitForTimeout(560);
    await cdp.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] });
  } finally {
    await cdp.detach();
  }
}
async function beginExport(page: Page) {
  await page.getByRole('button', { name: '匯出影片', exact: true }).tap();
  await page.getByLabel('匯出解析度').selectOption('360');
  await page.getByLabel('匯出影格率').selectOption('24');
  await page.getByRole('button', { name: '開始匯出', exact: true }).tap();
  await expect(page.getByRole('link', { name: '下載影片', exact: true })).toBeVisible({ timeout: 90000 });
}
async function inspect(page: Page, t: number, pts: [number, number][]) {
  const url = (await page.getByLabel('匯出影片預覽').getAttribute('src'))!;
  return page.evaluate(
    ({ url, t, pts }) =>
      (
        window as unknown as {
          __videoclip: {
            inspectMovie: (
              url: string,
              t: number,
              pts: [number, number][],
            ) => Promise<{ duration: number; rms: number; samples: number[][] }>;
          };
        }
      ).__videoclip.inspectMovie(url, t, pts),
    { url, t, pts },
  );
}

test('影片多組標記由白線明確新增，可局部復原與取消，保留中間空白及原音選段', async ({ page }) => {
  test.setTimeout(120000);
  await createProjectWith(page, ['tone-video.webm']);
  await clips(page).first().tap();
  await page.getByRole('button', { name: '片段範圍', exact: true }).tap();
  await shortFirstRange(page, 0.2);
  await sourcePoint(page, 0.5);
  await expect(page.locator('.source-marker')).toHaveCount(2);
  await page
    .getByRole('dialog')
    .getByRole('button', { name: '在白線位置新增一組起迄標記', exact: true })
    .tap();
  await expect(page.locator('.source-marker')).toHaveCount(4);
  await page.getByRole('button', { name: '復原上一步選段', exact: true }).tap();
  await expect(page.locator('.source-marker')).toHaveCount(2);
  await page.getByRole('button', { name: '關閉且不儲存', exact: true }).tap();
  expect((await current(page)).tracks[0]!.items[0]!.duration).toBeCloseTo(3);
  await page.getByRole('button', { name: '片段範圍', exact: true }).tap();
  await shortFirstRange(page, 0.2);
  await sourcePoint(page, 0.5);
  await page
    .getByRole('dialog')
    .getByRole('button', { name: '在白線位置新增一組起迄標記', exact: true })
    .tap();
  await shot(page, 'multiple-picture-markers');
  await page.getByRole('button', { name: '套用片段範圍', exact: true }).tap();
  const item = (await current(page)).tracks[0]!.items[0] as VideoItem;
  expect(item.sourceRanges).toHaveLength(2);
  expect(item.duration).toBeCloseTo(2);
  await seekTo(page, 1);
  await expect
    .poll(async () => {
      const c = await samplePreview(page, 0.5, 0.5);
      return !!c && c[0] < 20 && c[1] < 20;
    })
    .toBe(true);
  const frame = await exportFrame(page, 1, [[0.5, 0.5]]);
  expect(frame.samples[0]![0]).toBeLessThan(20);
  await seekTo(page, 1.7);
  await expect.poll(async () => isRed(await samplePreview(page, 0.5, 0.5))).toBe(true);
  await beginExport(page);
  const gap = await inspect(page, 1, [[0.5, 0.5]]),
    kept = await inspect(page, 1.7, [[0.5, 0.5]]);
  expect(gap.duration).toBeCloseTo(2, 1);
  expect(gap.rms).toBeLessThan(0.001);
  expect(gap.samples[0]![0]).toBeLessThan(20);
  expect(kept.rms).toBeGreaterThan(0.01);
  expect(kept.samples[0]![0]).toBeGreaterThan(200);
  await shot(page, 'multiple-selections-export');
});

test('音訊可在白線新增第二組保留範圍，復原與取消不改專案', async ({ page }) => {
  await createProjectWith(page, ['tone-video.webm']);
  await openTab(page, '音訊');
  await page.getByRole('button', { name: '片段範圍', exact: true }).tap();
  await shortFirstRange(page, 0.01);
  await sourcePoint(page, 0.5);
  await expect(page.locator('.source-marker')).toHaveCount(2);
  await page
    .getByRole('dialog')
    .getByRole('button', { name: '在白線位置新增一組起迄標記', exact: true })
    .tap();
  await expect(page.locator('.source-marker')).toHaveCount(4);
  await page.getByRole('button', { name: '復原上一步選段', exact: true }).tap();
  await expect(page.locator('.source-marker')).toHaveCount(2);
  await page
    .getByRole('dialog')
    .getByRole('button', { name: '在白線位置新增一組起迄標記', exact: true })
    .tap();
  await shot(page, 'multiple-audio-markers');
  await page.getByRole('button', { name: '關閉且不儲存', exact: true }).tap();
  expect(((await current(page)).tracks[0]!.items[0] as VideoItem).audioRanges).toBeUndefined();
});

test('素材可命名，長按左側進多選，批次排序顯示合併刪除皆可復原', async ({ page }) => {
  test.setTimeout(90000);
  await createProjectWith(page, ['solid-red.webm']);
  await addOverlays(page, ['solid-green.webm', 'solid-blue.webm']);
  await openTab(page, '剪輯');
  await page.getByRole('button', { name: '命名', exact: true }).tap();
  await page.getByLabel('素材名稱', { exact: true }).fill('我的晚餐');
  await page.getByRole('button', { name: '儲存名稱', exact: true }).tap();
  await expect(clips(page).filter({ hasText: '我的晚餐' })).toHaveCount(1);
  const p = await current(page),
    ids = p.tracks.slice(1).map((t) => t.id),
    chip = (id: string) => page.locator(`[data-track-id="${id}"] .track-chip`);
  await hold(page, chip(ids[0]!));
  await expect(page.getByRole('toolbar', { name: '多選圖層操作' })).toBeVisible();
  await chip(ids[1]!).tap();
  await expect(page.getByText('已選 2 層', { exact: true })).toBeVisible();
  await page.getByRole('button', { name: '選取圖層下移', exact: true }).tap();
  expect((await current(page)).tracks.slice(0, 2).map((t) => t.id)).toEqual(ids);
  await page.getByRole('button', { name: '選取圖層上移', exact: true }).tap();
  await page.getByRole('button', { name: '隱藏選取圖層', exact: true }).tap();
  expect((await current(page)).tracks.filter((t) => ids.includes(t.id)).every((t) => t.hidden)).toBe(true);
  await page.getByRole('button', { name: '顯示選取圖層', exact: true }).tap();
  await page.getByRole('button', { name: '合併成同一列', exact: true }).tap();
  await expect(page.locator('.toast').filter({ hasText: '素材時間重疊' })).toBeVisible();
  await page.getByRole('button', { name: '合併並依序接續', exact: true }).tap();
  expect((await current(page)).tracks.filter((t) => ids.includes(t.id))).toHaveLength(1);
  const merged = (await current(page)).tracks.find((t) => ids.includes(t.id))!;
  expect(merged.items.map((i) => i.start)).toEqual([0, 4]);
  await shot(page, 'batch-layers');
  await page.getByRole('button', { name: '完成多選', exact: true }).tap();
  await page.getByRole('button', { name: '復原', exact: true }).tap();
  expect((await current(page)).tracks).toHaveLength(3);
  await hold(page, chip(ids[0]!));
  await chip(ids[1]!).tap();
  await page.getByRole('button', { name: '刪除選取圖層', exact: true }).tap();
  expect((await current(page)).tracks).toHaveLength(1);
  await page.getByRole('button', { name: '復原', exact: true }).tap();
  expect((await current(page)).tracks).toHaveLength(3);
  await expect
    .poll(() =>
      page.evaluate(async () => {
        const saved = await (
          window as unknown as { __videoclip: { savedProject: () => Promise<Project> } }
        ).__videoclip.savedProject();
        return {
          tracks: saved.tracks.length,
          names: saved.tracks.flatMap((t) => t.items).filter((it) => it.name === '我的晚餐').length,
        };
      }),
    )
    .toEqual({ tracks: 3, names: 1 });
  await page.reload();
  await expandAllGroups(page);
  expect((await current(page)).tracks).toHaveLength(3);
  await expect(clips(page).filter({ hasText: '我的晚餐' })).toHaveCount(1);
});

test('文字與影像可各自收合成分類摘要，收合不改圖層上下關係', async ({ page }) => {
  await createProjectWith(page, ['solid-red.webm']);
  await addOverlays(page, ['solid-green.webm']);
  await openTab(page, '文字');
  for (let i = 0; i < 3; i++) await page.getByRole('button', { name: /新增文字/ }).tap();
  const before = (await current(page)).tracks.map((t) => t.id);
  await page.getByRole('button', { name: '收合文字群組', exact: true }).tap();
  await expect(page.locator('[data-testid="track"][data-kind="text"]')).toHaveCount(0);
  await expect(page.locator('.family-toggle').filter({ hasText: '文字' })).toContainText('×3');
  await page.getByRole('button', { name: '收合影像群組', exact: true }).tap();
  await expect(page.getByTestId('track')).toHaveCount(0);
  expect((await current(page)).tracks.map((t) => t.id)).toEqual(before);
  await shot(page, 'collapsed-family-groups');
  await page.getByRole('button', { name: '展開文字群組', exact: true }).tap();
  await expect(page.locator('[data-testid="track"][data-kind="text"]')).toHaveCount(3);
  await page.getByRole('button', { name: '展開影像群組', exact: true }).tap();
  await expect(page.getByTestId('track')).toHaveCount(5);
});

test('兩個菱形之間位置大小與亮度線性變化，預覽單格及完整影片相同', async ({ page }) => {
  test.setTimeout(120000);
  await createProjectWith(page, ['solid-red.webm']);
  await clips(page).first().tap();
  await page.getByRole('button', { name: '定格', exact: true }).tap();
  await openTab(page, '圖層');
  await page.getByRole('button', { name: '定格細部調整', exact: true }).tap();
  await page.getByRole('button', { name: '完成定格', exact: true }).tap();
  await seekTo(page, 2);
  await page.getByRole('button', { name: '定格', exact: true }).tap();
  await openTab(page, '圖層');
  await page.getByRole('button', { name: '定格細部調整', exact: true }).tap();
  await slider(page, '定格大小', 50);
  await slider(page, '水平位置', 75);
  await slider(page, '定格亮度', 50);
  await shot(page, 'linear-keyframe-controls');
  await page.getByRole('button', { name: '完成定格', exact: true }).tap();
  const it = (await current(page)).tracks[0]!.items[0]!;
  expect(it.keyframes).toHaveLength(2);
  await expect(page.locator('.timeline-keyframe')).toHaveCount(2);
  await page.locator('.timeline-keyframe').first().tap();
  await expect(page.getByTestId('time')).toHaveText(/^0:00\.0 /);
  await page.locator('.timeline-keyframe').nth(1).tap();
  await expect(page.getByTestId('time')).toHaveText(/^0:02\.0 /);
  await seekTo(page, 3);
  await expect(page.getByTestId('time')).toHaveText(/^0:03\.0 /);
  await seekTo(page, 2);
  await expect(page.getByTestId('time')).toHaveText(/^0:02\.0 /);
  await seekTo(page, 1);
  await expect
    .poll(async () => {
      const c = await samplePreview(page, 0.6, 0.5);
      return !!c && c[0] > 175 && c[0] < 205;
    })
    .toBe(true);
  const frame = await exportFrame(page, 1, [
    [0.1, 0.5],
    [0.6, 0.5],
  ]);
  expect(frame.samples[0]![0]).toBeLessThan(20);
  expect(frame.samples[1]![0]).toBeGreaterThan(175);
  expect(frame.samples[1]![0]).toBeLessThan(205);
  await page.getByTestId('stage').scrollIntoViewIfNeeded();
  await shot(page, 'linear-keyframe-midpoint');
  await openTab(page, '圖層');
  await page.getByRole('button', { name: '位置、大小、旋轉歸位', exact: true }).tap();
  expect((await current(page)).tracks[0]!.items[0]!.keyframes).toHaveLength(3);
  await page.getByRole('button', { name: '復原', exact: true }).tap();
  expect((await current(page)).tracks[0]!.items[0]!.keyframes).toHaveLength(2);
  await beginExport(page);
  const movie = await inspect(page, 1, [
    [0.1, 0.5],
    [0.6, 0.5],
  ]);
  expect(movie.samples[0]![0]).toBeLessThan(20);
  expect(movie.samples[1]![0]).toBeGreaterThan(170);
  expect(movie.samples[1]![0]).toBeLessThan(210);
  await shot(page, 'keyframes-export');
});

test('膠卷關鍵幀只縮放整組，框架與三格同步且重開保存', async ({ page }) => {
  await createProjectWith(page, ['solid-blue.webm']);
  await openTab(page, '版型');
  await page.getByRole('button', { name: '直式膠卷', exact: true }).tap();
  await page
    .getByTestId('template-files')
    .setInputFiles(['solid-red.webm', 'solid-green.webm', 'solid-blue.webm'].map(fixture));
  await expect(page.locator('.busy')).toHaveCount(0);
  await page.getByRole('button', { name: '套用多格版型', exact: true }).tap();
  const before = (await current(page)).tracks.find((t) => t.template)!.items.map((i) => i.transform);
  await page.getByRole('button', { name: '定格', exact: true }).tap();
  await openTab(page, '圖層');
  await page.getByRole('button', { name: '定格細部調整', exact: true }).tap();
  await page.getByRole('button', { name: '完成定格', exact: true }).tap();
  await seekTo(page, 2);
  await page.getByRole('button', { name: '定格', exact: true }).tap();
  await openTab(page, '圖層');
  await page.getByRole('button', { name: '定格細部調整', exact: true }).tap();
  await slider(page, '定格大小', 50);
  await page.getByRole('button', { name: '完成定格', exact: true }).tap();
  await seekTo(page, 1);
  expect((await current(page)).tracks.find((t) => t.template)!.items.map((i) => i.transform)).toEqual(before);
  const sample = await exportFrame(page, 1, [[0.5, 0.47]]);
  expect(sample.samples[0]![1]).toBeGreaterThan(200);
  await page.getByTestId('stage').scrollIntoViewIfNeeded();
  await shot(page, 'group-keyframe-midpoint');
  await expect
    .poll(() =>
      page.evaluate(
        async () =>
          (
            await (
              window as unknown as { __videoclip: { savedProject: () => Promise<Project> } }
            ).__videoclip.savedProject()
          ).tracks.find((t) => t.template)?.layout?.keyframes?.length,
      ),
    )
    .toBe(2);
  await page.reload();
  await expandAllGroups(page);
  await expect
    .poll(async () => (await current(page)).tracks.find((t) => t.template)?.layout?.keyframes?.length)
    .toBe(2);
});

test('膠卷多組來源的中間未選時段保留白色補時與框架，之後接回影片', async ({ page }) => {
  await createProjectWith(page, ['solid-blue.webm']);
  await openTab(page, '版型');
  await page.getByRole('button', { name: '直式膠卷', exact: true }).tap();
  await page
    .getByTestId('template-files')
    .setInputFiles(['tone-video.webm', 'solid-green.webm', 'solid-blue.webm'].map(fixture));
  await expect(page.locator('.busy')).toHaveCount(0);
  await page.getByRole('button', { name: '套用多格版型', exact: true }).tap();
  const cell = page.locator('.template-cell').first();
  await cell.getByRole('button', { name: '進階設定', exact: true }).tap();
  await cell.getByRole('button', { name: '補白', exact: true }).tap();
  await cell.getByRole('button', { name: '選取第 1 格片段範圍', exact: true }).tap();
  await shortFirstRange(page, 0.2);
  await sourcePoint(page, 0.5);
  await page
    .getByRole('dialog')
    .getByRole('button', { name: '在白線位置新增一組起迄標記', exact: true })
    .tap();
  await page.getByRole('button', { name: '套用片段範圍', exact: true }).tap();
  await cell.getByRole('button', { name: '第2段終點標記', exact: true }).press('ArrowRight');
  const group = (await current(page)).tracks.find((t) => t.template)!;
  expect((group.items[0] as VideoItem).sourceRanges?.[1]?.[1]).toBeCloseTo(2.05, 2);
  expect((group.items[0] as VideoItem).cell?.sourceEnd).toBeCloseTo(2.05, 2);
  expect(group.items.every((it) => it.duration === 3)).toBe(true);
  await seekTo(page, 1);
  await expect
    .poll(async () => {
      const c = await samplePreview(page, 0.5, 0.18);
      return !!c && c[0] > 245 && c[1] > 245 && c[2] > 245;
    })
    .toBe(true);
  const frame = await exportFrame(page, 1, [
    [0.5, 0.18],
    [0.5, 0.48],
  ]);
  expect(frame.samples[0]![0]).toBeGreaterThan(245);
  expect(frame.samples[0]![1]).toBeGreaterThan(245);
  expect(frame.samples[1]![1]).toBeGreaterThan(200);
  await page.getByTestId('stage').scrollIntoViewIfNeeded();
  await shot(page, 'template-multiple-ranges-white-gap');
  await seekTo(page, 1.7);
  await expect.poll(async () => isRed(await samplePreview(page, 0.5, 0.18))).toBe(true);
});

test('A B 示意動畫真的更新，疊化推移四宮格在交接前後套用且不延遲素材', async ({ page }) => {
  test.setTimeout(90000);
  await createProjectWith(page, ['solid-red.webm', 'solid-green.webm']);
  await openTab(page, '特效');
  const demo = page.locator('canvas[data-effect-demo="transition:crossfade"]');
  await demo.scrollIntoViewIfNeeded();
  await expect(demo).toHaveAttribute('data-demo-ready', 'true');
  const hash = () =>
    demo.evaluate((c) => {
      const canvas = c as HTMLCanvasElement;
      const d = canvas.getContext('2d')!.getImageData(0, 0, canvas.width, canvas.height).data;
      return d.reduce((n, v) => Math.imul(n ^ v, 16777619) >>> 0, 2166136261);
    });
  await shot(page, 'a-b-effect-options');
  const before = await hash();
  await expect.poll(hash).not.toBe(before);
  await page.getByRole('button', { name: '疊化', exact: true }).tap();
  await page.getByRole('button', { name: '檢視 A B 交接', exact: true }).tap();
  await seekTo(page, 3.85);
  await expect
    .poll(async () => {
      const c = await samplePreview(page, 0.5, 0.5);
      return !!c && c[0] > 100 && c[0] < 155 && c[1] < 20;
    })
    .toBe(true);
  let frame = await exportFrame(page, 3.85, [[0.5, 0.5]]);
  expect(frame.samples[0]![0]).toBeGreaterThan(100);
  expect(frame.samples[0]![1]).toBeLessThan(20);
  frame = await exportFrame(page, 4.15, [[0.5, 0.5]]);
  expect(frame.samples[0]![0]).toBeLessThan(20);
  expect(frame.samples[0]![1]).toBeGreaterThan(100);
  await page.getByTestId('stage').scrollIntoViewIfNeeded();
  await shot(page, 'crossfade-a-b');
  await page.getByRole('button', { name: '移除轉場', exact: true }).tap();
  await page.getByRole('button', { name: '相機動作', exact: true }).tap();
  await page.getByRole('button', { name: '向左推移', exact: true }).tap();
  await page.getByRole('button', { name: '檢視 A B 交接', exact: true }).tap();
  frame = await exportFrame(page, 4.15, [
    [0.25, 0.5],
    [0.75, 0.5],
  ]);
  expect(frame.samples[0]![0]).toBeLessThan(20);
  expect(frame.samples[0]![1]).toBeLessThan(20);
  expect(isGreen(frame.samples[1] as [number, number, number, number])).toBe(true);
  await page.getByRole('button', { name: '移除轉場', exact: true }).tap();
  await page.getByRole('button', { name: '特效', exact: true }).tap();
  await page.getByRole('button', { name: '四宮格', exact: true }).tap();
  frame = await exportFrame(page, 4.15, [
    [0.25, 0.25],
    [0.05, 0.05],
  ]);
  expect(isGreen(frame.samples[0] as [number, number, number, number])).toBe(true);
  expect(frame.samples[1]![0]).toBeLessThan(20);
  expect(frame.samples[1]![1]).toBeLessThan(20);
  await page.getByTestId('stage').scrollIntoViewIfNeeded();
  await seekTo(page, 4.15);
  await expect.poll(async () => isGreen(await samplePreview(page, 0.25, 0.25))).toBe(true);
  await shot(page, 'grid-a-b');
});

test('A B 轉場不會顯示來源中未選的灰區畫面', async ({ page }) => {
  await createProjectWith(page, ['solid-red.webm', 'solid-green.webm']);
  await clips(page).first().tap();
  await page.getByRole('button', { name: '片段範圍', exact: true }).tap();
  await shortFirstRange(page, 0.2);
  await sourcePoint(page, 0.9);
  await page
    .getByRole('dialog')
    .getByRole('button', { name: '在白線位置新增一組起迄標記', exact: true })
    .tap();
  const second = page.getByRole('button', { name: '第2段起點標記', exact: true });
  for (let i = 0; i < 5; i++) await second.press('ArrowRight');
  await page.getByRole('button', { name: '套用片段範圍', exact: true }).tap();
  await openTab(page, '特效');
  await page.getByRole('button', { name: '疊化', exact: true }).tap();
  await seekTo(page, 3.75);
  await expect
    .poll(async () => {
      const c = await samplePreview(page, 0.5, 0.5);
      return !!c && c[0] < 20 && c[1] < 20;
    })
    .toBe(true);
  const frame = await exportFrame(page, 3.75, [[0.5, 0.5]]);
  expect(frame.samples[0]![0]).toBeLessThan(20);
  expect(frame.samples[0]![1]).toBeLessThan(20);
});

test('轉場各分類選項都可實際套用及匯出，不只靜態縮圖', async ({ page }) => {
  test.setTimeout(180000);
  await createProjectWith(page, ['solid-red.webm', 'solid-green.webm']);
  await openTab(page, '特效');
  const errors: string[] = [];
  page.on('pageerror', (e) => errors.push(e.message));
  for (const effect of TRANSITIONS) {
    await page.getByRole('button', { name: effect.label, exact: true }).tap();
    expect((await current(page)).transitions![0]!.preset).toBe(effect.id);
    const frame = await exportFrame(page, 4, [[0.5, 0.5]]);
    expect(frame.bytes).toBeGreaterThan(1000);
    await page.getByRole('button', { name: '移除轉場', exact: true }).tap();
  }
  expect(errors).toEqual([]);
  expect((await current(page)).transitions).toEqual([]);
});

test('影片特效有分類與動畫，黑白柔焦干擾自然特效可套用及輸出', async ({ page }) => {
  test.setTimeout(180000);
  await createProjectWith(page, ['photo.png']);
  await openTab(page, '特效');
  await page.getByRole('tab', { name: '影片特效', exact: true }).tap();
  const errors: string[] = [];
  page.on('pageerror', (e) => errors.push(e.message));
  for (const effect of VIDEO_EFFECTS) {
    await page.getByRole('button', { name: effect.label, exact: true }).tap();
    expect((await current(page)).effects![0]!.preset).toBe(effect.id);
    const frame = await exportFrame(page, 0.5, [[0.15, 0.15]]);
    expect(frame.bytes).toBeGreaterThan(1000);
    if (effect.id === 'mono') {
      const c = frame.samples[0]!;
      expect(Math.abs(c[0]! - c[1]!)).toBeLessThan(3);
      expect(Math.abs(c[1]! - c[2]!)).toBeLessThan(3);
    }
    await page.getByRole('button', { name: '移除特效', exact: true }).tap();
  }
  await page.getByRole('button', { name: '自然', exact: true }).tap();
  await page.getByRole('button', { name: '星光', exact: true }).tap();
  await page.getByRole('button', { name: '檢視特效中點', exact: true }).tap();
  await shot(page, 'video-effects-natural');
  expect(errors).toEqual([]);
});

test('主題以有字圓圈顯示，GIPHY Key 在首頁設定管理且貼圖無棋盤格', async ({ page }) => {
  await createProjectWith(page, ['solid-red.webm']);
  const editor = page.url();
  await page.getByRole('link', { name: '回首頁', exact: true }).tap();
  await page.getByRole('link', { name: '設定', exact: true }).tap();
  await expect(page.getByRole('radiogroup', { name: '網頁風格' }).getByRole('radio')).toHaveCount(6);
  await page.getByRole('radio', { name: '清新薄荷', exact: true }).tap();
  await expect(page.locator('html')).toHaveAttribute('data-theme', 'fresh');
  await page.getByLabel('GIPHY API Key').fill('advanced-device-test');
  await page.getByRole('button', { name: '儲存 Key', exact: true }).tap();
  await shot(page, 'theme-circles-and-key-settings');
  await page.route('https://api.giphy.com/**', async (route) => {
    const url = new URL(route.request().url());
    expect(url.searchParams.get('api_key')).toBe('advanced-device-test');
    await route.fulfill({
      json: {
        data: [
          {
            id: 'sample',
            title: '透明測試',
            url: 'https://giphy.com/stickers/sample',
            images: {
              original: { url: 'https://media.giphy.com/sample.gif' },
              fixed_width: { url: 'https://media.giphy.com/sample.gif' },
            },
          },
        ],
      },
    });
  });
  await page.route('https://media.giphy.com/sample.gif', (route) =>
    route.fulfill({ path: fixture('animated-sticker.gif'), contentType: 'image/gif' }),
  );
  await page.goto(editor);
  await expandAllGroups(page);
  await openTab(page, '素材');
  await page.getByRole('button', { name: 'GIPHY 貼圖', exact: true }).tap();
  await expect(page.getByLabel('GIPHY API Key')).toHaveCount(0);
  await expect(page.getByRole('button', { name: '儲存 Key', exact: true })).toHaveCount(0);
  await expect(page.getByRole('button', { name: '移除 Key', exact: true })).toHaveCount(0);
  await page.getByLabel('搜尋 GIPHY 貼圖').fill('可愛');
  await page.getByRole('button', { name: '搜尋貼圖', exact: true }).tap();
  const sticker = page.getByRole('button', { name: '加入貼圖 透明測試', exact: true });
  await expect(sticker).toBeVisible();
  expect(await sticker.evaluate((el) => getComputedStyle(el).backgroundImage)).toBe('none');
  await expect(page.locator('.giphy-grid a')).toHaveCount(0);
  await expect(page.getByText('GIPHY 原圖', { exact: true })).toHaveCount(0);
  await sticker.scrollIntoViewIfNeeded();
  await shot(page, 'giphy-no-checker');
  await page.getByRole('link', { name: '回首頁', exact: true }).tap();
  await page.getByRole('link', { name: '設定', exact: true }).tap();
  await page.getByRole('button', { name: '移除 Key', exact: true }).tap();
  await page.goto(editor);
  await expandAllGroups(page);
  await openTab(page, '素材');
  await page.getByRole('button', { name: 'GIPHY 貼圖', exact: true }).tap();
  await expect(page.getByLabel('GIPHY API Key')).toBeVisible();
});
