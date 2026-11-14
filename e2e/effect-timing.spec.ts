import { test, expect, type Page } from '@playwright/test';
import { createProjectWith, openTab, clips, samplePreview, exportFrame } from './helpers';
import type { Project } from '../src/model/types';
const current = (page: Page): Promise<Project> =>
  page.evaluate(() =>
    (window as unknown as { __videoclip: { project: () => Project } }).__videoclip.project(),
  );
const sheet = (page: Page) => page.getByRole('dialog', { name: '特效起迄', exact: true });
async function point(page: Page, fraction: number) {
  const strip = sheet(page).getByRole('slider', { name: '選段白線位置', exact: true });
  await strip.scrollIntoViewIfNeeded();
  const b = (await strip.boundingBox())!;
  await strip.tap({ position: { x: b.width * fraction, y: b.height / 2 } });
}
async function single(page: Page) {
  await openTab(page, '特效');
  await page.getByRole('button', { name: '單一素材', exact: true }).tap();
  await page.getByRole('button', { name: '進場：疊化', exact: true }).tap();
  await page.getByRole('button', { name: '調整特效起迄', exact: true }).tap();
}
async function interval(page: Page, a: number, b: number) {
  // Extend the end first so the start can move anywhere without crossing its paired end.
  await sheet(page).getByLabel('第1組特效終點', { exact: true }).fill(String(b));
  await sheet(page).getByLabel('第1組特效起點', { exact: true }).fill(String(a));
}
async function shot(page: Page, name: string) {
  await expect(page.locator('.toast')).toHaveCount(0);
  await page.screenshot({ path: `docs/screenshots/effect-timing/${name}.png` });
}

test('10秒影片中3秒進場邊播邊動，白線同步、可暫停、匯出保留完整片長及聲音', async ({ page }) => {
  test.setTimeout(150000);
  await createProjectWith(page, ['timing-video.webm']);
  await single(page);
  await sheet(page).getByLabel('第1組特效終點', { exact: true }).fill('3');
  await expect(sheet(page).locator('.source-marker')).toHaveCount(1);
  await expect(sheet(page).getByLabel('第1組特效起點', { exact: true })).toHaveCount(0);
  await expect(sheet(page).getByLabel('第1組特效時長', { exact: true })).toHaveValue('3');
  // The actual video changes red -> green during the effect, not after it.
  await point(page, 0.12);
  await sheet(page).getByRole('button', { name: '播放特效結果', exact: true }).tap();
  await expect
    .poll(async () => {
      const c = await samplePreview(page, 0.5, 0.5);
      return !!c && c[1] > 40 && c[0] < 20;
    })
    .toBe(true);
  await sheet(page).getByRole('button', { name: '暫停特效結果', exact: true }).tap();
  const time = await sheet(page).getByRole('slider', { name: '選段白線位置' }).getAttribute('aria-valuenow');
  expect(Number(time)).toBeGreaterThan(1.5);
  expect(Number(time)).toBeLessThan(2.6);
  await expect(sheet(page).getByRole('button', { name: '播放特效結果', exact: true })).toHaveAttribute(
    'aria-pressed',
    'false',
  );
  const pixels = await sheet(page)
    .getByLabel('特效結果畫面', { exact: true })
    .evaluate((el) => [...(el as HTMLCanvasElement).getContext('2d')!.getImageData(120, 100, 1, 1).data]);
  expect(pixels[3]).toBe(255);
  expect(pixels[1]).toBeGreaterThan(20);
  await shot(page, 'three-seconds-playing-content');
  await sheet(page).getByRole('button', { name: '套用特效起迄', exact: true }).tap();
  const it = (await current(page)).tracks[0]!.items[0]!;
  expect(it.duration).toBeCloseTo(10, 1);
  expect(it.animations?.enter?.duration).toBe(3);
  expect(it.animations?.enter?.ranges).toBeUndefined();
  const red = await exportFrame(page, 1, [[0.5, 0.5]]),
    green = await exportFrame(page, 2, [[0.5, 0.5]]);
  expect(red.samples[0]![0]).toBeGreaterThan(60);
  expect(green.samples[0]![1]).toBeGreaterThan(40);
  expect(green.samples[0]![0]).toBeLessThan(20);
  await page.getByRole('button', { name: '匯出影片', exact: true }).tap();
  await page.getByLabel('匯出解析度', { exact: true }).selectOption('360');
  await page.getByLabel('匯出影格率', { exact: true }).selectOption('24');
  await page.getByRole('button', { name: '開始匯出', exact: true }).tap();
  await expect(page.getByRole('link', { name: '下載影片', exact: true })).toBeVisible({ timeout: 90000 });
  const url = (await page.getByLabel('匯出影片預覽', { exact: true }).getAttribute('src'))!;
  const movie = await page.evaluate(
    (url) =>
      (
        window as unknown as {
          __videoclip: {
            inspectMovie: (
              url: string,
              t: number,
              p: [number, number][],
            ) => Promise<{ duration: number; rms: number; samples: number[][] }>;
          };
        }
      ).__videoclip.inspectMovie(url, 2, [[0.5, 0.5]]),
    url,
  );
  expect(movie.duration).toBeCloseTo(10, 1);
  expect(movie.rms).toBeGreaterThan(0.01);
  expect(movie.samples[0]![1]).toBeGreaterThan(40);
  await shot(page, 'native-time-full-export');
});

test('單素材固定開頭B進或結尾A退，僅一個可調標籤、時長連動且可復原取消重開', async ({ page }) => {
  await createProjectWith(page, ['timing-video.webm']);
  await single(page);
  await expect(sheet(page).locator('.source-marker')).toHaveCount(1);
  await expect(sheet(page).locator('.source-marker')).toHaveText('▼迄');
  await expect(
    sheet(page).getByRole('button', { name: '在白線位置新增一組起迄標記', exact: true }),
  ).toHaveCount(0);
  await sheet(page).getByLabel('第1組特效終點', { exact: true }).fill('3');
  await sheet(page).getByLabel('第1組特效時長', { exact: true }).fill('4');
  await expect(sheet(page).getByLabel('第1組特效終點', { exact: true })).toHaveValue('4');
  await sheet(page).getByRole('button', { name: '復原上一步選段', exact: true }).tap();
  await expect(sheet(page).getByLabel('第1組特效時長', { exact: true })).toHaveValue('3');
  await sheet(page).getByRole('button', { name: '取消', exact: true }).tap();
  expect((await current(page)).tracks[0]!.items[0]!.animations?.enter?.duration).toBeCloseTo(0.6);
  await page.getByRole('button', { name: '調整特效起迄', exact: true }).tap();
  await sheet(page).getByLabel('第1組特效時長', { exact: true }).fill('3');
  await sheet(page).getByRole('button', { name: '套用特效起迄', exact: true }).tap();
  await expect
    .poll(async () =>
      page.evaluate(() =>
        (window as unknown as { __videoclip: { savedProject: () => Promise<Project> } }).__videoclip
          .savedProject()
          .then((p) => p.tracks[0]!.items[0]!.animations?.enter?.duration),
      ),
    )
    .toBe(3);
  await page.reload();
  await expect(page.locator('.editor')).toBeVisible();
  await openTab(page, '特效');
  await page.getByRole('button', { name: '單一素材', exact: true }).tap();
  await page.getByRole('button', { name: '調整特效起迄', exact: true }).tap();
  await expect(sheet(page).getByLabel('第1組特效終點', { exact: true })).toHaveValue('3');
  await sheet(page).getByRole('button', { name: '取消', exact: true }).tap();
  await page.getByRole('button', { name: '出場', exact: true }).tap();
  await page.getByRole('button', { name: '出場：向左推移', exact: true }).tap();
  await page.getByRole('button', { name: '調整特效起迄', exact: true }).tap();
  await expect(sheet(page).locator('.source-marker')).toHaveCount(1);
  await expect(sheet(page).locator('.source-marker')).toHaveText('▼起');
  await expect(sheet(page).getByLabel('第1組特效終點', { exact: true })).toHaveCount(0);
  await sheet(page).getByLabel('第1組特效時長', { exact: true }).fill('3');
  const duration = (await current(page)).tracks[0]!.items[0]!.duration;
  await expect(sheet(page).getByLabel('第1組特效起點', { exact: true })).toHaveValue(
    String(Number((duration - 3).toFixed(2))),
  );
  await sheet(page).getByLabel('第1組特效起點', { exact: true }).fill('8');
  await expect(sheet(page).getByLabel('第1組特效時長', { exact: true })).toHaveValue(
    String(Number((duration - 8).toFixed(2))),
  );
  await expect(sheet(page).getByLabel('目前特效預覽時間')).toHaveText(`8.00 / ${duration.toFixed(2)} 秒`);
  // Preview must be LEFT of the timeline and numeric controls, including the narrowest phone.
  for (const viewport of [
    { width: 390, height: 844 },
    { width: 375, height: 667 },
    { width: 320, height: 568 },
  ]) {
    await page.setViewportSize(viewport);
    const layout = await sheet(page).evaluate((el) => {
      const visible = ['canvas', '.source-range', '.single-edge-fields', '.sheet-row'].map((selector) => {
        const b = el.querySelector(selector)!.getBoundingClientRect();
        return b.top >= 0 && b.bottom <= innerHeight && b.left >= 0 && b.right <= innerWidth;
      });
      return {
        visible,
        scroll: el.scrollHeight - el.clientHeight,
        strip: el.querySelector('.source-range')!.clientHeight,
        preview: (() => {
          const r = el.querySelector('canvas')!.getBoundingClientRect();
          return { left: r.left, right: r.right, top: r.top, bottom: r.bottom };
        })(),
        timeline: (() => {
          const r = el.querySelector('.source-range')!.getBoundingClientRect();
          return { left: r.left, right: r.right, top: r.top, bottom: r.bottom };
        })(),
        fieldsLeft: el.querySelector('.single-edge-fields')!.getBoundingClientRect().left,
        ticks: Array.from(el.querySelectorAll('.range-seconds span')).map((tick) => {
          const r = tick.getBoundingClientRect();
          return { left: r.left, right: r.right };
        }),
      };
    });
    expect(layout.visible).toEqual([true, true, true, true]);
    expect(layout.scroll).toBeLessThanOrEqual(1);
    expect(layout.strip).toBe(44);
    expect(layout.preview.right).toBeLessThan(layout.timeline.left);
    expect(layout.preview.right).toBeLessThan(layout.fieldsLeft);
    expect(layout.timeline.top).toBeLessThan(layout.preview.bottom);
    expect(layout.timeline.bottom).toBeGreaterThan(layout.preview.top);
    expect(layout.timeline.right - layout.timeline.left).toBeGreaterThan(100);
    for (const tick of layout.ticks) {
      expect(tick.left).toBeGreaterThanOrEqual(0);
      expect(tick.right).toBeLessThanOrEqual(viewport.width);
    }
    for (let i = 1; i < layout.ticks.length; i++)
      expect(layout.ticks[i]!.left).toBeGreaterThanOrEqual(layout.ticks[i - 1]!.right);
    if (viewport.width === 320) await shot(page, 'side-by-side-single-range-320');
  }
  await page.setViewportSize({ width: 390, height: 844 });
  await shot(page, 'anchored-single-range-and-undo');
});

test('兩支10秒影片分配A退B進的3秒與不對稱起迄，總長20秒且來源持續播放', async ({ page }) => {
  await createProjectWith(page, ['timing-video.webm', 'timing-video.webm']);
  await openTab(page, '特效');
  await page.getByRole('button', { name: '疊化', exact: true }).tap();
  await page.getByRole('button', { name: '調整特效起迄', exact: true }).tap();
  const p = await current(page),
    join = p.tracks[0]!.items[1]!.start;
  await sheet(page).getByLabel('第1組特效時長', { exact: true }).fill('3');
  await expect(sheet(page).getByLabel('第1組特效時長', { exact: true })).toHaveValue('3');
  await expect(sheet(page)).toContainText('B 終點 1.50 秒');
  await shot(page, 'pair-A-start-B-end');
  await sheet(page).getByRole('button', { name: '套用特效起迄', exact: true }).tap();
  const saved = await current(page);
  expect(saved.tracks[0]!.items.map((it) => [it.start, it.duration])).toEqual(
    p.tracks[0]!.items.map((it) => [it.start, it.duration]),
  );
  expect(saved.tracks[0]!.items.at(-1)!.start + saved.tracks[0]!.items.at(-1)!.duration).toBeCloseTo(20, 1);
  const green = await exportFrame(page, 9, [[0.5, 0.5]]),
    red = await exportFrame(page, join + 0.75, [[0.5, 0.5]]);
  expect(green.samples[0]![1]).toBeGreaterThan(50);
  expect(green.samples[0]![0]).toBeLessThan(20);
  expect(red.samples[0]![0]).toBeGreaterThan(90);
  expect(red.samples[0]![1]).toBeLessThan(20);
  await page.getByRole('button', { name: '調整特效起迄', exact: true }).tap();
  await interval(page, join - 2, join + 1);
  await sheet(page).getByRole('button', { name: '套用特效起迄', exact: true }).tap();
  expect((await current(page)).transitions![0]!.ranges).toEqual([[join - 2, join + 1]]);
});

test('影片特效也共用多組標記，來源修剪可移除最後一組但不誤套用完整來源', async ({ page }) => {
  await createProjectWith(page, ['timing-video.webm']);
  await openTab(page, '特效');
  await page.getByRole('tab', { name: '影片特效', exact: true }).tap();
  await page.getByRole('button', { name: '黑白電影', exact: true }).tap();
  await page.getByRole('button', { name: '調整特效起迄', exact: true }).tap();
  await interval(page, 1, 3);
  await point(page, 0.6);
  await sheet(page).getByRole('button', { name: '在白線位置新增一組起迄標記', exact: true }).tap();
  await expect(sheet(page).locator('.source-marker')).toHaveCount(4);
  await sheet(page).getByRole('button', { name: '套用特效起迄', exact: true }).tap();
  const frame = await exportFrame(page, 2, [[0.5, 0.5]]),
    outside = await exportFrame(page, 4, [[0.5, 0.5]]);
  expect(Math.abs(frame.samples[0]![0]! - frame.samples[0]![1]!)).toBeLessThan(3);
  expect(outside.samples[0]![0]).toBeGreaterThan(200);
  await clips(page).first().tap();
  await openTab(page, '剪輯');
  await page.getByRole('button', { name: '片段範圍', exact: true }).tap();
  const trim = page.getByRole('dialog', { name: '剪取片段', exact: true });
  await trim.getByRole('button', { name: '移除第 1 組片段', exact: true }).tap();
  await expect(trim.locator('.source-marker')).toHaveCount(0);
  await expect(trim.getByRole('button', { name: '套用片段範圍', exact: true })).toBeDisabled();
  await trim.getByRole('button', { name: '復原上一步選段', exact: true }).tap();
  await expect(trim.locator('.source-marker')).toHaveCount(2);
  await shot(page, 'shared-trim-pair-removal');
  await trim.getByRole('button', { name: '取消', exact: true }).tap();
});
