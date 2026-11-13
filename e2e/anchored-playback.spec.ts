import { expect, test, type Page, type Locator } from '@playwright/test';
import { createProjectWith, clips, openTab, seekTo, exportFrame, expandAllGroups } from './helpers';
import type { Project } from '../src/model/types';
const current = (page: Page): Promise<Project> =>
  page.evaluate(() =>
    (window as unknown as { __videoclip: { project: () => Project } }).__videoclip.project(),
  );
const ready = (page: Page) =>
  expect(page.getByRole('dialog', { name: '正在載入專案', exact: true })).toHaveCount(0, { timeout: 45000 });
const energy = (page: Page) =>
  page.evaluate(() =>
    (window as unknown as { __videoclip: { audioEnergy: () => number } }).__videoclip.audioEnergy(),
  );
async function shot(page: Page, name: string) {
  await expect(page.locator('.toast')).toHaveCount(0);
  await page.screenshot({ path: `docs/screenshots/anchored-playback/${name}.png` });
}

test('時間軸代表字在正確秒數，單素材及銜接不同色，收合仍可見且點字開對應設定', async ({ page }) => {
  test.setTimeout(90000);
  await createProjectWith(page, ['solid-red.webm', 'solid-green.webm']);
  await openTab(page, '特效');
  await page.getByRole('button', { name: '疊化', exact: true }).tap();
  await page.getByRole('button', { name: '單一素材', exact: true }).tap();
  const p = await current(page),
    id = p.tracks[0]!.items[0]!.id;
  await page.getByLabel('單一動畫素材', { exact: true }).selectOption(id);
  await page.getByRole('button', { name: '出場', exact: true }).tap();
  await page.getByRole('button', { name: '出場：向左推移', exact: true }).tap();
  await page.getByRole('button', { name: '調整特效起迄', exact: true }).tap();
  const timing = page.getByRole('dialog', { name: '特效起迄', exact: true });
  await timing.getByLabel('第1組特效時長', { exact: true }).fill('1');
  await timing.getByRole('button', { name: '套用特效起迄', exact: true }).tap();
  const single = page
      .getByTestId('timeline-effect-badge')
      .filter({ has: page.locator('span', { hasText: '推' }) }),
    pair = page.getByTestId('timeline-effect-badge').filter({ has: page.locator('span', { hasText: '淡' }) });
  await expect(single).toHaveAttribute('data-scope', 'single');
  await expect(single).toHaveAttribute('data-time', '3');
  await expect(pair).toHaveAttribute('data-time', '4');
  const colors = await Promise.all([
    single.locator('span').evaluate((el) => getComputedStyle(el).backgroundColor),
    pair.locator('span').evaluate((el) => getComputedStyle(el).backgroundColor),
  ]);
  expect(colors[0]).not.toBe(colors[1]);
  await page.getByRole('button', { name: '收合影像群組', exact: true }).tap();
  await expect(page.getByTestId('clip')).toHaveCount(0);
  await expect(single).toBeVisible();
  await single.tap();
  await expect(page.getByRole('button', { name: '出場', exact: true })).toHaveAttribute(
    'aria-pressed',
    'true',
  );
  await expect(page.getByRole('button', { name: '單一素材', exact: true })).toHaveAttribute(
    'aria-pressed',
    'true',
  );
  await pair.tap();
  await expect(page.getByRole('button', { name: '兩個素材銜接', exact: true })).toHaveAttribute(
    'aria-pressed',
    'true',
  );
  await expect(page.getByLabel('轉場片段 A 到 B')).toHaveValue(id);
  await expandAllGroups(page);
  await page.getByTestId('timeline-scroll').scrollIntoViewIfNeeded();
  await shot(page, 'single-and-join-symbols');
  await page.getByRole('button', { name: '單一素材', exact: true }).tap();
  await page.getByLabel('單一動畫素材', { exact: true }).selectOption(p.tracks[0]!.items[1]!.id);
  await page.getByRole('button', { name: '進場', exact: true }).tap();
  await page.getByRole('button', { name: '進場：疊化', exact: true }).tap();
  const mixed = page
    .getByTestId('timeline-effect-badge')
    .filter({ has: page.locator('span[data-scope="pair"]') });
  await expect(mixed).toHaveAttribute('data-scope', 'mixed');
  await mixed.tap();
  const chooser = page.getByRole('dialog', { name: '此秒數的特效', exact: true });
  await expect(chooser).toBeVisible();
  await shot(page, 'same-time-effect-choices');
  await chooser.getByRole('button', { name: /單素材特效.*solid-green/ }).tap();
  await expect(page.getByRole('button', { name: '進場', exact: true })).toHaveAttribute(
    'aria-pressed',
    'true',
  );
  await mixed.tap();
  await chooser.getByRole('button', { name: /銜接特效/ }).tap();
  await expect(page.getByRole('button', { name: '兩個素材銜接', exact: true })).toHaveAttribute(
    'aria-pressed',
    'true',
  );
  await page.getByRole('tab', { name: '影片特效', exact: true }).tap();
  await page.getByRole('button', { name: '黑白電影', exact: true }).tap();
  await mixed.tap();
  await chooser.getByRole('button', { name: /畫面特效/ }).tap();
  await expect(page.getByRole('dialog', { name: '特效起迄', exact: true })).toBeVisible();
});

async function capsule(control: Locator) {
  const s = await control.evaluate((el) => {
    const c = getComputedStyle(el);
    return {
      border: c.borderTopWidth,
      radius: parseFloat(c.borderTopLeftRadius),
      bg: c.backgroundColor,
      color: c.color,
      height: el.getBoundingClientRect().height,
      arrow: c.backgroundImage,
    };
  });
  expect(s.border).toBe('0px');
  expect(s.radius).toBeGreaterThanOrEqual(18);
  expect(s.bg).toBe('rgb(239, 229, 215)');
  expect(s.color).toBe('rgb(48, 39, 31)');
  expect(s.height).toBeGreaterThanOrEqual(44);
  return s;
}
test('六主題的填寫框及下拉都為無黑框膠囊，起迄數字/版型選單/名稱/設定一致', async ({ page }) => {
  await createProjectWith(page, ['solid-red.webm']);
  await openTab(page, '版型');
  await page.getByRole('button', { name: '套用多格版型', exact: true }).tap();
  const select = page.getByLabel('第 1 格素材', { exact: true });
  for (const theme of ['dark', 'mono', 'light', 'fresh', 'warm', 'beige']) {
    await page.evaluate((theme) => (document.documentElement.dataset.theme = theme), theme);
    const s = await capsule(select);
    expect(s.arrow).toContain('svg');
    await capsule(page.getByLabel('版型寬度', { exact: true }));
    await capsule(page.getByLabel('版型文字', { exact: true }));
  }
  await page.getByRole('button', { name: '專案名稱', exact: true }).tap();
  await capsule(page.getByLabel('專案名稱輸入', { exact: true }));
  await page.getByLabel('專案名稱輸入', { exact: true }).fill('圓角輸入');
  await page.getByRole('button', { name: '確定', exact: true }).tap();
  await page.getByLabel('第 1 格素材', { exact: true }).scrollIntoViewIfNeeded();
  await shot(page, 'capsule-fields-and-selects');
  await page.getByRole('link', { name: '回首頁', exact: true }).tap();
  await page.getByRole('link', { name: '設定', exact: true }).tap();
  await capsule(page.getByLabel('GIPHY API Key', { exact: true }));
});

test('真實載入完成前禁止編輯，無自動播放；重播0秒、捲頁及popup後播放狀態一致且不重設速率', async ({
  page,
}) => {
  test.setTimeout(120000);
  await page.addInitScript(() => {
    const w = window as unknown as { allowDecode: boolean; rateWrites: number; seekWrites: number };
    w.allowDecode = false;
    w.rateWrites = 0;
    w.seekWrites = 0;
    const proto = HTMLMediaElement.prototype,
      ready = Object.getOwnPropertyDescriptor(proto, 'readyState')!,
      rate = Object.getOwnPropertyDescriptor(proto, 'playbackRate')!,
      time = Object.getOwnPropertyDescriptor(proto, 'currentTime')!;
    Object.defineProperty(proto, 'readyState', {
      configurable: true,
      get: function (this: HTMLMediaElement) {
        return this.closest('.video-pool') && !w.allowDecode ? 0 : ready.get!.call(this);
      },
    });
    Object.defineProperty(proto, 'playbackRate', {
      configurable: true,
      get: rate.get,
      set: function (this: HTMLMediaElement, n: number) {
        if (this.closest('.video-pool')) w.rateWrites++;
        rate.set!.call(this, n);
      },
    });
    Object.defineProperty(proto, 'currentTime', {
      configurable: true,
      get: time.get,
      set: function (this: HTMLMediaElement, n: number) {
        if (this.closest('.video-pool')) w.seekWrites++;
        time.set!.call(this, n);
      },
    });
  });
  await createProjectWith(page, ['timing-video.webm'], false);
  const loading = page.getByRole('dialog', { name: '正在載入專案', exact: true });
  await expect(loading).toBeVisible();
  await expect(page.locator('.editor')).toHaveAttribute('inert', '');
  const progress = await loading.getByRole('progressbar').getAttribute('value');
  expect(Number(progress)).toBeLessThan(100);
  await shot(page, 'loading-before-ready');
  await page.evaluate(() => ((window as unknown as { allowDecode: boolean }).allowDecode = true));
  await ready(page);
  await expect(page.getByRole('button', { name: '播放', exact: true })).toHaveAttribute(
    'aria-pressed',
    'false',
  );
  const active = () =>
    page
      .locator('.video-pool video')
      .evaluateAll((els) => els.filter((v) => !(v as HTMLVideoElement).paused).length);
  expect(await active()).toBe(0);
  await page.getByRole('button', { name: /^展開時間軸/ }).tap();
  await expandAllGroups(page);
  const before = await page.evaluate(
    () => (window as unknown as { rateWrites: number; seekWrites: number }).rateWrites,
  );
  await page.getByRole('button', { name: '播放', exact: true }).tap();
  await expect.poll(() => energy(page)).toBeGreaterThan(0.01);
  await expect
    .poll(() =>
      page.evaluate(() => (window as unknown as { __videoclip: { time: () => number } }).__videoclip.time()),
    )
    .toBeGreaterThan(0.6);
  expect(
    (await page.evaluate(() => (window as unknown as { rateWrites: number }).rateWrites)) - before,
  ).toBeLessThanOrEqual(1);
  await openTab(page, '特效');
  await expect(page.getByRole('button', { name: '播放特效示意', exact: true })).toHaveAttribute(
    'aria-pressed',
    'false',
  );
  await expect(page.getByRole('button', { name: '暫停', exact: true })).toHaveAttribute(
    'aria-pressed',
    'true',
  );
  await page.getByRole('button', { name: '暫停', exact: true }).tap();
  expect(await active()).toBe(0);
  const seekBefore = await page.evaluate(() => (window as unknown as { seekWrites: number }).seekWrites);
  await seekTo(page, 0);
  await page.getByRole('button', { name: '播放', exact: true }).tap();
  await expect.poll(() => energy(page)).toBeGreaterThan(0.01);
  await expect
    .poll(() =>
      page.evaluate(() => (window as unknown as { __videoclip: { time: () => number } }).__videoclip.time()),
    )
    .toBeGreaterThan(0.3);
  expect(
    (await page.evaluate(() => (window as unknown as { seekWrites: number }).seekWrites)) - seekBefore,
  ).toBeLessThanOrEqual(3);

  await page.getByRole('button', { name: '暫停', exact: true }).tap();
  await clips(page).first().tap();
  await openTab(page, '剪輯');
  await page.getByRole('button', { name: '片段範圍', exact: true }).tap();
  await page.getByRole('button', { name: '播放片段預覽', exact: true }).tap();
  await page.getByRole('button', { name: '暫停片段預覽', exact: true }).tap();
  await page.getByRole('button', { name: '取消', exact: true }).tap();
  expect(await active()).toBe(0);
  await page.getByRole('button', { name: '播放', exact: true }).tap();
  await expect.poll(() => energy(page)).toBeGreaterThan(0.01);
  await page.getByRole('button', { name: '暫停', exact: true }).tap();
  await shot(page, 'paused-after-seek-and-popup');
});

test('分離音訊使用audio元素，連續預覽音量與影片可播放', async ({ page }) => {
  await createProjectWith(page, ['timing-video.webm']);
  await openTab(page, '音訊');
  await page.getByRole('button', { name: '分離原音', exact: true }).tap();
  await page.getByRole('button', { name: '播放', exact: true }).tap();
  await expect.poll(() => energy(page)).toBeGreaterThan(0.01);
  await expect
    .poll(() =>
      page
        .locator('.video-pool audio')
        .evaluateAll(
          (els) =>
            els.filter((el) => !!(el as HTMLElement).dataset.itemId && !(el as HTMLAudioElement).paused)
              .length,
        ),
    )
    .toBe(1);
  expect(
    await page
      .locator('.video-pool video')
      .evaluateAll((els) => els.filter((el) => !(el as HTMLVideoElement).paused).length),
  ).toBe(1);
  for (let i = 0; i < 5; i++) expect(await energy(page)).toBeGreaterThan(0.005);
  await page.getByRole('button', { name: '暫停', exact: true }).tap();
  await expect.poll(() => energy(page)).toBeLessThan(0.001);
  await shot(page, 'separated-audio-decoder');
});

test('大型影片以真正低解析度本機檔預覽，快取重開/切畫質且匯出保留原始細節', async ({ page }) => {
  test.setTimeout(180000);
  let workers = 0;
  page.on('worker', () => workers++);
  await createProjectWith(page, ['preview-large.webm']);
  await ready(page);
  const p = await current(page),
    asset = p.assets[0]!;
  expect(asset.previewFiles?.['540']?.status).toBe('ready');
  await expect
    .poll(() =>
      page
        .locator('.video-pool video')
        .evaluateAll((els) => Math.max(0, ...els.map((v) => (v as HTMLVideoElement).videoWidth))),
    )
    .toBe(540);
  const frame = await exportFrame(page, 0.5, [[1001 / 1920, 0.5]]);
  expect(frame.width).toBe(1920);
  expect(frame.height).toBe(1080);
  expect(frame.samples[0]![1]).toBeGreaterThan(200);
  await expect
    .poll(() =>
      page.evaluate(() =>
        (window as unknown as { __videoclip: { savedProject: () => Promise<Project> } }).__videoclip
          .savedProject()
          .then((p) => p.assets[0]!.previewFiles?.['540']?.status),
      ),
    )
    .toBe('ready');
  const count = workers;
  await page.reload();
  await expect(page.locator('.editor')).toBeVisible();
  await ready(page);
  expect(workers).toBe(count);
  await page.getByRole('button', { name: '預覽畫質', exact: true }).tap();
  await page.getByRole('button', { name: '標準', exact: true }).tap();
  await expect(page.getByTestId('preview-canvas')).toHaveAttribute('width', '720');
  await ready(page);
  expect((await current(page)).assets[0]!.previewFiles?.['720']?.status).toBe('ready');
  await expect
    .poll(() =>
      page
        .locator('.video-pool video')
        .evaluateAll((els) => Math.max(0, ...els.map((v) => (v as HTMLVideoElement).videoWidth))),
    )
    .toBe(720);
  expect((await current(page)).assets[0]!.width).toBe(asset.width);
  await shot(page, 'cached-real-lightweight-preview');
});
