import { expect, test, type Page } from '@playwright/test';
import { clips, createProjectWith, seekTo, waitForPreviewReady, expandAllGroups } from './helpers';
import type { Project } from '../src/model/types';
const current = (page: Page): Promise<Project> =>
  page.evaluate(() =>
    (window as unknown as { __videoclip: { project: () => Project } }).__videoclip.project(),
  );
async function frames(page: Page) {
  return page.evaluate(async () => {
    const p = (window as unknown as { __videoclip: { project: () => Project } }).__videoclip.project();
    const s = p.assets[0]!.filmstrip!;
    return Promise.all(
      s.frames.map(async (frame) => {
        if (!frame.src) return { time: frame.time, src: null, rgb: [] as number[] };
        const img = new Image();
        img.src = frame.src;
        await img.decode();
        const c = document.createElement('canvas');
        c.width = c.height = 1;
        c.getContext('2d')!.drawImage(img, 0, 0, 1, 1, 0, 0, 1, 1);
        return {
          time: frame.time,
          src: frame.src,
          rgb: [...c.getContext('2d')!.getImageData(0, 0, 1, 1).data],
        };
      }),
    );
  });
}
async function assertEverySecondPair(page: Page) {
  const all = await frames(page);
  expect(all.map((f) => f.time)).toEqual(Array.from({ length: 63 }, (_, i) => i * 2));
  expect(new Set(all.map((f) => f.src)).size).toBe(63);
  for (const [i, f] of all.entries()) {
    expect(f.src).toBeTruthy();
    expect(Math.abs(f.rgb[0]! - (32 + 3 * i))).toBeLessThanOrEqual(8);
    expect(Math.abs(f.rgb[1]! - 40)).toBeLessThanOrEqual(8);
    expect(Math.abs(f.rgb[2]! - (224 - 3 * i))).toBeLessThanOrEqual(8);
  }
}
async function visibleAt(page: Page, time: number) {
  await seekTo(page, time);
  const clip = clips(page).first();
  await expect
    .poll(() =>
      clip.evaluate((el) => {
        const view = el.closest('[data-testid="timeline-scroll"]')!.getBoundingClientRect();
        const x = view.left + 57;
        const tile = Array.from(el.querySelectorAll<HTMLElement>('.tiles span')).find((t) => {
          const r = t.getBoundingClientRect();
          return r.left <= x && r.right > x;
        });
        return tile ? Number(tile.dataset.sourceTime) : -1;
      }),
    )
    .toBe(Math.floor(time / 2) * 2);
  const bounds = await clip.evaluate((el) => {
    const view = el.closest('[data-testid="timeline-scroll"]')!.getBoundingClientRect();
    const strip = el.querySelector('.tiles')!.getBoundingClientRect();
    const tiles = Array.from(el.querySelectorAll<HTMLElement>('.tiles span'));
    return {
      count: tiles.length,
      left: tiles[0]!.getBoundingClientRect().left,
      right: tiles.at(-1)!.getBoundingClientRect().right,
      targetLeft: Math.max(view.left, strip.left),
      targetRight: Math.min(view.right, strip.right),
      missing: tiles.some((t) => t.dataset.missing === 'true'),
    };
  });
  expect(bounds.count).toBeLessThan(25);
  expect(bounds.missing).toBe(false);
  expect(bounds.left).toBeLessThanOrEqual(bounds.targetLeft + 0.5);
  expect(bounds.right).toBeGreaterThanOrEqual(bounds.targetRight - 0.5);
}
test('126秒每2秒實際取圖，58/60/112秒與片尾及放大後均對齊且無留白', async ({ page }) => {
  await createProjectWith(page, ['timeline-seconds.webm']);
  await assertEverySecondPair(page);
  for (const time of [0, 2, 4, 58, 60, 112, 124]) {
    await visibleAt(page, time);
    if (time === 58 || time === 112) {
      await page.getByTestId('timeline-scroll').scrollIntoViewIfNeeded();
      await page.screenshot({ path: `docs/screenshots/timestamped-thumbnails/${time}-seconds.png` });
    }
  }
  for (let i = 0; i < 4; i++) await page.getByRole('button', { name: '放大時間軸', exact: true }).tap();
  await visibleAt(page, 112);
  await page.screenshot({ path: 'docs/screenshots/timestamped-thumbnails/zoomed-112-seconds.png' });
});
test('既有專案只有重複首幀或舊8張快取時自動重建，保存及重開不改片段', async ({ page }) => {
  await createProjectWith(page, ['timeline-seconds.webm']);
  const before = await current(page),
    id = before.id;
  await expect
    .poll(() =>
      page.evaluate(
        async () =>
          (
            await (
              window as unknown as { __videoclip: { savedProject: () => Promise<Project> } }
            ).__videoclip.savedProject()
          ).assets[0]!.filmstrip?.frames.length,
      ),
    )
    .toBe(63);
  await page.goto('./');
  await page.evaluate(async (id) => {
    const request = indexedDB.open('little-moments-videoclip-2', 3);
    const db = await new Promise<IDBDatabase>((resolve, reject) => {
      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(request.error);
    });
    const tx = db.transaction('projects', 'readwrite'),
      table = tx.objectStore('projects');
    const get = table.get(id);
    get.onsuccess = () => {
      const p = get.result as Project;
      p.assets[0]!.thumbs = Array(8).fill(p.assets[0]!.filmstrip!.frames[0]!.src);
      delete p.assets[0]!.filmstrip;
      table.put(p);
    };
    await new Promise<void>((resolve, reject) => {
      tx.oncomplete = () => resolve();
      tx.onerror = () => reject(tx.error);
    });
    db.close();
  }, id);
  await page.goto(`./#/p/${id}`);
  await waitForPreviewReady(page);
  await expandAllGroups(page);
  await assertEverySecondPair(page);
  expect((await current(page)).tracks).toEqual(before.tracks);
  await visibleAt(page, 112);
  await expect
    .poll(() =>
      page.evaluate(
        async () =>
          (
            await (
              window as unknown as { __videoclip: { savedProject: () => Promise<Project> } }
            ).__videoclip.savedProject()
          ).assets[0]!.filmstrip?.frames.length,
      ),
    )
    .toBe(63);
  const saved = (await current(page)).assets[0]!.filmstrip;
  await page.reload();
  await waitForPreviewReady(page);
  await expandAllGroups(page);
  expect((await current(page)).assets[0]!.filmstrip).toEqual(saved);
  await visibleAt(page, 112);
});
test('Safari原生解碼備援也取每2秒實際新畫面，不能複製首幀當全部縮圖', async ({ page }) => {
  test.setTimeout(120000);
  await page.addInitScript(() => {
    delete (window as unknown as { VideoDecoder?: unknown }).VideoDecoder;
  });
  await createProjectWith(page, ['timeline-seconds.webm']);
  await assertEverySecondPair(page);
  await visibleAt(page, 112);
});
