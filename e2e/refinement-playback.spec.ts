import { test, expect, type Page } from '@playwright/test';
import {
  createProjectWith,
  clips,
  openTab,
  seekTo,
  exportFrame,
  samplePreview,
  markMuteInterval,
} from './helpers';
import type { Project } from '../src/model/types';
const current = (page: Page) =>
  page.evaluate(() =>
    (window as unknown as { __videoclip: { project: () => Project } }).__videoclip.project(),
  );
const shot = async (page: Page, name: string) => {
  await expect(page.locator('.toast')).toHaveCount(0);
  await page.screenshot({ path: 'docs/screenshots/playback-refinement/' + name + '.png' });
};
async function slider(page: Page, label: string, value: number) {
  await page.getByRole('slider', { name: label, exact: true }).evaluate((el, v) => {
    Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value')!.set!.call(el, String(v));
    el.dispatchEvent(new Event('input', { bubbles: true }));
  }, value);
}
test('聲音小預覽貼著時間軸，試播白線同步並能暫停，沒有多餘快捷選項', async ({ page }) => {
  await createProjectWith(page, ['tone-video.webm']);
  await openTab(page, '音訊');
  await page.getByRole('button', { name: '聲音片段範圍', exact: true }).tap();
  const preview = page.getByLabel('音訊對應影片'),
    strip = page.locator('.sheet .source-thumbs');
  const pb = (await preview.boundingBox())!,
    sb = (await strip.boundingBox())!;
  expect(pb.x + pb.width).toBeLessThan(sb.x);
  expect(Math.abs(pb.y + pb.height / 2 - (sb.y + sb.height / 2))).toBeLessThan(150);
  await expect(page.getByRole('button', { name: '將目前前後 0.25 秒靜音', exact: true })).toHaveCount(0);
  await expect(page.getByRole('button', { name: '還原完整聲音', exact: true })).toHaveCount(0);
  await page.getByRole('button', { name: '播放選段試聽', exact: true }).tap();
  await expect.poll(() => preview.evaluate((v) => (v as HTMLVideoElement).currentTime)).toBeGreaterThan(0.3);
  await page.getByRole('button', { name: '暫停選段試聽', exact: true }).tap();
  const time = await preview.evaluate((v) => (v as HTMLVideoElement).currentTime);
  await expect(preview).toHaveJSProperty('paused', true);
  const fraction = await page
    .locator('.sheet .source-cursor')
    .evaluate((el) => parseFloat((el as HTMLElement).style.left) / 100);
  expect(fraction * 3).toBeCloseTo(time, 1);
  await expect(page.getByRole('button', { name: '播放選段試聽', exact: true })).toHaveAttribute(
    'aria-pressed',
    'false',
  );
  await markMuteInterval(page, 0.5, 1);
  await shot(page, 'compact-audio-preview-and-markers');
  await page.getByRole('button', { name: '套用聲音選段', exact: true }).tap();
  const item = (await current(page)).tracks[0]!.items[0]!;
  expect('audioRanges' in item && item.audioRanges).toHaveLength(2);
  if (!('audioRanges' in item) || !item.audioRanges) throw Error('Missing saved audio ranges');
  expect(item.audioRanges[0]![0]).toBe(0);
  expect(item.audioRanges[0]![1]).toBeCloseTo(0.5, 2);
  expect(item.audioRanges[1]![0]).toBeCloseTo(1, 2);
  expect(item.audioRanges[1]![1]).toBe(3);
});
test('定格在播放列直接記錄，細調另開，動畫交接與播放時沒有白色選取框', async ({ page }) => {
  await createProjectWith(page, ['solid-red.webm', 'solid-green.webm']);
  await clips(page).first().tap();
  await expect(page.locator('.ed-top').getByRole('button', { name: '定格', exact: true })).toHaveCount(0);
  const mark = page.locator('.playbar').getByRole('button', { name: '定格', exact: true });
  await mark.tap();
  await expect(mark).toHaveAttribute('aria-pressed', 'true');
  await expect(page.getByRole('dialog')).toHaveCount(0);
  await seekTo(page, 3.8);
  await openTab(page, '圖層');
  await page.getByRole('button', { name: '定格細部調整', exact: true }).tap();
  await slider(page, '定格大小', 50);
  await slider(page, '垂直位置', 75);
  await page.getByRole('button', { name: '完成定格', exact: true }).tap();
  await clips(page).nth(1).tap();
  await seekTo(page, 4);
  await mark.tap();
  await openTab(page, '圖層');
  await page.getByRole('button', { name: '定格細部調整', exact: true }).tap();
  await slider(page, '定格大小', 50);
  await slider(page, '垂直位置', 25);
  await page.getByRole('button', { name: '完成定格', exact: true }).tap();
  await seekTo(page, 6);
  await openTab(page, '圖層');
  await page.getByRole('button', { name: '定格細部調整', exact: true }).tap();
  await slider(page, '定格大小', 100);
  await page.getByRole('button', { name: '完成定格', exact: true }).tap();
  await openTab(page, '特效');
  await page.getByRole('button', { name: '向左推移', exact: true }).tap();
  await page.getByRole('button', { name: '檢視 A B 交接', exact: true }).tap();
  await expect(page.getByTestId('selbox')).toHaveCount(0);
  const frame = await exportFrame(page, 4, [[0.5, 0.5]]);
  expect(frame.samples[0]![0]).toBeLessThan(20);
  expect(frame.samples[0]![1]).toBeLessThan(20);
  await page.getByTestId('stage').scrollIntoViewIfNeeded();
  await shot(page, 'freeze-transition-no-white-frame');
  await seekTo(page, 5);
  await page.getByRole('button', { name: '播放', exact: true }).tap();
  await expect(page.getByTestId('selbox')).toHaveCount(0);
  await page.getByRole('button', { name: '暫停', exact: true }).tap();
  await expect(page.getByTestId('selbox')).toBeVisible();
  expect((await current(page)).tracks[0]!.items.every((it) => it.keyframes!.length >= 2)).toBe(true);
});
test('交接圓底加號定位正確，已用特效在上方且亮框，單一交接不重複而可混搭', async ({ page }) => {
  await createProjectWith(page, ['solid-red.webm', 'solid-green.webm', 'solid-blue.webm']);
  const joins = page.locator('.transition-join');
  await expect(joins).toHaveCount(2);
  const joinBox = (await joins.first().boundingBox())!,
    clipBox = (await clips(page).first().boundingBox())!;
  expect(joinBox.y).toBeGreaterThan(clipBox.y + clipBox.height / 2);
  expect(joinBox.height).toBeGreaterThanOrEqual(44);
  expect((await joins.first().locator('svg').boundingBox())!.width).toBeLessThanOrEqual(20);
  await joins.nth(1).tap();
  await expect(page.locator('.bottombar').getByRole('tab', { name: '特效', exact: true })).toHaveAttribute(
    'aria-selected',
    'true',
  );
  const ids = (await current(page)).tracks[0]!.items.map((it) => it.id);
  await expect(page.getByLabel('轉場片段 A 到 B')).toHaveValue(ids[1]!);
  const fade = page.getByRole('button', { name: '疊化', exact: true });
  await fade.tap();
  await expect(fade).toHaveAttribute('aria-pressed', 'true');
  await fade.tap();
  expect((await current(page)).transitions).toHaveLength(1);
  await page.getByRole('button', { name: '向左推移', exact: true }).tap();
  expect((await current(page)).transitions).toHaveLength(2);
  const mixed = await exportFrame(page, 8, [
    [0.25, 0.5],
    [0.75, 0.5],
  ]);
  expect(mixed.samples[0]![1]).toBeGreaterThan(240);
  expect(mixed.samples[0]![2]).toBeLessThan(15);
  expect(mixed.samples[1]![2]).toBeGreaterThan(100);
  expect(mixed.samples[1]![2]).toBeLessThan(150);
  expect(mixed.samples[1]![1]).toBeLessThan(15);

  await page.getByRole('button', { name: '閃光', exact: true }).tap();
  await page.getByRole('button', { name: '閃光', exact: true }).tap();
  expect((await current(page)).effects).toHaveLength(1);
  const used = page.getByRole('region', { name: '已使用的特效' });
  expect(
    await used.evaluate(
      (el) =>
        el.compareDocumentPosition(document.querySelector('.effect-grid')!) &
        Node.DOCUMENT_POSITION_FOLLOWING,
    ),
  ).toBeTruthy();
  await expect(used.getByRole('slider')).toHaveCount(0);
  await page.getByLabel('轉場片段 A 到 B').selectOption(ids[0]!);
  await expect(fade).toHaveAttribute('aria-pressed', 'false');
  await fade.tap();
  expect((await current(page)).transitions).toHaveLength(3);
  await page.getByLabel('轉場片段 A 到 B').selectOption(ids[1]!);
  await expect(fade).toHaveAttribute('aria-pressed', 'true');
  await used.scrollIntoViewIfNeeded();
  await shot(page, 'used-effects-above-options');
  await page.getByRole('button', { name: '移除轉場', exact: true }).first().tap();
  await expect(fade).toHaveAttribute('aria-pressed', 'false');
  const levels = await page.evaluate(() => {
    const primary = document.querySelector('.option-primary .active')!,
      secondary = document.querySelector('.option-secondary .active')!;
    return [getComputedStyle(primary).backgroundColor, getComputedStyle(secondary).backgroundColor];
  });
  expect(levels[0]).not.toBe(levels[1]);
  await openTab(page, '文字');
  await page.getByRole('button', { name: /新增文字/ }).tap();
  const add = page.getByRole('button', { name: '新增文字', exact: true });
  await expect(add).toBeEnabled();
  expect(
    await add.evaluate((el) => {
      const s = getComputedStyle(el);
      return (
        s.color !== s.backgroundColor &&
        s.backgroundColor === getComputedStyle(document.querySelector('.export-button')!).backgroundColor
      );
    }),
  ).toBe(true);
  await add.tap();
  expect((await current(page)).tracks.filter((t) => t.kind === 'text')).toHaveLength(2);
  await shot(page, 'text-add-button-feedback');
});
test('鉛筆最大粗細單獨可見，感壓筆有粗細變化且可復原及儲存', async ({ page }) => {
  await createProjectWith(page, ['solid-blue.webm']);
  await openTab(page, '素材');
  await page.getByRole('button', { name: '＋ 畫畫', exact: true }).tap();
  await page.getByRole('button', { name: '鉛筆', exact: true }).tap();
  await slider(page, '筆刷粗細', 160);
  const canvas = page.getByTestId('drawing-canvas');
  await canvas.scrollIntoViewIfNeeded();
  const box = (await canvas.boundingBox())!;
  await page.mouse.move(box.x + box.width * 0.15, box.y + box.height * 0.2);
  await page.mouse.down();
  await page.mouse.move(box.x + box.width * 0.85, box.y + box.height * 0.2, { steps: 24 });
  await page.mouse.up();
  const alpha = () =>
    canvas.evaluate((el) => {
      const c = el as HTMLCanvasElement;
      const data = c
        .getContext('2d')!
        .getImageData(Math.round(c.width * 0.5) - 8, Math.round(c.height * 0.2) - 8, 16, 16).data;
      const values = Array.from(data).filter((_, i) => i % 4 === 3);
      return {
        mean: values.reduce((a, b) => a + b, 0) / values.length,
        holes: values.filter((v) => v === 0).length / values.length,
        max: Math.max(...values),
      };
    });
  const graphite = await alpha();
  expect(graphite.mean).toBeGreaterThan(20);
  expect(graphite.holes).toBeGreaterThan(0.2);
  expect(graphite.max).toBeLessThan(130);
  await page.getByRole('button', { name: '感壓筆', exact: true }).tap();
  await canvas.scrollIntoViewIfNeeded();
  const b = (await canvas.boundingBox())!;
  const session = await page.context().newCDPSession(page);
  try {
    for (let i = 0; i <= 30; i++)
      await session.send('Input.dispatchTouchEvent', {
        type: i === 0 ? 'touchStart' : 'touchMove',
        touchPoints: [
          {
            x: b.x + b.width * (0.15 + (i * 0.7) / 30),
            y: b.y + b.height * 0.7,
            force: i < 10 || i > 20 ? 0.1 : 0.95,
            id: 1,
          },
        ],
      });
    await session.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] });
  } finally {
    await session.detach();
  }
  const widths = await canvas.evaluate((el) => {
    const c = el as HTMLCanvasElement,
      ctx = c.getContext('2d')!;
    return [0.25, 0.5].map((x) => {
      const data = ctx.getImageData(
        Math.round(c.width * x),
        Math.round(c.height * 0.55),
        1,
        Math.round(c.height * 0.3),
      ).data;
      return Array.from(data).filter((v, i) => i % 4 === 3 && v > 20).length;
    });
  });
  expect(widths[1]!).toBeGreaterThan(widths[0]! * 2);
  await shot(page, 'visible-pencil-and-pressure-brush');
  await page.getByRole('button', { name: '復原筆畫', exact: true }).tap();
  expect((await alpha()).mean).toBeCloseTo(graphite.mean, 1);
  await page.getByRole('button', { name: '加入畫作', exact: true }).tap();
  await expect(clips(page)).toHaveCount(2);
  const probes: [number, number][] = [0.47, 0.485, 0.5, 0.515, 0.53].map((x) => [x, 0.2]);
  await expect
    .poll(async () =>
      Math.max(
        ...(await Promise.all(probes.map(async ([x, y]) => (await samplePreview(page, x, y))?.[0] ?? 0))),
      ),
    )
    .toBeGreaterThan(20);
  const frame = await exportFrame(page, 0, probes);
  expect(Math.max(...frame.samples.map((c) => c[0]!))).toBeGreaterThan(20);
  expect((await current(page)).assets.some((a) => a.name.endsWith('.png'))).toBe(true);
});
