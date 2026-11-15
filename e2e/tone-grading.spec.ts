import { expect, test, type Page } from '@playwright/test';
import { mkdir, writeFile } from 'node:fs/promises';
import type { Project, VideoItem } from '../src/model/types';
import { DEFAULT_ADJUSTMENT as D, gradeRGB, TONE_PRESETS, TONE_KEYS } from '../src/engine/grade';
import { animationValues } from '../src/engine/keyframes';
import {
  clips,
  createProjectWith,
  exportFrame,
  expandAllGroups,
  openTab,
  samplePreview,
  seekTo,
  waitForPreviewReady,
} from './helpers';

const points: [number, number][] = [
  [0.125, 1 / 6],
  [0.375, 1 / 6],
  [0.625, 1 / 6],
  [0.875, 1 / 6],
];
const palette = [
  [31, 31, 31],
  [128, 128, 128],
  [224, 224, 224],
  [179, 89, 51],
];
const current = (page: Page): Promise<Project> =>
  page.evaluate(() =>
    (window as unknown as { __videoclip: { project: () => Project } }).__videoclip.project(),
  );
const item = async (page: Page) => (await current(page)).tracks[0]!.items[0] as VideoItem;
const time = (page: Page) =>
  page.evaluate(() => (window as unknown as { __videoclip: { time: () => number } }).__videoclip.time());
async function at(page: Page, t: number) {
  await seekTo(page, t);
  await expect.poll(() => time(page)).toBeCloseTo(t, 1);
}
async function slider(page: Page, name: string, n: number) {
  await page.getByRole('slider', { name, exact: true }).evaluate((el, v) => {
    Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value')!.set!.call(el, String(v));
    el.dispatchEvent(new Event('input', { bubbles: true }));
  }, n);
}
async function shot(page: Page, name: string, selector = '.tone-panel') {
  await page.locator(selector).scrollIntoViewIfNeeded();
  await page.screenshot({ path: `docs/screenshots/tone/${name}.png`, scale: 'css' });
}
function checkPixel(actual: number[], expected: number[], tolerance = 4) {
  for (let i = 0; i < 3; i++) expect(Math.abs(actual[i]! - expected[i]!)).toBeLessThanOrEqual(tolerance);
}
const expected = (values: typeof D, i: number) =>
  gradeRGB(
    palette[i]!.map((v) => v / 255),
    values,
  ).map((v) => Math.round(v * 255));

test('獨立色調頁籤、全部預設及細調真正改變GPU畫面，透明區不被染色，復原可還原', async ({ page }) => {
  test.setTimeout(120000);
  await createProjectWith(page, ['tone-chart.png']);
  await clips(page).first().tap();
  await openTab(page, '剪輯');
  await expect(page.getByRole('slider', { name: '曝光', exact: true })).toHaveCount(0);
  await openTab(page, '色調');
  await expect(page.getByRole('region', { name: '色調設定' })).toBeVisible();
  for (const preset of TONE_PRESETS) {
    const button = page.getByRole('button', { name: `套用${preset.name}`, exact: true });
    await button.tap();
    await expect(button).toHaveAttribute('aria-pressed', 'true');
    const values = animationValues(await item(page), 0);
    for (const k of TONE_KEYS) expect(values[k]).toBeCloseTo(preset.values[k]);
    for (const i of [0, 2, 3])
      await expect
        .poll(async () => {
          const pixel = (await samplePreview(page, ...points[i]!))!;
          return Math.max(...pixel.slice(0, 3).map((v, j) => Math.abs(v - expected(preset.values, i)[j]!)));
        })
        .toBeLessThanOrEqual(4);
  }
  const controls = [
    ['亮度', 'brightness', 35, 1.35],
    ['飽和度', 'saturation', -40, 0.6],
    ['曝光', 'exposure', 0.5, 0.5],
    ['高光', 'highlights', -60, -0.6],
    ['對比', 'contrast', 35, 1.35],
    ['黑點', 'blacks', 40, 0.4],
    ['鮮艷度', 'vibrance', 45, 0.45],
    ['陰影', 'shadows', 30, 0.3],
    ['色溫', 'temperature', -40, -0.4],
    ['淡化', 'fade', 30, 0.3],
  ] as const;
  for (const [name, key, value, wanted] of controls) {
    await page.getByRole('button', { name: '還原目前色調', exact: true }).tap();
    await slider(page, name, value);
    const values = animationValues(await item(page), 0);
    expect(values[key]).toBeCloseTo(wanted);
    const frame = await exportFrame(page, 0, [points[0]!, points[2]!, points[3]!, [0.875, 5 / 6]]);
    for (const [j, i] of [0, 2, 3].entries()) checkPixel(frame.samples[j]!, expected(values, i));
    checkPixel(frame.samples[3]!, [0, 0, 0], 0); // Fully transparent source stays transparent over black.
  }
  await page.getByRole('button', { name: '套用復古風', exact: true }).tap();
  await shot(page, 'presets-and-adjustments');
  await page.getByRole('button', { name: '復原', exact: true }).tap();
  expect(animationValues(await item(page), 0).temperature).toBeCloseTo(0);
  await page.getByRole('button', { name: '重做', exact: true }).tap();
  expect(animationValues(await item(page), 0).temperature).toBeCloseTo(0.42);
});

test('色調與菱形定格共用，冷暖中點與匯出一致，重開保留且重設僅動目前定格', async ({ page }) => {
  await createProjectWith(page, ['tone-chart.png']);
  await clips(page).first().tap();
  await openTab(page, '色調');
  await page.getByRole('button', { name: '套用暖色調', exact: true }).tap();
  await page.getByRole('button', { name: '◇ 定格目前色調', exact: true }).tap();
  await at(page, 2);
  await page.getByRole('button', { name: '◇ 定格目前色調', exact: true }).tap();
  await page.getByRole('button', { name: '套用冷色調', exact: true }).tap();
  expect((await item(page)).keyframes).toHaveLength(2);
  await at(page, 1);
  const mid = animationValues(await item(page), 1);
  expect(mid.temperature).toBeCloseTo(0);
  const frame = await exportFrame(page, 1, points);
  for (let i = 0; i < 4; i++) {
    checkPixel(frame.samples[i]!, expected(mid, i));
    checkPixel((await samplePreview(page, ...points[i]!))!, frame.samples[i]!);
  }
  await shot(page, 'keyframe-midpoint');
  await page.getByRole('button', { name: '色調定格2 2.00秒', exact: true }).tap();
  await slider(page, '曝光', 1);
  const edited = await item(page);
  expect(edited.keyframes![0]!.values.exposure).toBe(0);
  expect(edited.keyframes![1]!.values.exposure).toBe(1);
  await page.getByRole('button', { name: '還原目前色調', exact: true }).tap();
  const reset = await item(page);
  expect(reset.keyframes).toHaveLength(2);
  expect(reset.keyframes![0]!.values.temperature).toBe(0.65);
  expect(reset.keyframes![1]!.values.temperature).toBe(0);
  await expect
    .poll(async () =>
      page.evaluate(async () => {
        const p = await (
          window as unknown as { __videoclip: { savedProject: () => Promise<Project> } }
        ).__videoclip.savedProject();
        return p?.tracks[0]?.items[0]?.keyframes?.[1]?.values.temperature;
      }),
    )
    .toBe(0);
  await page.reload();
  await waitForPreviewReady(page);
  await expandAllGroups(page);
  await clips(page).first().tap();
  await openTab(page, '色調');
  expect((await item(page)).keyframes).toHaveLength(2);
  await at(page, 1);
  expect(animationValues(await item(page), 1).temperature).toBeCloseTo(0.325);
  await page.getByRole('button', { name: '定格細部調整', exact: true }).tap();
  await page.getByRole('button', { name: '移除第2個定格', exact: true }).tap();
  await page.getByRole('button', { name: '完成定格', exact: true }).tap();
  expect((await item(page)).keyframes).toHaveLength(1);
});

test('完整影片匯出會在不同影格套用曝光與黑白漸變，片長與透明範圍不變', async ({ page }) => {
  test.setTimeout(150000);
  await createProjectWith(page, ['tone-chart.png']);
  await clips(page).first().tap();
  await openTab(page, '色調');
  await slider(page, '曝光', -1);
  await page.getByRole('button', { name: '◇ 定格目前色調', exact: true }).tap();
  await at(page, 2);
  await slider(page, '曝光', 1);
  await slider(page, '飽和度', -100);
  const source = await item(page);
  await page.getByRole('button', { name: '匯出影片', exact: true }).tap();
  await page.getByLabel('匯出解析度').selectOption('360');
  await page.getByLabel('匯出影格率').selectOption('24');
  await page.getByRole('button', { name: '開始匯出', exact: true }).tap();
  await expect(page.getByRole('link', { name: '下載影片', exact: true })).toBeVisible({ timeout: 90000 });
  const url = (await page.getByLabel('匯出影片預覽').getAttribute('src'))!;
  for (const t of [0.25, 1, 1.75]) {
    const result = await page.evaluate(
      async ({ url, t, pts }) =>
        (
          window as unknown as {
            __videoclip: {
              inspectMovie: (
                u: string,
                t: number,
                p: [number, number][],
              ) => Promise<{ duration: number; samples: number[][] }>;
            };
          }
        ).__videoclip.inspectMovie(url, t, pts),
      { url, t, pts: [points[1]!, points[3]!, [0.875, 5 / 6] as [number, number]] },
    );
    expect(result.duration).toBeCloseTo(3, 1);
    const values = animationValues(source, t);
    checkPixel(result.samples[0]!, expected(values, 1), 14);
    checkPixel(result.samples[1]!, expected(values, 3), 14);
    checkPixel(result.samples[2]!, [0, 0, 0], 14);
  }
  await shot(page, 'graded-video-export', '.sheet');
});

test('漸變色調疊柔焦顆粒及定格震動仍更新畫面與聲音，播放只改uniform、不重建濾鏡或媒體貼圖', async ({
  page,
}) => {
  await page.addInitScript(() => {
    const desc = Object.getOwnPropertyDescriptor(HTMLMediaElement.prototype, 'currentTime')!;
    const w = window as unknown as { toneSeekWrites: number };
    w.toneSeekWrites = 0;
    Object.defineProperty(HTMLMediaElement.prototype, 'currentTime', {
      configurable: true,
      get: desc.get,
      set: function (this: HTMLMediaElement, v: number) {
        if (this.closest('.pool')) w.toneSeekWrites++;
        desc.set!.call(this, v);
      },
    });
  });
  await createProjectWith(page, ['tone-chart-video.webm']);
  await clips(page).first().tap();
  await openTab(page, '色調');
  await page.getByRole('button', { name: '套用電影風', exact: true }).tap();
  await page.getByRole('button', { name: '◇ 定格目前色調', exact: true }).tap();
  await at(page, 3);
  await page.getByRole('button', { name: '套用鮮豔', exact: true }).tap();
  await at(page, 0);
  await page.getByRole('button', { name: '定格細部調整', exact: true }).tap();
  await page.getByRole('button', { name: '震一下', exact: true }).tap();
  await slider(page, '短特效長度', 3);
  await page.getByRole('button', { name: '完成定格', exact: true }).tap();
  await openTab(page, '特效');
  await page.getByRole('tab', { name: '影片特效', exact: true }).tap();
  for (const name of ['柔焦', '底片顆粒']) await page.getByRole('button', { name, exact: true }).tap();
  await at(page, 0);
  await page.getByRole('button', { name: '播放', exact: true }).tap();
  await expect.poll(() => time(page)).toBeGreaterThan(0.5);
  const snapshot = () =>
    page.evaluate(() => {
      const w = window as unknown as {
        toneSeekWrites: number;
        __videoclip: {
          mediaStats: () => {
            uploads: number;
            allocations: number;
            colorAllocations: number;
            colorUpdates: number;
            colorPasses: number;
            buffers: number;
          };
          audioEnergy: () => number;
        };
      };
      const el = Array.from(document.querySelectorAll<HTMLVideoElement>('.pool video')).find(
        (v) => !!v.dataset.itemId,
      )!;
      return {
        stats: w.__videoclip.mediaStats(),
        frameStamp: Number(el.dataset.frameStamp ?? 0),
        seeks: w.toneSeekWrites,
        energy: w.__videoclip.audioEnergy(),
        wall: performance.now(),
        mediaTime: el.currentTime,
      };
    });
  const before = await snapshot();
  await expect.poll(() => time(page)).toBeGreaterThan(1.6);
  const after = await snapshot();
  expect(after.stats.allocations - before.stats.allocations).toBe(0);
  expect(after.stats.colorAllocations - before.stats.colorAllocations).toBe(0);
  expect(after.stats.buffers).toBe(2); // Media plus the active grain layer.
  expect(after.stats.colorPasses).toBe(1);
  expect(after.stats.colorUpdates - before.stats.colorUpdates).toBeGreaterThan(5);
  expect(after.stats.uploads - before.stats.uploads).toBeGreaterThan(5);
  expect(after.frameStamp - before.frameStamp).toBeGreaterThan(5);
  expect(after.seeks - before.seeks).toBeLessThanOrEqual(1);
  expect(after.energy).toBeGreaterThan(0.005);
  await mkdir('test-results', { recursive: true });
  await writeFile(
    'test-results/tone-playback-metrics.json',
    JSON.stringify({ before, after, motion: (await item(page)).keyframes?.[0]?.motion }, null, 2),
  );
  await page.getByRole('button', { name: '暫停', exact: true }).tap();
  await shot(page, 'graded-effects-preview', '[data-testid="stage"]');
});

test('色調卡片與控制在窄手機保持同字級、緊湊內距與44px觸控，再次點選色調保持開啟', async ({ page }) => {
  await page.setViewportSize({ width: 320, height: 720 });
  await createProjectWith(page, ['tone-chart.png']);
  await clips(page).first().tap();
  await openTab(page, '色調');
  for (const width of [320, 430]) {
    await page.setViewportSize({ width, height: 844 });
    const info = await page.locator('.tone-panel').evaluate((el) => ({
      overflow: document.documentElement.scrollWidth > innerWidth,
      fonts: Array.from(el.querySelectorAll('.tone-preset span,.slider-label')).map(
        (e) => getComputedStyle(e).fontSize,
      ),
      tab: getComputedStyle(document.querySelector('.tab')!).fontSize,
      boxes: Array.from(el.querySelectorAll('.tone-preset,.tone-record')).map((e) => ({
        w: e.getBoundingClientRect().width,
        h: e.getBoundingClientRect().height,
      })),
    }));
    expect(info.overflow).toBe(false);
    expect(info.fonts.every((v) => v === info.tab)).toBe(true);
    expect(info.boxes.every((b) => b.w >= 44 && b.h >= 44)).toBe(true);
  }
  await openTab(page, '色調');
  await page.getByRole('tab', { name: '色調', exact: true }).tap();
  await expect(page.getByRole('region', { name: '色調設定' })).toBeVisible();
  await page.getByRole('tab', { name: '色調', exact: true }).tap();
  await expect(page.getByRole('region', { name: '色調設定' })).toBeVisible();
});
