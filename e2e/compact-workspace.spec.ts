import { selectedItemId } from './helpers';
import { test, expect, type Page } from '@playwright/test';
import {
  createProjectWith,
  addOverlays,
  clips,
  openTab,
  exportFrame,
  samplePreview,
  isRed,
  isGreen,
} from './helpers';
import type { Project, VideoItem } from '../src/model/types';
import { itemBox } from '../src/engine/geometry';

const current = (page: Page): Promise<Project> =>
  page.evaluate(() =>
    (window as unknown as { __videoclip: { project: () => Project } }).__videoclip.project(),
  );
async function slider(page: Page, name: string, value: number) {
  await page.getByRole('slider', { name, exact: true }).evaluate((el, n) => {
    Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value')!.set!.call(el, String(n));
    el.dispatchEvent(new Event('input', { bubbles: true }));
  }, value);
}
async function shot(page: Page, name: string) {
  await expect(page.locator('.toast')).toHaveCount(0);
  await page.screenshot({ path: 'docs/screenshots/compact-workspace/' + name + '.png' });
}
async function compactType(page: Page, root: string) {
  const font = await page
    .locator('.bottombar .tab')
    .first()
    .evaluate((el) => parseFloat(getComputedStyle(el).fontSize));
  const sizes = await page.locator(root).evaluate((el) =>
    Array.from(
      el.querySelectorAll(
        'button,input,select,textarea,h2,h3,h4,strong,b,label,summary,.sheet-title,.slider-label,.slider-val',
      ),
    )
      .filter((node) => node.getClientRects().length)
      .map((node) => parseFloat(getComputedStyle(node).fontSize)),
  );
  expect(sizes.length).toBeGreaterThan(0);
  expect(Math.max(...sizes)).toBeLessThanOrEqual(font);
}
async function cropStroke(page: Page, targets: [number, number][], whileDown?: () => Promise<void>) {
  await page.getByTestId('crop-stage').scrollIntoViewIfNeeded();
  const b = (await page.getByTestId('crop-stage').boundingBox())!;
  const offset = Number(await page.getByRole('slider', { name: '瞄準偏移', exact: true }).inputValue());
  const session = await page.context().newCDPSession(page);
  try {
    for (let i = 0; i < targets.length; i++) {
      const [x, y] = targets[i]!;
      await session.send('Input.dispatchTouchEvent', {
        type: i ? 'touchMove' : 'touchStart',
        touchPoints: [{ x: b.x + x * b.width, y: b.y + y * b.height + offset, id: 1 }],
      });
      await expect
        .poll(async () => {
          const guide = page.getByTestId('crop-offset-guide');
          return [
            Number(await guide.getAttribute('data-target-x')),
            Number(await guide.getAttribute('data-target-y')),
          ].map((n) => Math.round(n * 100));
        })
        .toEqual([x, y].map((n) => Math.round(n * 100)));
    }
    await whileDown?.();
    await session.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] });
    await expect(page.getByTestId('crop-offset-guide')).toHaveCount(0);
  } finally {
    await session.detach();
  }
}
// Crop UVs refer to the source; the default overlay occupies only half the project.
async function sourcePoint(page: Page) {
  const p = await current(page),
    id = await selectedItemId(page);
  const item = p.tracks.flatMap((t) => t.items).find((it) => it.id === id)!;
  const box = itemBox(item, {
    canvasW: p.width,
    canvasH: p.height,
    assets: p.assets,
    textSize: () => ({ w: 0, h: 0 }),
  })!;
  expect(box.rotation).toBe(0);
  return (x: number, y: number): [number, number] => [
    (box.cx + (x - 0.5) * box.w) / p.width,
    (box.cy + (y - 0.5) * box.h) / p.height,
  ];
}
test('展開時間軸先看到分類摘要，只展開要調整的音訊，重開仍先收合', async ({ page }) => {
  await createProjectWith(page, ['tone-video.webm'], false);
  await page.getByRole('button', { name: /^展開時間軸/ }).tap();
  await expect(page.getByTestId('track')).toHaveCount(0);
  await expect(page.getByRole('button', { name: '展開影像群組', exact: true })).toHaveAttribute(
    'aria-expanded',
    'false',
  );
  await page.getByRole('button', { name: '展開影像群組', exact: true }).tap();
  await expect(clips(page)).toHaveCount(1);
  await openTab(page, '音訊');
  await page.getByRole('button', { name: '分離原音', exact: true }).tap();
  await page.getByRole('button', { name: /^收合時間軸/ }).tap();
  await page.getByRole('button', { name: /^展開時間軸/ }).tap();
  await expect(page.getByTestId('track')).toHaveCount(0);
  await shot(page, 'group-first-timeline');
  await page.getByRole('button', { name: '展開音訊群組', exact: true }).tap();
  await expect(page.getByTestId('track')).toHaveCount(1);
  await expect(page.getByTestId('track')).toHaveAttribute('data-kind', 'audio');
  await expect(page.getByRole('button', { name: '展開影像群組', exact: true })).toHaveAttribute(
    'aria-expanded',
    'false',
  );
  await shot(page, 'only-audio-expanded');
});
test('選項及 popup 字級不大於功能列，特效只留小示意與名稱，工具都有短標籤', async ({ page }) => {
  await createProjectWith(page, ['tone-video.webm', 'solid-green.webm']);
  for (const name of ['預覽', '工具', '縮小', '放大'])
    await expect(page.locator('.playbar').getByText(name, { exact: true })).toBeVisible();
  await openTab(page, '特效');
  await expect(page.locator('.effect-card small')).toHaveCount(0);
  const cards = page.locator('.effect-card');
  const a = (await cards.nth(0).boundingBox())!,
    b = (await cards.nth(2).boundingBox())!;
  expect(a.y).toBeCloseTo(b.y, 0);
  expect(a.width).toBeLessThan(125);
  expect((await cards.first().locator('canvas').boundingBox())!.height).toBeLessThan(75);
  await compactType(page, '.bottombar');
  await cards.first().scrollIntoViewIfNeeded();
  await expect(cards.first().locator('canvas')).toHaveAttribute('data-demo-ready', 'true');
  await shot(page, 'compact-effects-and-names');
  await openTab(page, '音訊');
  await compactType(page, '.bottombar');
  await page.getByRole('button', { name: '聲音片段範圍', exact: true }).first().tap();
  await compactType(page, '.sheet');
  await expect(page.getByLabel('音訊對應影片')).toBeVisible();
  await shot(page, 'compact-audio-popup');
  await page.getByRole('button', { name: '取消', exact: true }).tap();
  await clips(page).first().tap();
  await openTab(page, '圖層');
  await page.getByRole('button', { name: '定格細部調整', exact: true }).tap();
  await compactType(page, '.sheet');
  await page.getByRole('button', { name: '完成定格', exact: true }).tap();
});
test('手繪素材新增後可直接從透明處單指拖移，不需先雙指縮放', async ({ page }) => {
  await createProjectWith(page, ['solid-blue.webm']);
  await openTab(page, '素材');
  await page.getByRole('button', { name: '＋ 畫畫', exact: true }).tap();
  await expect(page.getByRole('button', { name: '毛筆', exact: true })).toHaveCount(0);
  await expect(page.getByRole('button', { name: '感壓筆', exact: true })).toBeVisible();
  const canvas = page.getByTestId('drawing-canvas');
  await canvas.scrollIntoViewIfNeeded();
  const box = (await canvas.boundingBox())!;
  await page.mouse.move(box.x + box.width * 0.2, box.y + box.height * 0.2);
  await page.mouse.down();
  await page.mouse.move(box.x + box.width * 0.4, box.y + box.height * 0.2, { steps: 12 });
  await page.mouse.up();
  await page.getByRole('button', { name: '加入畫作', exact: true }).tap();
  await expect(clips(page)).toHaveCount(2);
  const before = await current(page),
    drawing = before.tracks.flatMap((t) => t.items).find((it) => it.type === 'image')!;
  await page.getByTestId('stage').scrollIntoViewIfNeeded();
  await expect(page.getByTestId('selbox')).toBeVisible();
  const stage = (await page.getByTestId('stage').boundingBox())!;
  const session = await page.context().newCDPSession(page);
  try {
    await session.send('Input.dispatchTouchEvent', {
      type: 'touchStart',
      touchPoints: [{ x: stage.x + stage.width * 0.7, y: stage.y + stage.height * 0.6, id: 1 }],
    });
    for (let i = 1; i <= 8; i++)
      await session.send('Input.dispatchTouchEvent', {
        type: 'touchMove',
        touchPoints: [
          {
            x: stage.x + stage.width * (0.7 + (i * 0.1) / 8),
            y: stage.y + stage.height * (0.6 + (i * 0.08) / 8),
            id: 1,
          },
        ],
      });
    await session.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] });
  } finally {
    await session.detach();
  }
  const after = await current(page),
    moved = after.tracks.flatMap((t) => t.items).find((it) => it.id === drawing.id)!;
  expect(moved.transform.x).toBeGreaterThan(drawing.transform.x + 0.06);
  expect(moved.transform.y).toBeGreaterThan(drawing.transform.y + 0.04);
  expect(after.tracks[0]!.items[0]!.transform).toEqual(before.tracks[0]!.items[0]!.transform);
  await shot(page, 'one-finger-drawing');
  await page.getByTestId('stage').tap({ position: { x: stage.width * 0.2, y: stage.height * 0.85 } });
  expect(await selectedItemId(page)).toBe(before.tracks[0]!.items[0]!.id);
});
test('偏移控制圈瞄準擦除與保留，大小可調，匯出改的是上方目標而非手指處', async ({ page }) => {
  test.setTimeout(60000);
  await createProjectWith(page, ['solid-green.webm']);
  await addOverlays(page, ['solid-red.webm']);
  const toProject = await sourcePoint(page);
  await openTab(page, '剪輯');
  await page.getByRole('button', { name: '裁切', exact: true }).tap();
  await page.getByRole('button', { name: '裁切橡皮擦', exact: true }).tap();
  await expect(page.getByRole('slider', { name: '瞄準偏移', exact: true })).toHaveValue('56');
  await slider(page, '裁切橡皮擦粗細', 20);
  let contactY = 0;
  await cropStroke(page, [[0.5, 0.4]], async () => {
    const guide = page.getByTestId('crop-offset-guide');
    await expect.poll(async () => Number(await guide.getAttribute('data-target-y'))).toBeCloseTo(0.4, 2);
    const target = (await page.getByTestId('crop-target-circle').boundingBox())!,
      contact = (await page.getByTestId('crop-contact-circle').boundingBox())!;
    expect(contact.y + contact.height / 2 - target.y - target.height / 2).toBeCloseTo(56, 0);
    const stage = (await page.getByTestId('crop-stage').boundingBox())!;
    // SVG bounds include the 2px non-scaling outline.
    expect(target.width - 2).toBeCloseTo(stage.width * 0.2, 0);
    contactY = (contact.y + contact.height / 2 - stage.y) / stage.height;
    await shot(page, 'offset-eraser-aiming');
  });
  await expect(page.getByTestId('crop-offset-guide')).toHaveCount(0);
  await page.getByRole('button', { name: '套用裁切', exact: true }).tap();
  await expect(page.getByRole('dialog', { name: '裁切／手動去背', exact: true })).toHaveCount(0);
  await expect.poll(async () => isGreen(await samplePreview(page, ...toProject(0.5, 0.4)))).toBe(true);
  const erased = await exportFrame(page, 0, [toProject(0.5, 0.4), toProject(0.5, contactY)]);
  expect(isGreen(erased.samples[0] as [number, number, number, number])).toBe(true);
  expect(isRed(erased.samples[1] as [number, number, number, number])).toBe(true);
  await page.getByRole('button', { name: '裁切', exact: true }).tap();
  await page.getByRole('button', { name: '保留筆刷', exact: true }).tap();
  await slider(page, '保留筆刷粗細', 20);
  await cropStroke(page, [[0.5, 0.4]]);
  await page.getByRole('button', { name: '套用裁切', exact: true }).tap();
  await expect(page.getByRole('dialog', { name: '裁切／手動去背', exact: true })).toHaveCount(0);
  const restored = await exportFrame(page, 0, [toProject(0.5, 0.4)]);
  expect(isRed(restored.samples[0] as [number, number, number, number])).toBe(true);
});
test('自由描邊也用偏移瞄準，逐筆復原及取消不改原片，保留區域輸出正確', async ({ page }) => {
  test.setTimeout(60000);
  await createProjectWith(page, ['solid-green.webm']);
  await addOverlays(page, ['solid-red.webm']);
  const toProject = await sourcePoint(page);
  await openTab(page, '剪輯');
  await page.getByRole('button', { name: '裁切', exact: true }).tap();
  await page.getByRole('button', { name: '自由描邊保留區域', exact: true }).tap();
  const targets: [number, number][] = [
    [0.2, 0.2],
    [0.8, 0.2],
    [0.8, 0.8],
    [0.2, 0.8],
    [0.2, 0.2],
  ];
  await cropStroke(page, targets, async () => {
    await expect(page.getByTestId('crop-offset-guide')).toBeVisible();
    await shot(page, 'offset-lasso-aiming');
  });
  await page.getByRole('button', { name: '復原描邊', exact: true }).tap();
  await expect(page.locator('.crop-stage polygon')).toHaveCount(0);
  await cropStroke(page, targets);
  await page.getByRole('button', { name: '套用裁切', exact: true }).tap();
  await expect(page.getByRole('dialog', { name: '裁切／手動去背', exact: true })).toHaveCount(0);
  const frame = await exportFrame(page, 0, [toProject(0.1, 0.5), toProject(0.5, 0.5)]);
  expect(isGreen(frame.samples[0] as [number, number, number, number])).toBe(true);
  expect(isRed(frame.samples[1] as [number, number, number, number])).toBe(true);
  const masks = (await current(page)).tracks.map((t) =>
    t.items.map((it) => ('mask' in it ? it.mask : undefined)),
  );
  await page.getByRole('button', { name: '裁切', exact: true }).tap();
  await page.getByRole('button', { name: '自由描邊保留區域', exact: true }).tap();
  await cropStroke(page, [
    [0.3, 0.3],
    [0.6, 0.3],
    [0.6, 0.6],
    [0.3, 0.6],
  ]);
  await page.getByRole('button', { name: '取消', exact: true }).tap();
  expect(
    (await current(page)).tracks.map((t) => t.items.map((it) => ('mask' in it ? it.mask : undefined))),
  ).toEqual(masks);
});
test('版型示意圖靠左，各格素材選單在右側，窄螢幕不溢出且套用來源正確', async ({ page }) => {
  await createProjectWith(page, ['solid-blue.webm']);
  await addOverlays(page, ['solid-red.webm', 'solid-green.webm']);
  await openTab(page, '版型');
  await page.getByRole('button', { name: '直式膠卷', exact: true }).tap();
  const model = await current(page),
    asset = (name: string) => model.assets.find((a) => a.name === name)!;
  for (const [i, name] of ['solid-green.webm', 'solid-red.webm', 'solid-blue.webm'].entries())
    await page.getByLabel('第 ' + (i + 1) + ' 格素材', { exact: true }).selectOption(asset(name).id);
  await expect(page.locator('.slot-choice')).toHaveCount(3);
  await expect(page.locator('.template-source-choices .slot-choice')).toHaveCount(3);
  const map = (await page.getByLabel('版型格子位置對照').boundingBox())!,
    choices = (await page.locator('.template-source-choices').boundingBox())!;
  expect(choices.x).toBeGreaterThanOrEqual(map.x + map.width);
  await page.locator('.template-assignment').scrollIntoViewIfNeeded();
  await shot(page, 'template-preview-with-side-selectors');
  await page.setViewportSize({ width: 320, height: 700 });
  expect(
    await page.locator('.template-assignment').evaluate((el) => el.scrollWidth - el.clientWidth),
  ).toBeLessThanOrEqual(1);
  await compactType(page, '.bottombar');
  await page.setViewportSize({ width: 390, height: 664 });
  await page.getByRole('button', { name: '套用多格版型', exact: true }).tap();
  const group = (await current(page)).tracks.find((t) => t.template)!;
  expect((group.items[0] as VideoItem).assetId).toBe(asset('solid-green.webm').id);
  expect((group.items[1] as VideoItem).assetId).toBe(asset('solid-red.webm').id);
  const frame = await exportFrame(page, 0, [
    [0.5, 0.18],
    [0.5, 0.48],
  ]);
  expect(isGreen(frame.samples[0] as [number, number, number, number])).toBe(true);
  expect(isRed(frame.samples[1] as [number, number, number, number])).toBe(true);
});
