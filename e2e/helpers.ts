import { expect, type Page } from '@playwright/test';
import path from 'node:path';

export const fixture = (name: string) => path.resolve(process.cwd(), 'tests/fixtures', name);

/** Real Chromium touch input: exercise Pointer Events/capture rather than mutating state. */
export async function pinchSelection(page: Page, factor = 1.7) {
  await page.getByTestId('stage').evaluate((el) => el.scrollIntoView({ block: 'center' }));
  const box = (await page.getByTestId('selbox').boundingBox())!;
  const cx = box.x + box.width / 2,
    cy = box.y + box.height / 2,
    r = Math.min(12, box.width / 4);
  const session = await page.context().newCDPSession(page);
  await session.send('Input.dispatchTouchEvent', {
    type: 'touchStart',
    touchPoints: [
      { x: cx - r, y: cy, id: 1 },
      { x: cx + r, y: cy, id: 2 },
    ],
  });
  for (let i = 1; i <= 5; i++) {
    const distance = r * (1 + ((factor - 1) * i) / 5);
    await session.send('Input.dispatchTouchEvent', {
      type: 'touchMove',
      touchPoints: [
        { x: cx - distance, y: cy, id: 1 },
        { x: cx + distance, y: cy, id: 2 },
      ],
    });
  }
  await session.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] });
  await session.detach();
}

/** 首頁按「＋」→ 選素材 → 自動建立專案並進入編輯器 */
export async function createProjectWith(page: Page, files: string[], expandTimeline = true) {
  // 打開測試用的除錯掛鉤 window.__videoclip（正常使用者看不到）
  await page.addInitScript(() => {
    localStorage.setItem('lm2-debug', '1');
    localStorage.setItem('lm2-skip-onboarding', '1');
  });
  await page.goto('./');
  await page.getByRole('button', { name: '新增專案' }).tap();
  await page.getByTestId('new-project-files').setInputFiles(files.map(fixture));
  await expect(page).toHaveURL(/#\/p\//);
  await expect
    .poll(
      () =>
        page.evaluate(() => {
          const hook = (
            window as unknown as { __videoclip?: { project: () => { tracks: { items: unknown[] }[] } } }
          ).__videoclip;
          return hook?.project().tracks.reduce((n, track) => n + track.items.length, 0) ?? 0;
        }),
      { timeout: 20_000 },
    )
    .toBe(files.length);
  if (expandTimeline) {
    await page.getByRole('button', { name: /^展開時間軸/ }).tap();
    await expandAllGroups(page);
  }
}

export const clips = (page: Page) => page.getByTestId('clip');

/** 目前被選取的片段是第幾個（-1 = 沒有） */
export async function selectedIndex(page: Page): Promise<number> {
  return page
    .getByTestId('clip')
    .evaluateAll((els) => els.findIndex((e) => e.getAttribute('data-selected') === 'true'));
}

export async function clipIds(page: Page): Promise<string[]> {
  return page.getByTestId('clip').evaluateAll((els) => els.map((e) => e.getAttribute('data-item-id')!));
}

/** 把播放頭移到 t 秒（用捲動時間軸，跟使用者手指滑動一樣；預設 60 px/秒） */
export async function seekTo(page: Page, seconds: number, pps = 60) {
  await page.getByTestId('timeline-scroll').evaluate((el, x) => {
    el.scrollLeft = x;
  }, seconds * pps);
}

export async function timeText(page: Page): Promise<string> {
  return (await page.getByTestId('time').textContent()) ?? '';
}

export async function expectToast(page: Page, text: string | RegExp) {
  await expect(page.locator('.toast').filter({ hasText: text }).first()).toBeVisible();
}

export type RGBA = [number, number, number, number];

/** 預覽畫面上某一點的顏色（座標是 0–1 的比例）；預覽引擎還沒好時回傳 null */
export async function samplePreview(page: Page, nx: number, ny: number): Promise<RGBA | null> {
  return page.evaluate(
    ([x, y]) => {
      const h = (window as unknown as { __videoclip?: { samplePreview: (a: number, b: number) => RGBA } })
        .__videoclip;
      return h ? h.samplePreview(x!, y!) : null;
    },
    [nx, ny],
  );
}

export const isRed = (c: RGBA | null) => !!c && c[0] > 200 && c[1] < 70 && c[2] < 70;
export const isGreen = (c: RGBA | null) => !!c && c[1] > 200 && c[0] < 70 && c[2] < 70;
export const isBlue = (c: RGBA | null) => !!c && c[2] > 200 && c[0] < 70 && c[1] < 70;
export const isGray = (c: RGBA | null) =>
  !!c && c[0] > 150 && Math.abs(c[0] - c[1]) < 25 && Math.abs(c[1] - c[2]) < 25;
export const isWhite = (c: RGBA | null) => !!c && c[0] > 230 && c[1] > 230 && c[2] > 230;

type Hook = {
  project: () => {
    tracks: {
      id: string;
      kind: string;
      name: string;
      hidden: boolean;
      locked: boolean;
      items: {
        id: string;
        start: number;
        duration: number;
        type: string;
        transform: { x: number; y: number; scale: number; rotation: number; opacity: number };
        blend?: string;
        cornerRadius?: number;
        outline?: { width: number };
        crop?: Record<string, number>;
        card?: { runs: { text: string; size: number; color: string; fontId: string }[] };
      }[];
    }[];
  };
  selected: () => string | null;
  regionHash: (a: number, b: number, c: number, d: number) => number;
  countColor: (
    rgb: [number, number, number],
    tol: number,
    a: number,
    b: number,
    c: number,
    d: number,
  ) => number;
  exportFrame: (
    t: number,
    pts: [number, number][],
  ) => Promise<{ width: number; height: number; bytes: number; samples: number[][] }>;
};
export type HookProject = ReturnType<Hook['project']>;

export const project = async (page: Page): Promise<HookProject> => {
  // 除錯掛鉤要等預覽引擎建好才有（機器忙時會晚一點）
  await page.waitForFunction(() => !!(window as unknown as { __videoclip?: unknown }).__videoclip);
  return page.evaluate(() => (window as unknown as { __videoclip: Hook }).__videoclip.project());
};

export const selectedItemId = (page: Page): Promise<string | null> =>
  page.evaluate(() => (window as unknown as { __videoclip: Hook }).__videoclip.selected());

export const countColor = (
  page: Page,
  rgb: [number, number, number],
  tol: number,
  r: [number, number, number, number],
) =>
  page.evaluate(
    ([c, t, region]) =>
      (window as unknown as { __videoclip: Hook }).__videoclip.countColor(
        c as [number, number, number],
        t as number,
        ...(region as [number, number, number, number]),
      ),
    [rgb, tol, r] as const,
  );

export const exportFrame = (page: Page, t: number, pts: [number, number][]) =>
  page.evaluate(
    ([tt, p]) =>
      (window as unknown as { __videoclip: Hook }).__videoclip.exportFrame(
        tt as number,
        p as [number, number][],
      ),
    [t, pts] as const,
  );

/** 切到底部分頁 */
export async function openTab(
  page: Page,
  name: '剪輯' | '影像' | '文字' | '圖層' | '版型' | '素材' | '音訊' | '特效',
) {
  const tab = page.locator('.bottombar .tabs').getByRole('tab', { name, exact: true });
  // 點「目前的分頁」會收合面板，所以已經在這個分頁且展開時就不用再點
  if (
    (await tab.getAttribute('aria-selected')) === 'true' &&
    (await tab.getAttribute('aria-expanded')) === 'true'
  )
    return;
  await tab.tap();
}

/** 疊加分頁 →「加入影片或照片」→ 選檔案 */
export async function addOverlays(page: Page, files: string[]) {
  await openTab(page, '影像');
  const before = (await project(page)).tracks.reduce((n, track) => n + track.items.length, 0);
  const [chooser] = await Promise.all([
    page.waitForEvent('filechooser'),
    page.getByRole('button', { name: /加入影片或照片/ }).tap(),
  ]);
  await chooser.setFiles(files.map(fixture));
  // 匯入是非同步的（讀檔、縮圖），等到時間軸上多出這幾個物件
  await expect
    .poll(async () => (await project(page)).tracks.reduce((n, track) => n + track.items.length, 0), {
      timeout: 20_000,
    })
    .toBe(before + files.length);
  if (await page.locator('#editor-timeline').isVisible()) await expandAllGroups(page);
}

export const regionHash = (page: Page, r: [number, number, number, number]) =>
  page.evaluate(
    (region) => (window as unknown as { __videoclip: Hook }).__videoclip.regionHash(...region),
    r,
  );

/** Hold a real touch, then drag one timeline item; no store mutation. */
export async function dragTimelineItem(
  page: Page,
  source: import('@playwright/test').Locator,
  dx: number,
  dy: number,
  beforeRelease?: () => Promise<void>,
) {
  await source.scrollIntoViewIfNeeded();
  await expect(source).toBeInViewport();
  const box = (await source.boundingBox())!;
  const x = box.x + Math.min(box.width / 2, 70),
    y = box.y + box.height / 2;
  expect(
    await source.evaluate((el, point) => el.contains(document.elementFromPoint(point.x, point.y)), { x, y }),
    'The held point must belong to the intended clip',
  ).toBe(true);
  const observed = await source.evaluateHandle((el) => {
    const down = { inside: false, target: '' };
    document.addEventListener(
      'pointerdown',
      (event) => {
        down.inside = el.contains(event.target as Node);
        down.target = (event.target as Element).outerHTML.slice(0, 300);
      },
      { capture: true, once: true },
    );
    return down;
  });
  const session = await page.context().newCDPSession(page);
  try {
    await session.send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: [{ x, y, id: 1 }] });
    const down = await observed.jsonValue();
    expect(down.inside, 'Actual touch target: ' + down.target).toBe(true);
    await page.waitForTimeout(500); // The actual long-press threshold is 400ms.
    await expect(source).toHaveClass(/dragging/);
    for (let i = 1; i <= 10; i++)
      await session.send('Input.dispatchTouchEvent', {
        type: 'touchMove',
        touchPoints: [{ x: x + (dx * i) / 10, y: y + (dy * i) / 10, id: 1 }],
      });
    await beforeRelease?.();
    await session.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] });
  } finally {
    await observed.dispose();
    await session.detach();
  }
}

/** Mark the exact interval through the same explicit controls used on a phone. */
export async function markMuteInterval(page: Page, from: number, to: number, duration = 3) {
  const strip = page.locator('.sheet .source-thumbs');
  const x = (await strip.boundingBox())!.width;
  await strip.tap({ position: { x: (x * from) / duration, y: 20 } });
  await page.getByRole('button', { name: '標記靜音起點', exact: true }).tap();
  await strip.tap({ position: { x: (x * to) / duration, y: 20 } });
  await page.getByRole('button', { name: '標記靜音終點並新增', exact: true }).tap();
  await page.getByRole('button', { name: '調整保留聲音標記', exact: true }).tap();
}

/** Legacy scenarios explicitly open the groups they edit; the product still starts folded. */
export async function expandAllGroups(page: Page) {
  if (!page.url().includes('#/p/')) return;
  await expect(page.locator('.timeline')).toBeAttached({ timeout: 20_000 });
  const toggle = page.getByRole('button', { name: /^展開時間軸/ });
  if (await toggle.count()) await toggle.tap();
  const groups = page.locator('.timeline').getByRole('button', { name: /^展開.*群組$/ });
  while (await groups.count()) await groups.first().tap();
}
export async function setCropOffset(page: Page, value = 0) {
  await page.getByRole('slider', { name: '瞄準偏移', exact: true }).evaluate((el, v) => {
    Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value')!.set!.call(el, String(v));
    el.dispatchEvent(new Event('input', { bubbles: true }));
  }, value);
}
