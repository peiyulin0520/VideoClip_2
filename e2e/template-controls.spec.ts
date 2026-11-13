import { expect, test, type Page } from '@playwright/test';
import { createProjectWith, openTab, fixture, clips, addOverlays, exportFrame, seekTo } from './helpers';
import type { Project } from '../src/model/types';
const isRed = (c: number[]) => c[0]! > 240 && c[1]! < 20 && c[2]! < 20;
const isBlue = (c: number[]) => c[2]! > 240 && c[0]! < 20 && c[1]! < 20;
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
  await page.screenshot({ path: `docs/screenshots/template-controls/${name}.png` });
}
async function template(page: Page) {
  await openTab(page, '版型');
  await page
    .getByTestId('template-files')
    .setInputFiles(['solid-red.webm', 'solid-green.webm', 'tone-video.webm'].map(fixture));
  await expect(page.locator('.busy')).toHaveCount(0);
  const p = await current(page);
  for (const [i, file] of ['solid-red.webm', 'solid-green.webm', 'tone-video.webm'].entries())
    await page
      .getByLabel(`第 ${i + 1} 格素材`, { exact: true })
      .selectOption(p.assets.find((a) => a.name === file)!.id);
  await page.getByLabel('版型文字', { exact: true }).fill('我的小時光');
  await page.getByRole('button', { name: '套用多格版型', exact: true }).tap();
  await expect
    .poll(async () => (await current(page)).tracks.find((t) => t.template)?.layout?.caption)
    .toBe('我的小時光');
}

test('版型文字可更改或留空、自訂色彩與框架透明度實際用於預覽及匯出，重開仍保留', async ({ page }) => {
  await createProjectWith(page, ['solid-blue.webm']);
  await template(page);
  await page.getByRole('button', { name: '版型底色自訂', exact: true }).tap();
  await page.getByRole('spinbutton', { name: '色彩 R', exact: true }).fill('255');
  await page.getByRole('spinbutton', { name: '色彩 G', exact: true }).fill('0');
  await page.getByRole('spinbutton', { name: '色彩 B', exact: true }).fill('0');
  await page.getByRole('button', { name: '套用顏色', exact: true }).tap();
  await page.getByLabel('版型文字', { exact: true }).fill('');
  let frame = await exportFrame(page, 1, [[0.5, 0.96]]);
  expect(isRed(frame.samples[0]!)).toBe(true);
  await slider(page, '版型框架透明度', 0);
  frame = await exportFrame(page, 1, [
    [0.5, 0.96],
    [0.5, 0.17],
  ]);
  expect(isBlue(frame.samples[0]!)).toBe(true);
  expect(isRed(frame.samples[1]!)).toBe(true);
  await slider(page, '版型框架透明度', 50);
  frame = await exportFrame(page, 1, [[0.5, 0.96]]);
  expect(frame.samples[0]![0]).toBeGreaterThan(90);
  expect(frame.samples[0]![2]).toBeGreaterThan(90);
  await page.getByLabel('版型文字', { exact: true }).fill('家人的一天');
  await page.getByRole('textbox', { name: '版型文字', exact: true }).scrollIntoViewIfNeeded();
  await shot(page, 'caption-color-opacity');
  await expect
    .poll(async () =>
      page.evaluate(() =>
        (window as unknown as { __videoclip: { savedProject: () => Promise<Project> } }).__videoclip
          .savedProject()
          .then((p) => p.tracks.find((t) => t.template)?.layout?.caption),
      ),
    )
    .toBe('家人的一天');
  await page.reload();
  await expect(page.locator('.editor')).toBeVisible();
  await openTab(page, '版型');
  await expect(page.getByLabel('版型文字', { exact: true })).toHaveValue('家人的一天');
  expect((await current(page)).tracks.find((t) => t.template)?.layout).toMatchObject({
    frameColor: '#ff0000',
    frameOpacity: 0.5,
  });
});

test('單一素材進出場使用A與透明側，其他素材保持，進出與中段匯出相符', async ({ page }) => {
  await createProjectWith(page, ['solid-blue.webm']);
  await addOverlays(page, ['solid-red.webm']);
  await openTab(page, '特效');
  await page.getByRole('button', { name: '單一素材', exact: true }).tap();
  await page.getByRole('button', { name: '進場：疊化', exact: true }).tap();
  await expect(page.getByRole('button', { name: '進場：疊化', exact: true })).toHaveAttribute(
    'aria-pressed',
    'true',
  );
  await page.getByRole('button', { name: '出場', exact: true }).tap();
  await page.getByRole('button', { name: '出場：疊化', exact: true }).tap();
  for (const t of [0.3, 3.7]) {
    const frame = await exportFrame(page, t, [
      [0.5, 0.5],
      [0.02, 0.02],
    ]);
    expect(frame.samples[0]![0]).toBeGreaterThan(80);
    expect(frame.samples[0]![2]).toBeGreaterThan(80);
    expect(isBlue(frame.samples[1]!)).toBe(true);
  }
  expect(isRed((await exportFrame(page, 1.5, [[0.5, 0.5]])).samples[0]!)).toBe(true);
  expect((await current(page)).transitions ?? []).toEqual([]);
  await page.getByRole('button', { name: '播放單一素材結果', exact: true }).tap();
  await expect(page.getByRole('button', { name: '暫停單一素材結果', exact: true })).toHaveAttribute(
    'aria-pressed',
    'true',
  );
  await page.getByRole('button', { name: '暫停單一素材結果', exact: true }).tap();
  await page.getByRole('button', { name: '暫停特效示意', exact: true }).tap();
  const demo = page.locator('canvas[data-effect-demo="transition:crossfade"]');
  const frozen = await demo.evaluate((el) => (el as HTMLCanvasElement).toDataURL());
  await page.waitForTimeout(400);
  expect(await demo.evaluate((el) => (el as HTMLCanvasElement).toDataURL())).toBe(frozen);
  await page.getByRole('button', { name: '播放特效示意', exact: true }).tap();
  await page.getByRole('button', { name: '無動畫', exact: true }).tap();
  expect(
    (await current(page)).tracks.flatMap((t) => t.items).find((it) => it.animations)?.animations?.exit,
  ).toBeUndefined();
  await page.getByLabel('單一動畫素材', { exact: true }).scrollIntoViewIfNeeded();
  await shot(page, 'single-entry-exit');
});

test('版型進階設定預設收合、只有一條來源軸，預覽與popup皆可播放暫停', async ({ page }) => {
  await createProjectWith(page, ['solid-blue.webm']);
  await template(page);
  const cell = page.locator('.template-cell').first();
  await expect(cell.getByRole('button', { name: '補白', exact: true })).toBeHidden();
  await expect(cell.getByTestId('source-range')).toHaveCount(1);
  await cell.getByRole('button', { name: '播放第 1 格預覽', exact: true }).tap();
  await expect(cell.getByRole('button', { name: '暫停第 1 格預覽', exact: true })).toHaveAttribute(
    'aria-pressed',
    'true',
  );
  await expect
    .poll(async () =>
      Number(await cell.locator('video').evaluate((v) => (v as HTMLVideoElement).currentTime)),
    )
    .toBeGreaterThan(0.1);
  await cell.getByRole('button', { name: '暫停第 1 格預覽', exact: true }).tap();
  await cell.getByRole('button', { name: '進階設定', exact: true }).tap();
  await cell.getByRole('button', { name: '補白', exact: true }).tap();
  await cell.getByRole('button', { name: '選取第 1 格片段範圍', exact: true }).tap();
  await page.getByRole('button', { name: '播放片段預覽', exact: true }).tap();
  await expect(page.getByRole('button', { name: '暫停片段預覽', exact: true })).toBeVisible();
  await page.getByRole('button', { name: '暫停片段預覽', exact: true }).tap();
  await page.getByRole('button', { name: '取消', exact: true }).tap();
  await cell.scrollIntoViewIfNeeded();
  await shot(page, 'cell-advanced-and-playback');
  await page.getByRole('button', { name: '播放版型結果', exact: true }).tap();
  await expect(page.getByRole('button', { name: '暫停版型結果', exact: true })).toBeVisible();
  await page.getByRole('button', { name: '暫停版型結果', exact: true }).tap();
  await page.getByText('進出場動畫', { exact: true }).tap();
  await page.getByRole('button', { name: '進場：由右滑入', exact: true }).tap();
  expect((await current(page)).tracks.find((t) => t.template)?.layout?.animations?.enter?.preset).toBe(
    'slide-left',
  );
  await seekTo(page, 0.3);
  const frame = await exportFrame(page, 0.3, [
    [0.1, 0.2],
    [0.75, 0.2],
  ]);
  expect(isBlue(frame.samples[0]!)).toBe(true);
  expect(isRed(frame.samples[1]!)).toBe(true);
  await page.getByRole('button', { name: '進場：拉近鏡頭', exact: true }).tap();
  const zoom = await exportFrame(page, 0.3, [
    [0.5, 0.1],
    [0.5, 0.32],
  ]);
  expect(isBlue(zoom.samples[0]!)).toBe(true);
  expect(isRed(zoom.samples[1]!)).toBe(true);
});

test('兩個銜接選項優先顯示自訂片段名稱，特效主類無重複外框', async ({ page }) => {
  await createProjectWith(page, ['solid-red.webm', 'solid-green.webm']);
  for (const [i, name] of ['開頭', '結尾'].entries()) {
    await clips(page).nth(i).tap();
    await openTab(page, '剪輯');
    await page.getByRole('button', { name: '命名', exact: true }).tap();
    await page.getByRole('textbox', { name: '素材名稱', exact: true }).fill(name);
    await page.getByRole('button', { name: '儲存名稱', exact: true }).tap();
  }
  await openTab(page, '特效');
  await expect(page.getByLabel('轉場片段 A 到 B').locator('option:checked')).toHaveText('開頭 → 結尾');
  expect(
    await page
      .getByRole('tablist', { name: '特效類型', exact: true })
      .evaluate((el) => getComputedStyle(el).backgroundColor),
  ).toBe('rgba(0, 0, 0, 0)');
  await page.getByRole('button', { name: '疊化', exact: true }).tap();
  await expect(page.getByRole('button', { name: '疊化', exact: true })).toHaveAttribute(
    'aria-pressed',
    'true',
  );
  await page.getByRole('button', { name: '移除轉場', exact: true }).tap();
  await page.getByLabel('轉場片段 A 到 B').scrollIntoViewIfNeeded();
  await shot(page, 'named-pair-no-nested-frame');
});

test('不同iPhone尺寸保留比例與時間軸小字，最底仍可回頂且無底部保留空白', async ({ page }) => {
  await createProjectWith(page, ['tone-video.webm']);
  for (const [width, height] of [
    [320, 568],
    [375, 667],
    [390, 844],
    [414, 896],
    [430, 932],
  ]) {
    await page.setViewportSize({ width: width!, height: height! });
    const scale = Math.min(1.1, Math.max(1, width! / 390));
    expect(
      await page
        .locator('.bottombar .tab')
        .first()
        .evaluate((el) => parseFloat(getComputedStyle(el).fontSize)),
    ).toBeCloseTo(14 * scale, 1);
    expect(
      await page
        .locator('.tick')
        .first()
        .evaluate((el) => parseFloat(getComputedStyle(el).fontSize)),
    ).toBeCloseTo(11 * scale, 1);
    await page.locator('.editor').evaluate((el) => {
      el.scrollTop = el.scrollHeight;
    });
    const back = page.getByRole('button', { name: '回到最上方預覽', exact: true });
    await expect(back).toBeVisible();
    const b = (await back.boundingBox())!;
    expect(b.y + b.height).toBeLessThanOrEqual(height!);
    expect(b.width).toBeGreaterThanOrEqual(44);
    const gap = await page.evaluate(
      () =>
        document.querySelector('.editor')!.getBoundingClientRect().bottom -
        document.querySelector('.bottombar')!.getBoundingClientRect().bottom,
    );
    expect(gap).toBeLessThan(12);
    expect(
      await page.locator('.editor').evaluate((el) => el.scrollWidth - el.clientWidth),
    ).toBeLessThanOrEqual(1);
    await back.tap();
    await expect.poll(() => page.locator('.editor').evaluate((el) => el.scrollTop)).toBeLessThan(3);
  }
  await page.locator('.editor').evaluate((el) => {
    el.scrollTop = el.scrollHeight;
  });
  await shot(page, 'iphone-large-bottom-return');
});

test('版型維持自身長型或方形，寬高可分開設定，修改影片比例不拉扁版型', async ({ page }) => {
  await createProjectWith(page, ['solid-blue.webm']);
  await template(page);
  await expect(page.getByLabel('版型寬度', { exact: true })).toHaveValue('1080');
  await expect(page.getByLabel('版型高度', { exact: true })).toHaveValue('1920');
  await page.getByRole('button', { name: '畫面比例', exact: true }).tap();
  await page.getByRole('radio', { name: '橫式 4:3', exact: true }).tap();
  await expect(page.getByTestId('preview-canvas')).toHaveAttribute('height', '405');
  await expect(page.getByLabel('版型高度', { exact: true })).toHaveValue('1920');
  await page
    .getByRole('button', { name: /^收合.*群組$/ })
    .first()
    .tap();
  await page.getByRole('button', { name: '定格', exact: true }).tap();
  await page.getByTestId('stage').scrollIntoViewIfNeeded();
  await expect(page.getByTestId('selbox')).toBeVisible();
  const box = (await page.getByTestId('selbox').boundingBox())!;
  expect(box.width / box.height).toBeCloseTo(9 / 16, 2);
  await page.getByLabel('版型寬度', { exact: true }).fill('720');
  await page.getByLabel('版型高度', { exact: true }).fill('1600');
  expect((await current(page)).tracks.find((t) => t.template)?.layout?.size).toEqual({
    width: 720,
    height: 1600,
  });
  await expect
    .poll(async () => {
      const b = (await page.getByTestId('selbox').boundingBox())!;
      return b.width / b.height;
    })
    .toBeCloseTo(720 / 1600, 2);
  await page.getByRole('button', { name: '畫面比例', exact: true }).tap();
  await page.getByRole('radio', { name: '方形 1:1', exact: true }).tap();
  await expect
    .poll(async () => {
      const b = (await page.getByTestId('selbox').boundingBox())!;
      return b.width / b.height;
    })
    .toBeCloseTo(720 / 1600, 2);
  await page.getByTestId('stage').scrollIntoViewIfNeeded();
  await shot(page, 'independent-template-on-square-output');
  await page.getByRole('button', { name: '四格相紙', exact: true }).tap();
  await expect(page.getByLabel('版型寬度', { exact: true })).toHaveValue('1080');
  await expect(page.getByLabel('版型高度', { exact: true })).toHaveValue('1080');
});

test('預設低畫質且可在比例旁調整，影片輸出框隨比例改變，畫質切換保留秒數且不改匯出', async ({ page }) => {
  await createProjectWith(page, ['tone-video.webm']);
  await expect(page.getByTestId('preview-canvas')).toHaveAttribute('height', '540');
  const original = await current(page);
  await seekTo(page, 1);
  await page.getByRole('button', { name: '預覽畫質', exact: true }).tap();
  await page.getByRole('button', { name: '平衡', exact: true }).tap();
  await expect(page.getByTestId('preview-canvas')).toHaveAttribute('height', '1080');
  await expect(page.getByTestId('time')).toContainText('0:01.0');
  expect([(await current(page)).width, (await current(page)).height]).toEqual([
    original.width,
    original.height,
  ]);
  const exported = await exportFrame(page, 1, [[0.5, 0.5]]);
  expect([exported.width, exported.height]).toEqual([original.width, original.height]);
  await page.getByRole('button', { name: '預覽畫質', exact: true }).tap();
  await page.getByRole('button', { name: '低畫質・順暢', exact: true }).tap();
  for (const [name, ratio] of [
    ['直式 9:16', 9 / 16],
    ['橫式 4:3', 4 / 3],
    ['方形 1:1', 1],
  ] as const) {
    await page.getByRole('button', { name: '畫面比例', exact: true }).tap();
    await page.getByRole('radio', { name, exact: true }).tap();
    await expect
      .poll(async () => {
        const b = (await page.getByTestId('stage').boundingBox())!;
        return b.width / b.height;
      })
      .toBeCloseTo(ratio, 2);
  }
  await expect(page.locator('.export-bounds-label')).toContainText('1:1');
  await page.getByRole('button', { name: '畫面比例', exact: true }).tap();
  await page.getByRole('radio', { name: '橫式 4:3', exact: true }).tap();
  await page.getByTestId('stage').scrollIntoViewIfNeeded();
  await shot(page, 'low-quality-wide-output-bounds');
  await page.getByRole('button', { name: '播放', exact: true }).tap();
  await expect(page.getByRole('button', { name: '暫停', exact: true })).toHaveAttribute(
    'aria-pressed',
    'true',
  );
  await page.getByRole('button', { name: '暫停', exact: true }).tap();
});
