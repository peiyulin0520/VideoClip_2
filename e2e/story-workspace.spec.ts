import { expect, test, type Page } from '@playwright/test';
import type { Project, VideoItem } from '../src/model/types';
import {
  createProjectWith,
  openTab,
  addOverlays,
  fixture,
  seekTo,
  samplePreview,
  isBlue,
  isRed,
  isGreen,
  exportFrame,
  pinchSelection,
} from './helpers';
const shots = 'docs/screenshots/story-workspace';
const current = (page: Page): Promise<Project> =>
  page.evaluate(() =>
    (window as unknown as { __videoclip: { project: () => Project } }).__videoclip.project(),
  );
async function shot(page: Page, name: string) {
  await expect(page.locator('.toast')).toHaveCount(0);
  await page.screenshot({ path: `${shots}/${name}.png` });
}
async function template(
  page: Page,
  style = '直式膠卷',
  files = ['solid-red.webm', 'solid-green.webm', 'solid-blue.webm'],
  seconds = 3,
) {
  await openTab(page, '版型');
  await page.getByRole('button', { name: style, exact: true }).tap();
  await page.getByTestId('template-files').setInputFiles(files.map(fixture));
  await expect(page.locator('.busy')).toHaveCount(0);
  const p = await current(page);
  for (let i = 0; i < files.length; i++)
    await page
      .getByLabel(`第 ${i + 1} 格素材`, { exact: true })
      .selectOption(p.assets.find((a) => a.name === files[i])!.id);
  await page.getByLabel('版型動態效果').selectOption('none');
  await page.getByLabel('版型長度', { exact: true }).fill(String(seconds));
  await page.getByRole('button', { name: '套用多格版型', exact: true }).tap();
  await expect.poll(async () => (await current(page)).tracks.filter((t) => t.template).length).toBe(1);
}
async function sourcePoint(page: Page, fraction: number) {
  const strip = page.locator('.sheet .source-thumbs').first();
  await strip.scrollIntoViewIfNeeded();
  await strip.tap({ position: { x: (await strip.boundingBox())!.width * fraction, y: 30 } });
}

test('時間軸預設收合，展開各層；頁尾停在最後功能，沒有回頂保留空白', async ({ page }) => {
  await createProjectWith(page, ['solid-blue.webm'], false);
  const toggle = page.getByRole('button', { name: /^展開時間軸/ });
  await expect(toggle).toHaveAttribute('aria-expanded', 'false');
  await expect(page.locator('#editor-timeline')).toBeHidden();
  await addOverlays(
    page,
    Array.from({ length: 7 }, () => 'photo.png'),
  );
  await page.getByRole('button', { name: /^展開時間軸/ }).tap();
  await expect(page.getByTestId('track')).toHaveCount(8);
  await shot(page, 'expanded-layers');
  await page.getByRole('button', { name: /^收合時間軸/ }).tap();
  await openTab(page, '素材');
  await page.locator('.editor').evaluate((el) => (el.scrollTop = el.scrollHeight));
  const gap = await page.evaluate(
    () =>
      document.querySelector('.editor')!.getBoundingClientRect().bottom -
      document.querySelector('.bottombar')!.getBoundingClientRect().bottom,
  );
  expect(gap).toBeLessThan(12);
  await expect(page.getByRole('button', { name: '回到最上方預覽', exact: true })).toBeHidden();
  await shot(page, 'collapsed-no-footer-gap');
});

test('預覽雙指縮放整條膠卷與每格來源，單格點選不會改變內部位置', async ({ page }) => {
  await createProjectWith(page, ['solid-blue.webm']);
  await template(page);
  await seekTo(page, 1);
  await page.getByRole('button', { name: '回到預覽', exact: true }).tap();
  const before = (await current(page)).tracks.find((t) => t.template)!,
    transforms = before.items.map((i) => i.transform);
  await pinchSelection(page, 0.65);
  const group = (await current(page)).tracks.find((t) => t.template)!;
  expect(group.layout!.transform!.scale).toBeLessThan(0.8);
  expect(group.items.map((i) => i.transform)).toEqual(transforms);
  const scale = group.layout!.transform!.scale;
  await expect.poll(async () => isRed(await samplePreview(page, 0.5, 0.5 + (0.18 - 0.5) * scale))).toBe(true);
  await expect.poll(async () => isBlue(await samplePreview(page, 0.05, 0.1))).toBe(true);
  const frame = await exportFrame(page, 1, [
    [0.5, 0.5 + (0.18 - 0.5) * scale],
    [0.5, 0.5 + (0.48 - 0.5) * scale],
  ]);
  expect(frame.samples[0]![0]).toBeGreaterThan(200);
  expect(frame.samples[1]![1]).toBeGreaterThan(200);
  await shot(page, 'filmstrip-group-scale');
  await page.getByRole('link', { name: '回首頁', exact: true }).tap();
  await page.goBack();
  await expect
    .poll(async () => (await current(page)).tracks.find((t) => t.template)?.layout?.transform?.scale)
    .toBeCloseTo(scale);
});

test('每格來源可獨立選段，共同長度不變，短素材補白且可穿插色塊', async ({ page }) => {
  await createProjectWith(page, ['solid-blue.webm']);
  await template(page, '直式膠卷', ['clip-b.webm', 'solid-green.webm', 'solid-red.webm'], 4);
  await seekTo(page, 2);
  await expect
    .poll(async () => {
      const c = await samplePreview(page, 0.5, 0.18);
      return c && c[0]! < 8 && c[1]! < 8;
    })
    .toBe(true);
  const first = page.locator('.template-cell').nth(0);
  await first.getByRole('button', { name: '補白', exact: true }).tap();
  await expect
    .poll(async () => {
      const c = await samplePreview(page, 0.5, 0.18);
      return c && c[0]! > 240 && c[1]! > 240;
    })
    .toBe(true);
  await first.getByRole('button', { name: '放大選取第 1 格片段', exact: true }).tap();
  const marker = page
    .getByRole('dialog', { name: '剪取片段' })
    .getByRole('button', { name: '來源起點標記', exact: true });
  await marker.focus();
  await page.keyboard.press('ArrowRight');
  await page.getByRole('button', { name: '套用片段範圍', exact: true }).tap();
  let g = (await current(page)).tracks.find((t) => t.template)!;
  expect(g.items.map((i) => i.duration)).toEqual([4, 4, 4]);
  expect((g.items[0] as VideoItem).trimIn).toBeCloseTo(0.05);
  const second = page.locator('.template-cell').nth(1);
  await second.locator('summary').tap();
  await seekTo(page, 1);
  await second.getByRole('button', { name: '在此格目前秒數插入色塊', exact: true }).tap();
  await seekTo(page, 1.5);
  const blank = await exportFrame(page, 1.5, [[0.5, 0.48]]);
  expect(blank.samples[0]![1]).toBeLessThan(8);
  await seekTo(page, 2.5);
  await expect.poll(async () => isGreen(await samplePreview(page, 0.5, 0.48))).toBe(true);
  await shot(page, 'cell-source-and-color-gaps');
  await second.getByRole('button', { name: '移除此色塊', exact: true }).tap();
  g = (await current(page)).tracks.find((t) => t.template)!;
  expect((g.items[1] as VideoItem).cell!.blanks).toEqual([]);
  await page.getByRole('button', { name: '套用多格版型', exact: true }).tap();
  await expect
    .poll(async () => ((await current(page)).tracks.find((t) => t.template)!.items[0] as VideoItem).trimIn)
    .toBeCloseTo(0.05);
  expect((await current(page)).tracks.find((t) => t.template)!.items.map((i) => i.duration)).toEqual([
    4, 4, 4,
  ]);
  expect((await current(page)).tracks.find((t) => t.template)!.items[0]!.start).toBe(0);
});

test('音訊可直接標記多組精確靜音起迄，顯示對應畫面並可移除其中一組', async ({ page }) => {
  await createProjectWith(page, ['tone-video.webm']);
  await openTab(page, '音訊');
  await page.getByRole('button', { name: '聲音片段範圍', exact: true }).tap();
  for (const [a, b] of [
    [0.1, 0.2],
    [0.5, 0.7],
  ]) {
    await sourcePoint(page, a!);
    await page.getByRole('button', { name: '標記靜音起點', exact: true }).tap();
    await sourcePoint(page, b!);
    await page.getByRole('button', { name: '標記靜音終點並新增', exact: true }).tap();
  }
  await expect(page.locator('.source-marker')).toHaveCount(4);
  await expect(page.getByRole('button', { name: '第2組靜音起點標記', exact: true })).toBeVisible();
  await shot(page, 'explicit-multiple-mute-pairs');
  await page.getByRole('button', { name: '移除第 1 組靜音', exact: true }).tap();
  await expect(page.locator('.source-marker')).toHaveCount(2);
  await page.getByRole('button', { name: '套用聲音選段', exact: true }).tap();
  const item = (await current(page)).tracks[0]!.items[0] as VideoItem;
  expect(item.duration).toBeCloseTo(3);
  expect(item.audioRanges!.length).toBe(2);
});

test('特效頁籤可加入閃光與暖光，預覽、匯出與移除一致', async ({ page }) => {
  await createProjectWith(page, ['solid-blue.webm']);
  await seekTo(page, 1);
  await openTab(page, '特效');
  await page.getByRole('button', { name: /^閃光/ }).tap();
  await page.getByRole('button', { name: '檢視特效中點', exact: true }).tap();
  await expect
    .poll(async () => {
      const c = await samplePreview(page, 0.5, 0.5);
      return c && c[0]! > 245 && c[1]! > 245 && c[2]! > 245;
    })
    .toBe(true);
  const effect = (await current(page)).effects![0]!;
  const frame = await exportFrame(page, effect.start + effect.duration / 2, [[0.5, 0.5]]);
  expect(frame.samples[0]![0]).toBeGreaterThan(245);
  await shot(page, 'flash-effect');
  await page.getByRole('button', { name: '移除特效', exact: true }).tap();
  await expect.poll(async () => isBlue(await samplePreview(page, 0.5, 0.5))).toBe(true);
  await page.getByRole('button', { name: /^暖光掃過/ }).tap();
  await page.getByRole('button', { name: '檢視特效中點', exact: true }).tap();
  await expect
    .poll(async () => {
      const c = await samplePreview(page, 0.5, 0.5);
      return c && c[0]! > 240 && c[1]! > 200;
    })
    .toBe(true);
  await shot(page, 'warm-light-effect');
});

test('展開故事從單片到三格、字體快速切換，最後暖光；也能改為兩格', async ({ page }) => {
  test.setTimeout(90000);
  await createProjectWith(page, ['solid-blue.webm']);
  await template(page, '展開故事');
  await seekTo(page, 0.1);
  await expect.poll(async () => isRed(await samplePreview(page, 0.5, 0.5))).toBe(true);
  const start = await exportFrame(page, 0.1, [
    [0.5, 0.05],
    [0.5, 0.5],
  ]);
  expect(start.samples[0]![0]).toBeLessThan(40);
  expect(start.samples[1]![0]).toBeGreaterThan(200);
  await page.getByRole('button', { name: '回到預覽', exact: true }).tap();
  await shot(page, 'story-single-opening');
  await seekTo(page, 1.8);
  await expect.poll(async () => isGreen(await samplePreview(page, 0.5, 0.4))).toBe(true);
  await expect.poll(async () => isBlue(await samplePreview(page, 0.5, 0.85))).toBe(true);
  const hash = () =>
    page.evaluate(() =>
      (
        window as unknown as {
          __videoclip: { regionHash: (a: number, b: number, c: number, d: number) => number };
        }
      ).__videoclip.regionHash(0.1, 0.43, 0.9, 0.57),
    );
  const a = await hash();
  await seekTo(page, 1.96);
  await expect.poll(hash).not.toBe(a);
  await shot(page, 'story-three-cells-font-cycle');
  const flash = await exportFrame(page, 2.65, [[0.5, 0.15]]);
  expect(flash.samples[0]![1]).toBeGreaterThan(150);
  await openTab(page, '版型');
  await page.getByRole('button', { name: '2 格故事', exact: true }).tap();
  await seekTo(page, 0);
  await page.getByRole('button', { name: '套用多格版型', exact: true }).tap();
  await expect.poll(async () => (await current(page)).tracks.find((t) => t.template)!.items.length).toBe(2);
  await seekTo(page, 1.8);
  await expect.poll(async () => isGreen(await samplePreview(page, 0.5, 0.8))).toBe(true);
  await shot(page, 'story-two-cells');
});

test('模板色塊期間音訊也靜音，後續畫面及聲音接續並完整匯出', async ({ page }) => {
  test.setTimeout(120000);
  await createProjectWith(page, ['solid-blue.webm']);
  await template(page, '直式膠卷', ['tone-video.webm', 'solid-green.webm', 'solid-red.webm'], 4);
  const first = page.locator('.template-cell').first();
  await seekTo(page, 1);
  await first.getByRole('button', { name: '在此格目前秒數插入色塊', exact: true }).tap();
  await page.getByRole('button', { name: '匯出影片', exact: true }).tap();
  await page.getByLabel('匯出解析度').selectOption('360');
  await page.getByLabel('匯出影格率').selectOption('24');
  await page.getByRole('button', { name: '開始匯出', exact: true }).tap();
  await expect(page.getByRole('link', { name: '下載影片', exact: true })).toBeVisible({ timeout: 90000 });
  const url = (await page.getByLabel('匯出影片預覽').getAttribute('src'))!;
  const output = await page.evaluate(async (url) => {
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
    return [
      await hook.inspectMovie(url, 1.4, [[0.5, 0.18]]),
      await hook.inspectMovie(url, 2.5, [[0.5, 0.18]]),
    ];
  }, url);
  expect(output[0]!.rms).toBeLessThan(0.001);
  expect(output[0]!.samples[0]![0]).toBeLessThan(20);
  expect(output[1]!.rms).toBeGreaterThan(0.01);
  expect(output[1]!.samples[0]![0]).toBeGreaterThan(200);
  expect(output[1]!.duration).toBeCloseTo(4, 1);
  await shot(page, 'template-gaps-export');
});
