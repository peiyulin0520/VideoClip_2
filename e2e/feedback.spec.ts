import { expect, test, type Page, type Locator } from '@playwright/test';
import type { Project } from '../src/model/types';
import {
  createProjectWith,
  addOverlays,
  clips,
  fixture,
  openTab,
  seekTo,
  samplePreview,
  isRed,
  isGreen,
  isBlue,
  exportFrame,
} from './helpers';
const shots = 'docs/screenshots/feedback';
const current = (page: Page): Promise<Project> =>
  page.evaluate(() =>
    (window as unknown as { __videoclip: { project: () => Project } }).__videoclip.project(),
  );
async function slider(page: Page, label: string, n: number) {
  await page.getByRole('slider', { name: label, exact: true }).evaluate((el, v) => {
    Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value')!.set!.call(el, String(v));
    el.dispatchEvent(new Event('input', { bubbles: true }));
  }, n);
}
async function drag(page: Page, loc: Locator, dx: number, dy = 0) {
  const b = (await loc.boundingBox())!;
  await page.mouse.move(b.x + b.width / 2, b.y + b.height / 2);
  await page.mouse.down();
  await page.mouse.move(b.x + b.width / 2 + dx, b.y + b.height / 2 + dy, { steps: 8 });
  await page.mouse.up();
}

test('左端修剪固定片尾並留下空白，完整來源隨時可以還原', async ({ page }) => {
  await createProjectWith(page, ['tone-video.webm']);
  await clips(page).first().tap();
  const before = (await clips(page).first().boundingBox())!;
  await drag(page, page.getByTestId('trim-start'), 60);
  const item = (await current(page)).tracks[0]!.items[0]!;
  expect(item.start).toBeCloseTo(1, 1);
  expect(item.duration).toBeCloseTo(2, 1);
  const after = (await clips(page).first().boundingBox())!;
  expect(after.x + after.width).toBeCloseTo(before.x + before.width, 0);
  await seekTo(page, 0.4);
  await expect
    .poll(async () => {
      const c = await samplePreview(page, 0.5, 0.5);
      return !!c && c[0]! < 8 && c[1]! < 8;
    })
    .toBe(true);
  await page.getByRole('button', { name: '片段範圍', exact: true }).tap();
  await expect(page.getByTestId('source-range-values')).toContainText('原始素材 3.0 秒');
  await page.screenshot({ path: `${shots}/complete-source-range.png` });
  await page.getByRole('button', { name: '還原完整素材', exact: true }).tap();
  await page.getByRole('button', { name: '套用片段範圍', exact: true }).tap();
  expect((await current(page)).tracks[0]!.items[0]).toMatchObject({ start: 0, trimIn: 0 });
  expect((await current(page)).tracks[0]!.items[0]!.duration).toBeCloseTo(3, 1);
  await expect.poll(async () => isRed(await samplePreview(page, 0.5, 0.5))).toBe(true);
});

test('完整來源選區左右拉桿獨立，裁掉的範圍可以再次展開', async ({ page }) => {
  await createProjectWith(page, ['tone-video.webm']);
  await clips(page).first().tap();
  await page.getByRole('button', { name: '片段範圍', exact: true }).tap();
  const box = (await page.getByTestId('source-range').boundingBox())!;
  await drag(page, page.getByRole('button', { name: '來源起點拉桿' }), box.width * 0.2);
  await drag(page, page.getByRole('button', { name: '來源終點拉桿' }), -box.width * 0.2);
  await expect(page.getByTestId('source-range-values')).toContainText('來源 0.6 秒 → 2.4 秒');
  await page.getByRole('button', { name: '套用片段範圍' }).tap();
  let it = (await current(page)).tracks[0]!.items[0]!;
  expect(it.duration).toBeCloseTo(1.8, 1);
  await page.getByRole('button', { name: '片段範圍', exact: true }).tap();
  await drag(page, page.getByRole('button', { name: '來源終點拉桿' }), box.width * 0.2);
  await page.getByRole('button', { name: '套用片段範圍' }).tap();
  it = (await current(page)).tracks[0]!.items[0]!;
  expect(it.duration).toBeCloseTo(2.4, 1);
  expect(it.start).toBeCloseTo(0.6, 1);
});

test('時間軸左側直接觸控拖曳排序圖層，畫面疊放與復原一致', async ({ page }) => {
  await createProjectWith(page, ['solid-blue.webm']);
  await addOverlays(page, ['solid-red.webm', 'solid-green.webm']);
  await expect.poll(async () => isGreen(await samplePreview(page, 0.5, 0.5))).toBe(true);
  const p = await current(page),
    top = p.tracks[2]!,
    lower = p.tracks[1]!;
  const first = page.locator(`[data-track-id="${top.id}"]`).getByTestId('track-chip'),
    second = page.locator(`[data-track-id="${lower.id}"]`).getByTestId('track-chip');
  const a = (await first.boundingBox())!,
    b = (await second.boundingBox())!;
  const cdp = await page.context().newCDPSession(page);
  await cdp.send('Input.dispatchTouchEvent', {
    type: 'touchStart',
    touchPoints: [{ x: a.x + 22, y: a.y + a.height / 2, id: 1 }],
  });
  for (let i = 1; i <= 8; i++)
    await cdp.send('Input.dispatchTouchEvent', {
      type: 'touchMove',
      touchPoints: [{ x: a.x + 22, y: a.y + a.height / 2 + ((b.y - a.y) * i) / 8, id: 1 }],
    });
  await cdp.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] });
  await cdp.detach();
  await expect.poll(async () => isRed(await samplePreview(page, 0.5, 0.5))).toBe(true);
  expect((await current(page)).tracks[2]!.id).toBe(lower.id);
  await expect(page.getByRole('button', { name: '隱藏這條軌道', exact: true })).toHaveCount(0);
  await page.screenshot({ path: `${shots}/direct-layer-order.png` });
  await page.getByRole('button', { name: '復原', exact: true }).tap();
  await expect.poll(async () => isGreen(await samplePreview(page, 0.5, 0.5))).toBe(true);
});

test('動態貼圖持續切換，貼圖紋理保持原尺寸而不擴成整個預覽', async ({ page }) => {
  await createProjectWith(page, ['solid-blue.webm']);
  await openTab(page, '素材');
  await page.getByTestId('sticker-files').setInputFiles(fixture('animated-sticker.gif'));
  await expect(clips(page)).toHaveCount(2);
  await seekTo(page, 0.1);
  await expect.poll(async () => isRed(await samplePreview(page, 0.5, 0.5))).toBe(true);
  await seekTo(page, 0.4);
  await expect.poll(async () => isGreen(await samplePreview(page, 0.5, 0.5))).toBe(true);
  await seekTo(page, 0.7);
  await expect.poll(async () => isRed(await samplePreview(page, 0.5, 0.5))).toBe(true);
  const p = await current(page),
    id = p.tracks[1]!.items[0]!.id;
  const stats = await page.evaluate(() =>
    (
      window as unknown as {
        __videoclip: { mediaStats: () => { frames: { id: string; width: number; height: number }[] } };
      }
    ).__videoclip.mediaStats(),
  );
  const texture = stats.frames.find((f) => f.id === id)!;
  expect(texture.width).toBeLessThanOrEqual(120);
  expect(texture.height).toBeLessThanOrEqual(120);
  await seekTo(page, 0);
  await page.getByRole('button', { name: '播放', exact: true }).tap();
  await expect
    .poll(async () =>
      page.evaluate(() => (window as unknown as { __videoclip: { time: () => number } }).__videoclip.time()),
    )
    .toBeGreaterThan(0.65);
  await page.getByRole('button', { name: '暫停', exact: true }).tap();
  await page.screenshot({ path: `${shots}/gif-native-texture.png` });
});

test('字塊可無填滿只留框線，兩者透明度互不影響，預覽與單格匯出一致', async ({ page }) => {
  await createProjectWith(page, ['solid-blue.webm']);
  await openTab(page, '文字');
  await page.getByRole('button', { name: /新增圖形（/ }).tap();
  await page.getByRole('tab', { name: '字塊', exact: true }).tap();
  await page.getByRole('radio', { name: '方形', exact: true }).tap();
  await slider(page, '填滿透明度', 0);
  await slider(page, '字塊外框', 20);
  await slider(page, '框線透明度', 100);
  const p = await current(page),
    card = p.tracks[1]!.items[0]!.type === 'text' ? p.tracks[1]!.items[0]!.card : null;
  expect(card!.box).toMatchObject({ opacity: 0, stroke: { width: 20, opacity: 1 } });
  await expect.poll(async () => isBlue(await samplePreview(page, 0.5, 0.5))).toBe(true);
  const frame = await exportFrame(page, 1, [[0.5, 0.5]]);
  expect(frame.samples[0]![2]).toBeGreaterThan(200);
  const count = () =>
    page.evaluate(() =>
      (
        window as unknown as {
          __videoclip: {
            countColor: (rgb: number[], tol: number, x: number, y: number, w: number, h: number) => number;
          };
        }
      ).__videoclip.countColor([255, 255, 255], 25, 0.1, 0.1, 0.9, 0.9),
    );
  await expect.poll(count).toBeGreaterThan(100);
  await slider(page, '框線透明度', 0);
  await expect.poll(count).toBe(0);
  await slider(page, '框線透明度', 50);
  expect((await current(page)).tracks[1]!.items[0]!.type).toBe('text');
  await page.screenshot({ path: `${shots}/independent-fill-outline.png` });
});

async function template(page: Page) {
  await createProjectWith(page, ['solid-blue.webm']);
  await openTab(page, '版型');
  await page
    .getByTestId('template-files')
    .setInputFiles([
      fixture('solid-red.webm'),
      fixture('solid-green.webm'),
      fixture('solid-blue.webm'),
      fixture('photo.png'),
    ]);
  await expect(page.getByLabel('第 1 格素材').locator('option')).toHaveCount(6);
}

test('版型格子位置與素材可辨識，套用後只有一個群組，刪除不留框架', async ({ page }) => {
  await template(page);
  await page.getByRole('button', { name: '四格相紙', exact: true }).tap();
  await expect(page.getByRole('button', { name: '四格相紙', exact: true })).toHaveAttribute(
    'aria-pressed',
    'true',
  );
  await expect(page.locator('.template-choice')).toContainText('目前選擇：四格相紙');
  await expect(page.getByRole('button', { name: '選擇第 4 格 右下', exact: true })).toBeVisible();
  await expect(page.getByRole('img', { name: '第 1 格素材縮圖', exact: true })).toBeVisible();
  await expect(page.getByLabel('第 1 格素材').locator('option:checked')).toContainText('solid-red.webm');
  await page.getByLabel('版型動態效果').selectOption('none');
  await page.getByRole('button', { name: '套用多格版型' }).tap();
  const p = await current(page),
    group = p.tracks.find((t) => t.template)!;
  expect(p.tracks.filter((t) => t.template)).toHaveLength(1);
  expect(group.items).toHaveLength(4);
  await expect(clips(page)).toHaveCount(2);
  await expect.poll(async () => isRed(await samplePreview(page, 0.25, 0.2))).toBe(true);
  await expect.poll(async () => isGreen(await samplePreview(page, 0.75, 0.2))).toBe(true);
  await page.screenshot({ path: `${shots}/numbered-template-group.png` });
  await openTab(page, '剪輯');
  // Slow native decoding must not keep a deleted group's frame visible.
  await page.evaluate(() => {
    for (const v of Array.from(document.querySelectorAll('.pool video')))
      Object.defineProperty(v, 'readyState', { configurable: true, get: () => 1 });
  });
  await page.getByRole('button', { name: '刪除', exact: true }).tap();
  expect((await current(page)).layout).toBeUndefined();
  await expect
    .poll(async () => {
      const c = await samplePreview(page, 0.05, 0.05);
      return !!c && c.every((v, i) => i === 3 || v < 8);
    })
    .toBe(true);
  await page.evaluate(() => {
    for (const v of Array.from(document.querySelectorAll('.pool video')))
      Reflect.deleteProperty(v, 'readyState');
  });
  await seekTo(page, 0.1);
  await expect.poll(async () => isBlue(await samplePreview(page, 0.05, 0.05))).toBe(true);
  await page.getByRole('button', { name: '復原', exact: true }).tap();
  expect((await current(page)).tracks.find((t) => t.template)!.items).toHaveLength(4);
});

test('現有疊加片段可整組套版，隱藏整組會連框架一起消失', async ({ page }) => {
  await createProjectWith(page, ['solid-blue.webm']);
  await addOverlays(page, ['solid-red.webm', 'solid-green.webm', 'photo.png']);
  await openTab(page, '版型');
  await page.getByRole('button', { name: '群組現有圖層', exact: true }).tap();
  await page.getByLabel('版型動態效果').selectOption('none');
  await page.getByRole('button', { name: '套用多格版型' }).tap();
  const p = await current(page),
    group = p.tracks.find((t) => t.template)!;
  expect(p.tracks).toHaveLength(2);
  expect(group.items).toHaveLength(3);
  await expect(clips(page)).toHaveCount(2);
  await page.locator(`[data-track-id="${group.id}"]`).getByTestId('track-chip').tap();
  await page.getByRole('button', { name: '隱藏這條軌道', exact: true }).tap();
  await expect.poll(async () => isBlue(await samplePreview(page, 0.1, 0.1))).toBe(true);
});

test('裁切套用前可看透明結果，復原上一筆描邊不改原片', async ({ page }) => {
  await createProjectWith(page, ['solid-red.webm']);
  await addOverlays(page, ['solid-green.webm']);
  await openTab(page, '剪輯');
  await page.getByRole('button', { name: '裁切', exact: true }).tap();
  await page.getByRole('button', { name: '自由描邊保留區域', exact: true }).tap();
  const stage = page.getByTestId('crop-stage'),
    box = (await stage.boundingBox())!;
  const draw = async (x: number) => {
    await page.mouse.move(box.x + box.width * 0.1, box.y + box.height * 0.1);
    await page.mouse.down();
    await page.mouse.move(box.x + box.width * x, box.y + box.height * 0.1, { steps: 3 });
    await page.mouse.move(box.x + box.width * x, box.y + box.height * 0.9, { steps: 3 });
    await page.mouse.move(box.x + box.width * 0.1, box.y + box.height * 0.9, { steps: 3 });
    await page.mouse.up();
  };
  await draw(0.45);
  await draw(0.8);
  await page.getByRole('button', { name: '復原描邊', exact: true }).tap();
  await page.getByRole('button', { name: '檢查裁切結果', exact: true }).tap();
  await expect(page.getByRole('button', { name: '繼續調整裁切', exact: true })).toHaveAttribute(
    'aria-pressed',
    'true',
  );
  await page.screenshot({ path: `${shots}/crop-transparent-preview.png` });
  await page.getByRole('button', { name: '套用裁切', exact: true }).tap();
  await expect.poll(async () => isGreen(await samplePreview(page, 0.4, 0.5))).toBe(true);
  await expect.poll(async () => isRed(await samplePreview(page, 0.6, 0.5))).toBe(true);
});

test('群組多格可完整匯出，成品包含每格的實際影片畫面', async ({ page }) => {
  test.setTimeout(120000);
  await template(page);
  await page.getByLabel('版型動態效果').selectOption('none');
  await page.getByRole('button', { name: '套用多格版型' }).tap();
  await page.getByRole('button', { name: '匯出影片', exact: true }).tap();
  await page.getByLabel('匯出解析度').selectOption('360');
  await page.getByRole('button', { name: '開始匯出', exact: true }).tap();
  await expect(page.getByRole('link', { name: '下載影片', exact: true })).toBeVisible({ timeout: 90000 });
  const url = await page.getByRole('link', { name: '下載影片', exact: true }).getAttribute('href');
  const result = await page.evaluate(
    async (url) =>
      (
        window as unknown as {
          __videoclip: {
            inspectMovie: (u: string, t: number, p: number[][]) => Promise<{ samples: number[][] }>;
          };
        }
      ).__videoclip.inspectMovie(url!, 1, [
        [0.5, 0.18],
        [0.5, 0.48],
        [0.5, 0.78],
      ]),
    url,
  );
  expect(result.samples[0]![0]).toBeGreaterThan(200);
  expect(result.samples[1]![1]).toBeGreaterThan(200);
  expect(result.samples[2]![2]).toBeGreaterThan(200);
});
