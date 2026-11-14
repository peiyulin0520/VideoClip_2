import type { Project } from '../src/model/types';
import { expect, test } from '@playwright/test';
import {
  createProjectWith,
  openTab,
  setCropOffset,
  clips,
  addOverlays,
  exportFrame,
  isGreen,
  isRed,
} from './helpers';

test('裁切工具同列、筆刷獨立保留、縮放不丟座標、undo/redo 與 X 捨棄', async ({ page }) => {
  await createProjectWith(page, ['solid-red.webm']);
  await clips(page).first().tap();
  await openTab(page, '剪輯');
  await page.getByRole('button', { name: '裁切', exact: true }).tap();
  const tools = page.locator('.crop-tools .chip');
  expect(await tools.count()).toBe(4);
  const boxes = await tools.evaluateAll((es) =>
    es.map((e) => ({ y: e.getBoundingClientRect().y, h: e.getBoundingClientRect().height })),
  );
  expect(Math.max(...boxes.map((b) => b.y)) - Math.min(...boxes.map((b) => b.y))).toBeLessThan(2);
  await page.getByRole('button', { name: '筆刷', exact: true }).tap();
  await setCropOffset(page);
  const c = page.locator('.crop-result'),
    before = await c.elementHandle();
  const stage = page.getByTestId('crop-stage');
  await stage.scrollIntoViewIfNeeded();
  const b = (await stage.boundingBox())!;
  await page.mouse.move(b.x + b.width * 0.5, b.y + b.height * 0.5);
  await page.mouse.down();
  await page.mouse.move(b.x + b.width * 0.6, b.y + b.height * 0.5, { steps: 4 });
  await page.mouse.up();
  await page.getByRole('button', { name: '放大裁切預覽', exact: true }).tap();
  await page.getByRole('button', { name: 'undo', exact: true }).tap();
  await page.getByRole('button', { name: 'redo', exact: true }).tap();
  expect(await c.evaluate((el, original) => el === original, before)).toBe(true);
  await page.screenshot({ path: 'docs/screenshots/editing/crop-tools-zoom.png' });
  await page.getByRole('button', { name: '關閉且不儲存', exact: true }).tap();
  expect(
    await page.evaluate(
      () =>
        (
          (window as unknown as { __videoclip: { project: () => Project } }).__videoclip.project().tracks[0]!
            .items[0] as import('../src/model/types').VideoItem
        ).mask,
    ),
  ).toBeUndefined();
});

test('選段預覽由播放按鈕啟用原音，秒數及 undo/redo 在同列', async ({ page }) => {
  await createProjectWith(page, ['tone-video.webm']);
  await clips(page).first().tap();
  await openTab(page, '剪輯');
  await page.getByRole('button', { name: '片段範圍', exact: true }).tap();
  await page.getByRole('button', { name: '播放片段預覽', exact: true }).tap();
  await expect
    .poll(() =>
      page.locator('video.range-preview').evaluate((el: HTMLVideoElement) => !el.paused && !el.muted),
    )
    .toBe(true);
  await expect(
    page.locator('.source-playback-row').getByRole('button', { name: 'undo', exact: true }),
  ).toBeVisible();
  await page.getByRole('button', { name: '關閉且不儲存', exact: true }).tap();
  await page.getByRole('tab', { name: '剪輯', exact: true }).tap();
  await expect(page.getByRole('button', { name: '片段範圍', exact: true })).toBeVisible();
});

test('定格暫停選取白底，改所選不新增；近鄰可明確新增並以按鈕刪除', async ({ page }) => {
  await createProjectWith(page, ['solid-red.webm']);
  await clips(page).first().tap();
  await page.getByRole('button', { name: '定格', exact: true }).tap();
  const diamond = page.locator('.timeline-keyframe').first();
  await expect(diamond).toHaveAttribute('aria-pressed', 'true');
  await page.getByTestId('timeline-scroll').evaluate((el) => {
    el.scrollLeft = 3;
  });
  await openTab(page, '圖層');
  await page.getByRole('button', { name: '定格細部調整', exact: true }).tap();
  await page.getByRole('button', { name: '震一下', exact: true }).tap();
  await page.getByRole('button', { name: '完成定格', exact: true }).tap();
  await expect(page.locator('.timeline-keyframe')).toHaveCount(1);
  await expect(diamond).toContainText('震');
  await page.getByRole('button', { name: '定格', exact: true }).tap();
  await expect(page.locator('.timeline-keyframe')).toHaveCount(2);
  await page.locator('.timeline-keyframe').last().tap();
  await page.screenshot({ path: 'docs/screenshots/editing/selected-keyframe.png' });
  await page.getByRole('button', { name: '定格', exact: true }).tap();
  await expect(page.locator('.timeline-keyframe')).toHaveCount(1);
});

test('分割刪除 B 後 A/C 轉場起迄不回復 B，原生預覽仍讀 C 的來源秒數', async ({ page }) => {
  await createProjectWith(page, ['timing-video.webm']);
  await clips(page).first().tap();
  await openTab(page, '剪輯');
  const project = () =>
    page.evaluate(() =>
      (window as unknown as { __videoclip: { project: () => Project } }).__videoclip.project(),
    );
  const seek = async (t: number) => {
    await page.getByTestId('timeline-scroll').evaluate((el, x) => {
      el.scrollLeft = x;
    }, t * 60);
    await expect
      .poll(() =>
        page.evaluate(() =>
          (window as unknown as { __videoclip: { time: () => number } }).__videoclip.time(),
        ),
      )
      .toBeCloseTo(t, 1);
  };
  await seek(3);
  await page.getByRole('button', { name: '分割', exact: true }).tap();
  await seek(6);
  await page.getByRole('button', { name: '分割', exact: true }).tap();
  const before = (await project()).tracks[0]!.items;
  const c = before[2]!,
    b = before[1]!;
  await page.locator(`[data-item-id="${b.id}"][data-testid="clip"]`).tap();
  await page.getByRole('button', { name: '刪除', exact: true }).tap();
  await page.locator(`[data-item-id="${c.id}"][data-testid="clip"]`).tap();
  for (let n = 0; n < 3 && (await project()).tracks[0]!.items.find((i) => i.id === c.id)!.start > 3.01; n++)
    await page.getByRole('button', { name: '前移', exact: true }).tap();
  const original = (await project()).tracks[0]!.items;
  await openTab(page, '特效');
  await page.getByRole('button', { name: '兩個素材銜接', exact: true }).tap();
  await page.getByRole('button', { name: '疊化', exact: true }).tap();
  await page.getByRole('button', { name: '調整特效起迄', exact: true }).tap();
  await page.getByLabel('第1組特效終點', { exact: true }).fill('4');
  await page.getByLabel('第1組特效起點', { exact: true }).fill('2');
  await page.getByRole('button', { name: '套用特效起迄', exact: true }).tap();
  const after = await project();
  expect(after.tracks[0]!.items).toEqual(original);
  expect(after.tracks[0]!.items.some((i) => i.id === b.id)).toBe(false);
  await seek(4.5);
  await expect
    .poll(() =>
      page.locator(`.pool video[data-item-id="${c.id}"]`).evaluate((v: HTMLVideoElement) => v.currentTime),
    )
    .toBeCloseTo(7.5, 1);
  await page.screenshot({ path: 'docs/screenshots/editing/ac-transition-source.png' });
});

test('比例只改框內輸出，固定預覽基地；自訂比例可拖曳且 X 不儲存', async ({ page }) => {
  await createProjectWith(page, ['solid-red.webm']);
  const base = page.locator('.stage-wrap'),
    size = await base.boundingBox();
  await page.getByRole('button', { name: '畫面比例', exact: true }).tap();
  await page.getByRole('radio', { name: '橫式 4:3', exact: true }).tap();
  await expect
    .poll(async () => Math.round((await base.boundingBox())!.height))
    .toBe(Math.round(size!.height));
  const inside = (await page.getByTestId('stage').boundingBox())!;
  expect(inside.width / inside.height).toBeCloseTo(4 / 3, 1);
  await page.getByRole('button', { name: '畫面比例', exact: true }).tap();
  await page.getByRole('button', { name: '在預覽自訂比例', exact: true }).tap();
  const handle = page.getByRole('button', { name: '自訂比例拖曳 r', exact: true });
  const b = (await handle.boundingBox())!;
  await page.mouse.move(b.x + b.width / 2, b.y + b.height / 2);
  await page.mouse.down();
  await page.mouse.move(b.x - 45, b.y + b.height / 2, { steps: 4 });
  await page.mouse.up();
  await page.getByRole('button', { name: '關閉且不儲存', exact: true }).tap();
  expect(
    await page.evaluate(
      () =>
        (window as unknown as { __videoclip: { project: () => Project } }).__videoclip.project().customAspect,
    ),
  ).toBeUndefined();
  await page.getByRole('button', { name: '畫面比例', exact: true }).tap();
  await page.getByRole('button', { name: '在預覽自訂比例', exact: true }).tap();
  await page.getByRole('button', { name: '套用比例', exact: true }).tap();
  await expect
    .poll(() =>
      page.evaluate(
        () =>
          (window as unknown as { __videoclip: { project: () => Project } }).__videoclip.project()
            .customAspect,
      ),
    )
    .toBe(true);
  await page.screenshot({ path: 'docs/screenshots/editing/custom-aspect-fixed-base.png' });
});

test('裁切雙指縮放不多畫描邊，縮小後保留的原素材位置與輸出一致', async ({ page }) => {
  await createProjectWith(page, ['solid-red.webm']);
  await addOverlays(page, ['solid-green.webm']);
  await openTab(page, '剪輯');
  await page.getByRole('button', { name: '裁切', exact: true }).tap();
  await page.getByRole('button', { name: '筆刷', exact: true }).tap();
  await setCropOffset(page);
  const stroke = async (x: number, y: number) => {
    await page.getByTestId('crop-stage').scrollIntoViewIfNeeded();
    const b = (await page.getByTestId('crop-stage').boundingBox())!;
    await page.mouse.move(b.x + b.width * x, b.y + b.height * y);
    await page.mouse.down();
    await page.mouse.up();
  };
  await stroke(0.5, 0.5);
  const viewport = page.locator('.crop-viewport');
  await viewport.scrollIntoViewIfNeeded();
  const b = (await viewport.boundingBox())!,
    cx = b.x + b.width / 2,
    cy = b.y + b.height / 2;
  const session = await page.context().newCDPSession(page);
  try {
    await session.send('Input.dispatchTouchEvent', {
      type: 'touchStart',
      touchPoints: [
        { x: cx - 12, y: cy, id: 1 },
        { x: cx + 12, y: cy, id: 2 },
      ],
    });
    for (let i = 1; i <= 4; i++)
      await session.send('Input.dispatchTouchEvent', {
        type: 'touchMove',
        touchPoints: [
          { x: cx - 12 - i * 2, y: cy, id: 1 },
          { x: cx + 12 + i * 2, y: cy, id: 2 },
        ],
      });
    await session.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] });
  } finally {
    await session.detach();
  }
  await stroke(0.7, 0.5);
  for (let i = 0; i < 5; i++) await page.getByRole('button', { name: '縮小裁切預覽', exact: true }).tap();
  await page.getByRole('button', { name: '套用裁切', exact: true }).tap();
  const item = await page.evaluate(
    () =>
      (window as unknown as { __videoclip: { project: () => Project } }).__videoclip.project().tracks[1]!
        .items[0] as import('../src/model/types').VideoItem,
  );
  expect(item.mask!.strokes).toHaveLength(2);
  expect(item.mask!.strokes![0]!.points[0]![0]).toBeCloseTo(0.5, 2);
  expect(item.mask!.strokes![1]!.points[0]![0]).toBeCloseTo(0.7, 2);
  const frame = await exportFrame(page, 0, [
    [0.5, 0.5],
    [0.6, 0.5],
    [0.4, 0.5],
  ]);
  expect(isGreen(frame.samples[0]! as [number, number, number, number])).toBe(true);
  expect(isGreen(frame.samples[1]! as [number, number, number, number])).toBe(true);
  expect(isRed(frame.samples[2]! as [number, number, number, number])).toBe(true);
});
