import { expect, test } from '@playwright/test';
import type { Project } from '../src/model/types';
import { createProjectWith, waitForPreviewReady } from './helpers';

test('開啟專案不再另外抓渲染器分割模組，阻擋舊chunk仍可預覽', async ({ page }) => {
  await page.addInitScript(() => {
    Object.defineProperty(navigator, 'gpu', { configurable: true, value: undefined });
    for (const name of ['GPUShaderStage', 'GPUBufferUsage', 'GPUTextureUsage'])
      Object.defineProperty(window, name, { configurable: true, value: undefined });
  });
  const blocked: string[] = [];
  await page.route('**/VideoClip_2/assets/*.js', (route) => {
    const name = new URL(route.request().url()).pathname.split('/').at(-1)!;
    if (name.startsWith('index-') || name.includes('.worker-')) return route.continue();
    blocked.push(name);
    return route.abort('failed');
  });
  await createProjectWith(page, ['photo.png']);
  await waitForPreviewReady(page);
  expect(blocked).toEqual([]);
  await expect(page.getByTestId('clip')).toHaveCount(1);
});

test('Safari模組錯誤提供更新程式，完整重開原專案且保留素材、OPFS及快取', async ({ page }) => {
  await createProjectWith(page, ['photo.png']);
  await waitForPreviewReady(page);
  await page.getByRole('button', { name: '專案名稱', exact: true }).tap();
  await page.getByLabel('專案名稱輸入', { exact: true }).fill('原專案保留');
  await page.getByRole('button', { name: '確定', exact: true }).tap();
  const original = await page.evaluate(async () => {
    const p = (window as unknown as { __videoclip: { project: () => Project } }).__videoclip.project();
    const root = await navigator.storage.getDirectory();
    const file = await root.getFileHandle('lm2-module-recovery-proof.txt', { create: true });
    const writer = await file.createWritable();
    await writer.write('keep-opfs');
    await writer.close();
    const cache = await caches.open('lm2-module-recovery-proof');
    await cache.put('/VideoClip_2/keep-proof', new Response('keep-cache'));
    return p;
  });
  await page.evaluate(() => {
    window.dispatchEvent(
      Object.assign(new Event('vite:preloadError'), {
        payload: new TypeError('Importing a module script failed.'),
      }),
    );
  });
  const dialog = page.getByRole('dialog', { name: '正在載入專案', exact: true });
  await expect(dialog).toContainText('程式需要重新載入');
  await expect(dialog.getByRole('button', { name: '略過無法載入的素材' })).toHaveCount(0);
  await expect(dialog.getByRole('button', { name: '重試載入', exact: true })).toHaveCount(0);
  await page.screenshot({ path: 'docs/screenshots/module-recovery/code-recovery-dialog.png' });
  await dialog.getByRole('button', { name: '更新程式並重新開啟', exact: true }).tap();
  await expect(page).toHaveURL(/lm2-code-reload=\d+.*#\/p\//);
  await waitForPreviewReady(page);
  const after = await page.evaluate(async () => {
    const p = (window as unknown as { __videoclip: { project: () => Project } }).__videoclip.project();
    const root = await navigator.storage.getDirectory();
    const file = await root.getFileHandle('lm2-module-recovery-proof.txt');
    const cache = await caches.open('lm2-module-recovery-proof');
    return {
      p,
      opfs: await (await file.getFile()).text(),
      cache: await (await cache.match('/VideoClip_2/keep-proof'))!.text(),
      playing: document.querySelector('.playbar button[aria-label="暫停"]') !== null,
    };
  });
  expect(after.p.id).toBe(original.id);
  expect(after.p.name).toBe('原專案保留');
  expect(after.p.assets.map((a) => a.id)).toEqual(original.assets.map((a) => a.id));
  expect(after.p.tracks).toEqual(original.tracks);
  expect(after.opfs).toBe('keep-opfs');
  expect(after.cache).toBe('keep-cache');
  expect(after.playing).toBe(false);
  await page.screenshot({ path: 'docs/screenshots/module-recovery/project-reopened.png' });
  // Exercise the other explicit update entry, without replacing a real worker mid-edit.
  await page.getByRole('link', { name: '回首頁', exact: true }).tap();
  await page.reload();
  await expect(page.getByRole('button', { name: '新增專案', exact: true })).toBeVisible();
  await expect.poll(() => page.evaluate(() => !!navigator.serviceWorker.controller)).toBe(true);
  await page.evaluate(async () => {
    const registration = await navigator.serviceWorker.register('/VideoClip_2/sw.js', {
      scope: '/VideoClip_2/',
      updateViaCache: 'none',
    });
    const installer = new EventTarget();
    Object.defineProperty(installer, 'state', { value: 'installed' });
    Object.defineProperty(registration, 'installing', { configurable: true, value: installer });
    try {
      registration.dispatchEvent(new Event('updatefound'));
      installer.dispatchEvent(new Event('statechange'));
    } finally {
      Reflect.deleteProperty(registration, 'installing');
    }
  });
  await expect(page.getByRole('button', { name: '更新程式', exact: true })).toBeVisible();
  await page.screenshot({ path: 'docs/screenshots/module-recovery/home-update-ready.png' });
  const previousStamp = new URL(page.url()).searchParams.get('lm2-code-reload');
  await page.getByRole('button', { name: '更新程式', exact: true }).tap();
  await page.waitForURL((url) => url.searchParams.get('lm2-code-reload') !== previousStamp);
  await expect(page.getByRole('button', { name: '新增專案', exact: true })).toBeVisible();
  await expect(page.getByRole('button', { name: '更新程式', exact: true })).toHaveCount(0);
});
