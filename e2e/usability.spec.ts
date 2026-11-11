import { expect, test, type Page } from '@playwright/test';
import {
  clips,
  createProjectWith,
  fixture,
  isRed,
  openTab,
  samplePreview,
  project,
  pinchSelection,
  exportFrame,
} from './helpers';

const shot = 'docs/screenshots/usability';
const range = async (page: Page, label: string, value: number) =>
  page.getByRole('slider', { name: label, exact: true }).evaluate((node, n) => {
    const input = node as HTMLInputElement;
    Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value')!.set!.call(input, String(n));
    input.dispatchEvent(new Event('input', { bubbles: true }));
  }, value);

test('在空白編輯器匯入第一支影片，不重整就有首格；沒有 loadeddata/seeked 通知也能恢復', async ({ page }) => {
  await page.addInitScript(() => {
    localStorage.setItem('lm2-debug', '1');
    localStorage.setItem('lm2-skip-onboarding', '1');
    const original = HTMLMediaElement.prototype.addEventListener;
    HTMLMediaElement.prototype.addEventListener = function (
      this: HTMLMediaElement,
      type: string,
      listener: EventListenerOrEventListenerObject,
      options?: boolean | AddEventListenerOptions,
    ) {
      if (this.hasAttribute('webkit-playsinline') && ['loadeddata', 'seeked'].includes(type)) return;
      return original.call(this, type, listener, options);
    } as typeof original;
  });
  await page.goto('./');
  await page.getByRole('button', { name: '新增專案' }).tap();
  await page.getByRole('button', { name: '建立空白專案' }).tap();
  await page.getByTestId('file-input').setInputFiles(fixture('solid-red.webm'));
  await expect(clips(page)).toHaveCount(1);
  await expect.poll(async () => isRed(await samplePreview(page, 0.5, 0.5))).toBe(true);
  await expect(page.getByTestId('preview-canvas')).toHaveAttribute('height', '1920');
  await page.screenshot({ path: `${shot}/first-import.png` });
});

test('移除大圓鈕，以雙指縮放；放大預覽可回到編輯', async ({ page }) => {
  await createProjectWith(page, ['solid-red.webm']);
  await openTab(page, '文字');
  await page.getByRole('button', { name: /新增文字/ }).tap();
  await page.getByLabel('文字內容').fill('清楚看見每個片刻');
  await expect(page.getByTestId('scale-handle')).toHaveCount(0);
  await expect(page.locator('.sel-handle')).toHaveCount(0);
  const before = (await project(page)).tracks[1]!.items[0]!.transform.scale;
  await pinchSelection(page, 1.6);
  expect((await project(page)).tracks[1]!.items[0]!.transform.scale).toBeGreaterThan(before * 1.3);
  const small = (await page.getByTestId('stage').boundingBox())!;
  await page.getByRole('button', { name: '放大預覽', exact: true }).tap();
  expect((await page.getByTestId('stage').boundingBox())!.height).toBeGreaterThan(small.height * 1.4);
  await page.screenshot({ path: `${shot}/expanded-preview.png` });
  await page.getByRole('button', { name: '縮回預覽' }).tap();
  await expect(page.locator('.expanded-preview')).toHaveCount(0);
});

test('完整色碼、裝飾距離、輪廓調整與高密度文字排版可保存及復原', async ({ page }) => {
  await createProjectWith(page, ['solid-red.webm']);
  await openTab(page, '文字');
  await page.getByRole('button', { name: /新增文字/ }).tap();
  await page.getByLabel('文字內容').fill('好好收藏');
  await page.getByLabel('文字顏色色碼', { exact: true }).fill('#125acd');
  expect((await project(page)).tracks[1]!.items[0]!.card!.runs[0]!.color).toBe('#125acd');
  await page.getByRole('tab', { name: '裝飾', exact: true }).tap();
  await page.getByRole('button', { name: '裝飾 波浪底線', exact: true }).tap();
  await range(page, '波浪底線與文字距離', 75);
  await page.getByRole('tab', { name: '字塊', exact: true }).tap();
  await page.getByRole('radio', { name: '雲朵', exact: true }).tap();
  await range(page, '邊界柔和程度', 70);
  await range(page, '凹槽深度', 35);
  const settings = await page.evaluate(() => {
    const p = (
      window as unknown as {
        __videoclip: {
          project: () => {
            tracks: {
              items: {
                card?: { box?: { softness: number; depth: number }; decorations?: { offset: number }[] };
              }[];
            }[];
          };
        };
      }
    ).__videoclip.project();
    return p.tracks[1]!.items[0]!.card;
  });
  expect(settings?.box?.softness).toBe(0.7);
  expect(settings?.box?.depth).toBe(0.35);
  expect(settings?.decorations?.[0]?.offset).toBe(0.75);
  await page.screenshot({ path: `${shot}/soft-cloud-controls.png` });
  await page.getByRole('button', { name: '復原' }).tap();
  const density = await page.evaluate(async () => {
    const h = (
      window as unknown as {
        __videoclip: {
          project: () => { tracks: { items: { card: unknown }[] }[] };
          cardInk: (card: unknown) => Promise<{ pixelRatio: number }>;
        };
      }
    ).__videoclip;
    return (await h.cardInk(h.project().tracks[1]!.items[0]!.card)).pixelRatio;
  });
  expect(density).toBeGreaterThanOrEqual(1.9);
});

test('第一支影片延後，白底與開場文字正確合成，重新整理保留秒數', async ({ page }) => {
  await createProjectWith(page, ['solid-red.webm']);
  await page.getByRole('button', { name: '開場留白', exact: true }).tap();
  await page.getByLabel('第一支影片開始秒數').fill('2.5');
  await page.getByRole('button', { name: '白底', exact: true }).tap();
  await page.getByRole('button', { name: '完成', exact: true }).tap();
  await expect(page.getByTestId('intro-gap')).toBeVisible();
  await expect
    .poll(async () => {
      const c = await samplePreview(page, 0.5, 0.5);
      return !!c && c[0] > 245 && c[1] > 245 && c[2] > 245;
    })
    .toBe(true);
  const frame = await exportFrame(page, 1, [[0.2, 0.2]]);
  expect(frame.samples[0]![0]).toBeGreaterThan(245);
  await openTab(page, '文字');
  await page.getByRole('button', { name: /新增文字/ }).tap();
  await page.getByLabel('文字內容').fill('一段小小的開場');
  await page.getByLabel('文字顏色色碼', { exact: true }).fill('#125acd');
  await page.screenshot({ path: `${shot}/white-intro.png` });
  await page.getByTestId('timeline-scroll').evaluate((el) => {
    el.scrollLeft = 3 * 60;
  });
  await expect.poll(async () => isRed(await samplePreview(page, 0.1, 0.1))).toBe(true);
  await page.waitForTimeout(1200);
  await page.reload();
  await project(page);
  expect((await project(page)).tracks[0]!.items[0]!.start).toBe(2.5);
});

test('多格影片不同色塊同時顯示；三種版型、動態滑入、移除都可操作', async ({ page }) => {
  await createProjectWith(page, ['solid-red.webm']);
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
  await page.getByLabel('版型動態效果').selectOption('none');
  await page.getByRole('button', { name: '套用多格版型', exact: true }).tap();
  await expect
    .poll(async () => {
      const a = await samplePreview(page, 0.5, 0.18),
        b = await samplePreview(page, 0.5, 0.48),
        c = await samplePreview(page, 0.5, 0.78);
      return !!a && !!b && !!c && a[0] > 200 && b[1] > 200 && c[2] > 200;
    })
    .toBe(true);
  const frame = await exportFrame(page, 1, [
    [0.5, 0.18],
    [0.5, 0.48],
    [0.5, 0.78],
  ]);
  expect(frame.samples[0]![0]).toBeGreaterThan(200);
  expect(frame.samples[1]![1]).toBeGreaterThan(200);
  expect(frame.samples[2]![2]).toBeGreaterThan(200);
  await page.screenshot({ path: `${shot}/photobooth.png` });
  await page.getByRole('button', { name: '直式膠卷', exact: true }).tap();
  await page.getByRole('button', { name: '套用多格版型', exact: true }).tap();
  await page.screenshot({ path: `${shot}/filmstrip.png` });
  await page.getByRole('button', { name: '四格相紙', exact: true }).tap();
  await page.getByLabel('第 4 格素材').selectOption({ index: 5 });
  await page.getByLabel('版型動態效果').selectOption('slide');
  await page.getByRole('button', { name: '套用多格版型', exact: true }).tap();
  const p = await project(page);
  expect(p.tracks.filter((t) => t.name.includes('四格相紙'))).toHaveLength(4);
  await page.getByTestId('timeline-scroll').evaluate((el) => {
    el.scrollLeft = 1.2 * 60;
  });
  await page.screenshot({ path: `${shot}/polaroid.png` });
  await page.getByLabel('版型動態效果').selectOption('drift');
  await page.getByRole('button', { name: '套用多格版型', exact: true }).tap();
  await page.getByRole('button', { name: '移除版型', exact: true }).tap();
  expect((await project(page)).tracks.filter((t) => t.name.includes('四格相紙'))).toHaveLength(0);
});
