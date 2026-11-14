import { test, expect, type Page } from '@playwright/test';
import type { Project, VideoItem } from '../src/model/types';
import { writeFile, mkdir } from 'node:fs/promises';
import { createProjectWith, openTab, fixture, markMuteInterval, seekTo, samplePreview } from './helpers';
type Stats = {
  uploads: number;
  allocations: number;
  buffers: number;
  frames: { id: string; width: number; height: number }[];
};
const stats = (page: Page): Promise<Stats> =>
  page.evaluate(() =>
    (window as unknown as { __videoclip: { mediaStats: () => Stats } }).__videoclip.mediaStats(),
  );
const time = (page: Page) =>
  page.evaluate(() => (window as unknown as { __videoclip: { time: () => number } }).__videoclip.time());
const energy = (page: Page) =>
  page.evaluate(() =>
    (window as unknown as { __videoclip: { audioEnergy: () => number } }).__videoclip.audioEnergy(),
  );
async function shot(page: Page, name: string) {
  await page.screenshot({ path: `docs/screenshots/audio-effects/${name}.png` });
}
async function wave(page: Page) {
  return page.evaluate(() => {
    const hook = (
      window as unknown as {
        __videoclip: {
          project: () => Project;
          audioWave: (
            a: number,
            b: number,
            t: number[],
          ) => Promise<{ peak: number; maxJump: number; first: number; last: number; samples: number[] }>;
        };
      }
    ).__videoclip;
    const item = hook
      .project()
      .tracks.flatMap((t) => t.items)
      .find((it) => it.type === 'audio') as VideoItem;
    const ranges = item.audioRanges!,
      end = ranges[0]![1],
      next = ranges[1]![0];
    return hook.audioWave(0, 3, [
      0,
      0.006,
      0.02,
      end - 0.005,
      end + 0.002,
      (end + next) / 2,
      next,
      next + 0.006,
      next + 0.02,
      2.999,
    ]);
  });
}
test('音訊真實波形在片頭片尾、剪段、暫停重播及跳轉均平滑且混音不超峰', async ({ page }) => {
  test.setTimeout(120000);
  await createProjectWith(page, ['photo.png']);
  await openTab(page, '音訊');
  await page.getByTestId('music-files').setInputFiles(fixture('click-dc.wav'));
  const row = page.locator('.audio-row').filter({ hasText: 'click-dc.wav' });
  await row.getByRole('button', { name: '聲音片段範圍', exact: true }).tap();
  await markMuteInterval(page, 1, 1.5, 3);
  await page.getByRole('button', { name: '套用聲音選段', exact: true }).tap();
  const normal = await wave(page);
  console.info('Offline audio envelope', JSON.stringify(normal));
  expect(Math.abs(normal.first)).toBeLessThan(0.0001);
  expect(Math.abs(normal.last)).toBeLessThan(0.005);
  expect(normal.maxJump).toBeLessThan(0.03);
  expect(normal.peak).toBeGreaterThan(0.5);
  expect(Math.abs(normal.samples[4]!)).toBeLessThan(0.001);
  expect(Math.abs(normal.samples[5]!)).toBeLessThan(0.001);
  expect(Math.abs(normal.samples[6]!)).toBeLessThan(0.001);
  expect(normal.samples[8]).toBeGreaterThan(0.5);
  await row.getByRole('slider', { name: '音量 click-dc.wav', exact: true }).evaluate((el) => {
    const input = el as HTMLInputElement;
    Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value')!.set!.call(input, '200');
    input.dispatchEvent(new Event('input', { bubbles: true }));
  });
  const loud = await wave(page);
  console.info('Loud offline audio envelope', JSON.stringify(loud));
  expect(loud.peak).toBeLessThanOrEqual(1);
  expect(loud.maxJump).toBeLessThan(0.03);
  await page.getByRole('button', { name: '播放', exact: true }).tap();
  await expect.poll(() => energy(page)).toBeGreaterThan(0.01);
  await page.evaluate(() => {
    const w = window as unknown as {
      __videoclip: { audioProbe: (ms: number) => Promise<unknown> };
      probeResult: Promise<unknown>;
    };
    w.probeResult = w.__videoclip.audioProbe(3800);
  });
  await page.getByRole('button', { name: '暫停', exact: true }).tap();
  await expect.poll(() => energy(page)).toBeLessThan(0.001);
  await page.getByRole('button', { name: '播放', exact: true }).tap();
  await expect.poll(() => energy(page)).toBeGreaterThan(0.01);
  await seekTo(page, 0.7);
  await expect.poll(() => time(page)).toBeGreaterThan(1.7);
  const live = await page.evaluate(
    async () =>
      await (
        window as unknown as { probeResult: Promise<{ peak: number; maxJump: number; samples: number }> }
      ).probeResult,
  );
  console.info('Live preview audio envelope', JSON.stringify(live));
  expect(live.samples).toBeGreaterThan(48000);
  expect(live.peak).toBeGreaterThan(0.05);
  expect(live.peak).toBeLessThanOrEqual(1);
  expect(live.maxJump).toBeLessThan(0.08);
  await mkdir('test-results', { recursive: true });
  await writeFile('test-results/audio-wave-metrics.json', JSON.stringify({ normal, loud, live }, null, 2));
  await shot(page, 'audio-envelope-controls');
});
test('色散與故障疊加共用一次來源上傳，連續播放不反覆seek，移除效果正確釋放', async ({ page }) => {
  await page.addInitScript(() => {
    const d = Object.getOwnPropertyDescriptor(HTMLMediaElement.prototype, 'currentTime')!;
    const w = window as unknown as { seekWrites: number };
    w.seekWrites = 0;
    Object.defineProperty(HTMLMediaElement.prototype, 'currentTime', {
      configurable: true,
      get: d.get,
      set: function (this: HTMLMediaElement, n: number) {
        if (this.closest('.pool')) w.seekWrites++;
        d.set!.call(this, n);
      },
    });
  });
  await createProjectWith(page, ['timing-video.webm']);
  await openTab(page, '特效');
  await page.getByRole('tab', { name: '影片特效', exact: true }).tap();
  for (const name of ['色散重影', '數位干擾']) await page.getByRole('button', { name, exact: true }).tap();
  await expect.poll(async () => (await stats(page)).frames.length).toBeGreaterThanOrEqual(18);
  expect((await stats(page)).buffers).toBe(1);
  await page.getByRole('button', { name: '播放', exact: true }).tap();
  await expect.poll(() => time(page)).toBeGreaterThan(0.4);
  const before = await stats(page),
    framesBefore = await page
      .locator('.pool video')
      .evaluateAll((els) =>
        Math.max(...els.map((el) => Number((el as HTMLElement).dataset.frameStamp ?? 0))),
      ),
    seeks = await page.evaluate(() => (window as unknown as { seekWrites: number }).seekWrites);
  await expect.poll(() => time(page)).toBeGreaterThan(1.5);
  const after = await stats(page),
    framesAfter = await page
      .locator('.pool video')
      .evaluateAll((els) =>
        Math.max(...els.map((el) => Number((el as HTMLElement).dataset.frameStamp ?? 0))),
      );
  expect(after.allocations - before.allocations).toBe(0);
  expect(after.uploads - before.uploads).toBeGreaterThan(3);
  expect(after.uploads - before.uploads).toBeLessThanOrEqual(framesAfter - framesBefore + 6);
  expect(
    (await page.evaluate(() => (window as unknown as { seekWrites: number }).seekWrites)) - seeks,
  ).toBeLessThanOrEqual(1);
  await expect.poll(() => energy(page)).toBeGreaterThan(0.005);
  await page.getByRole('button', { name: '暫停', exact: true }).tap();
  await shot(page, 'shared-effect-frames');
  for (const name of ['色散重影', '數位干擾'])
    await page
      .locator('.used-effects .effect-row')
      .filter({ hasText: name })
      .getByRole('button', { name: '移除特效', exact: true })
      .tap();
  await expect.poll(async () => (await stats(page)).frames.length).toBe(1);
  expect((await stats(page)).buffers).toBe(1);
  expect((await samplePreview(page, 0.5, 0.5))![3]).toBe(255);
});
test('柔焦與顆粒播放時維持畫面更新，粒子不反覆配置GPU貼圖，捲頁及popup後可再播', async ({ page }) => {
  await createProjectWith(page, ['timing-video.webm']);
  await openTab(page, '特效');
  await page.getByRole('tab', { name: '影片特效', exact: true }).tap();
  for (const name of ['柔焦', '底片顆粒']) await page.getByRole('button', { name, exact: true }).tap();
  await page.getByRole('button', { name: '播放', exact: true }).tap();
  await expect.poll(() => time(page)).toBeGreaterThan(0.3);
  const before = await stats(page);
  await page.getByTestId('timeline-scroll').scrollIntoViewIfNeeded();
  await expect.poll(() => time(page)).toBeGreaterThan(1.5);
  const after = await stats(page);
  expect(after.allocations - before.allocations).toBe(0);
  expect(after.uploads - before.uploads).toBeGreaterThan(3);
  expect(after.buffers).toBe(2);
  await expect.poll(() => energy(page)).toBeGreaterThan(0.005);
  await page.getByRole('button', { name: '暫停', exact: true }).tap();
  const row = page.locator('.used-effects .effect-row').filter({ hasText: '柔焦' });
  await row.getByRole('button', { name: '調整特效起迄', exact: true }).tap();
  await page.getByRole('button', { name: '取消', exact: true }).tap();
  await page.getByRole('button', { name: '播放', exact: true }).tap();
  const at = await time(page);
  await expect.poll(() => time(page)).toBeGreaterThan(at + 0.2);
  await page.getByRole('button', { name: '暫停', exact: true }).tap();
  await shot(page, 'blur-and-grain-preview');
});
