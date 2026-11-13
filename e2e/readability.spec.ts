import { expect, test } from '@playwright/test';
import { assertUiContrast } from './ui-contrast';
import { createProjectWith, clips, openTab } from './helpers';

for (const theme of ['dark', 'mono', 'light', 'fresh', 'warm', 'beige']) {
  test(`${theme}：首次設定、首頁、設定、編輯器與彈窗的操作文字有清楚對比`, async ({ page }) => {
    test.setTimeout(90000);
    await page.addInitScript(
      (theme) => localStorage.setItem('lm2-preferences', JSON.stringify({ theme, preview: 1080 })),
      theme,
    );
    await page.goto('./');
    await expect(page.locator('html')).toHaveAttribute('data-theme', theme);
    const welcome = page.getByRole('dialog', { name: '首次使用', exact: true });
    await expect(welcome).toBeVisible();
    await assertUiContrast(page, '.welcome', theme + ' first');
    await page.getByRole('button', { name: '不是，我換了手機或清除過資料', exact: true }).tap();
    await assertUiContrast(page, '.welcome', theme + ' restore');
    await page.getByRole('button', { name: '先略過，繼續設定', exact: true }).tap();
    await assertUiContrast(page, '.welcome', theme + ' backup');
    if (theme === 'beige' || theme === 'dark')
      await page.screenshot({ path: `docs/screenshots/readability/backup-${theme}.png` });
    await page.getByRole('radio', { name: /存到 Google 雲端/ }).tap();
    await page.getByRole('textbox', { name: 'Google 雲端資料夾網址', exact: true }).fill('invalid-folder');
    await assertUiContrast(page, '.welcome', theme + ' backup warning');
    await page.getByRole('button', { name: '下一步', exact: true }).tap();
    await assertUiContrast(page, '.welcome', theme + ' packs');
    if (theme === 'beige' || theme === 'dark')
      await page.screenshot({ path: `docs/screenshots/readability/font-packs-${theme}.png` });
    await page.getByRole('button', { name: '先略過，之後再下載', exact: true }).tap();
    await expect(welcome).toHaveCount(0);
    await assertUiContrast(page, '.page', theme + ' home');
    await page.getByRole('link', { name: '設定', exact: true }).tap();
    await page.getByRole('button', { name: /字體授權與來源/ }).tap();
    await assertUiContrast(page, '.settings', theme + ' settings and licenses');
    if (theme === 'beige') {
      await page.locator('.settings .topbar').scrollIntoViewIfNeeded();
      await page.screenshot({ path: 'docs/screenshots/readability/settings-beige.png' });
    }
    await page.goto('#/not-found');
    await expect(page.getByRole('heading', { name: '找不到頁面', exact: true })).toBeVisible();
    await assertUiContrast(page, '.page', theme + ' missing page');
    await page.goto('#/p/readability-missing-project');
    await expect(page.getByRole('heading', { name: '找不到這個專案', exact: true })).toBeVisible();
    await assertUiContrast(page, '.page', theme + ' missing project');
    await createProjectWith(page, ['tone-video.webm']);
    await clips(page).first().tap();
    for (const tab of ['剪輯', '影像', '圖層', '版型', '素材', '音訊', '特效'] as const) {
      await openTab(page, tab);
      await assertUiContrast(page, '.editor', theme + ' editor ' + tab);
    }
    const closeSheet = async () => {
      await page.locator('.sheet-backdrop').tap({ position: { x: 2, y: 2 } });
      await expect(page.locator('.sheet')).toHaveCount(0);
    };
    for (const name of ['專案名稱', '畫面比例', '匯出影片']) {
      await page.getByRole('button', { name, exact: true }).tap();
      await assertUiContrast(page, '.sheet', theme + ' ' + name);
      await closeSheet();
    }
    await openTab(page, '剪輯');
    for (const name of ['片段範圍', '裁切']) {
      await page.getByRole('button', { name, exact: true }).tap();
      await assertUiContrast(page, '.sheet', theme + ' ' + name);
      await closeSheet();
    }
    await openTab(page, '音訊');
    await page.getByRole('button', { name: '聲音片段範圍', exact: true }).first().tap();
    await assertUiContrast(page, '.sheet', theme + ' audio range');
    await closeSheet();
    await openTab(page, '素材');
    await page.getByRole('button', { name: '＋ 畫畫', exact: true }).tap();
    await assertUiContrast(page, '.sheet', theme + ' drawing');
    await closeSheet();
    await openTab(page, '文字');
    await page.getByRole('button', { name: /新增文字/ }).tap();
    await assertUiContrast(page, '.editor', theme + ' text');
    if (theme === 'beige') {
      await page.getByRole('textbox', { name: '文字內容', exact: true }).scrollIntoViewIfNeeded();
      await page.screenshot({ path: 'docs/screenshots/readability/compact-spacing-beige.png' });
    }
    await page.locator('.color-custom-button').first().tap();
    await assertUiContrast(page, '.sheet', theme + ' custom color');
    await closeSheet();
    await page.getByRole('button', { name: '字體', exact: true }).tap();
    await assertUiContrast(page, '.sheet', theme + ' font picker');
    await page.getByRole('button', { name: '系統預設字體 永遠的家 Aa 123', exact: true }).tap();
    await openTab(page, '圖層');
    await page.getByRole('button', { name: '定格細部調整', exact: true }).tap();
    await assertUiContrast(page, '.sheet', theme + ' freeze');
    await page.getByRole('button', { name: '完成定格', exact: true }).tap();
  });
}
