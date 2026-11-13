import { expect, type Page } from '@playwright/test';

/** Plain UI text, with ancestor alpha backgrounds composed in display order.
 * Media artwork and genuinely disabled controls are outside this text-surface audit. */
export async function assertUiContrast(page: Page, root: string, state: string) {
  const result = await page.locator(root).evaluate((root) => {
    const skip =
      ':disabled,[aria-disabled="true"],[aria-hidden="true"],.cover,.template-art,.slot-map,.shape-thumb,.deco-thumb,.drawing-stage,.crop-stage,.safe-bottom,.safe-right';
    const canvas = document.createElement('canvas');
    canvas.width = canvas.height = 1;
    const ctx = canvas.getContext('2d', { willReadFrequently: true })!;
    const colors = new Map<string, number[]>();
    const rgba = (value: string) => {
      if (!colors.has(value)) {
        ctx.clearRect(0, 0, 1, 1);
        ctx.fillStyle = value;
        ctx.fillRect(0, 0, 1, 1);
        colors.set(value, Array.from(ctx.getImageData(0, 0, 1, 1).data));
      }
      return colors.get(value)!;
    };
    const over = (fg: number[], bg: number[]) =>
      fg.slice(0, 3).map((v, i) => (v * fg[3]!) / 255 + bg[i]! * (1 - fg[3]! / 255));
    const lum = (rgb: number[]) =>
      rgb.reduce((sum, value, i) => {
        const n = value / 255;
        return sum + (n <= 0.04045 ? n / 12.92 : ((n + 0.055) / 1.055) ** 2.4) * [0.2126, 0.7152, 0.0722][i]!;
      }, 0);
    const styles = new Map<Element, CSSStyleDeclaration>();
    const style = (el: Element) => {
      if (!styles.has(el)) styles.set(el, getComputedStyle(el));
      return styles.get(el)!;
    };
    const background = (el: Element, point: { x: number; y: number }) => {
      const ancestors: Element[] = [];
      for (let node: Element | null = el; node; node = node.parentElement) ancestors.push(node);
      return ancestors.reverse().reduce(
        (bg, node) => {
          const box = node.getBoundingClientRect();
          if (
            !['HTML', 'BODY'].includes(node.tagName) &&
            (point.x < box.left || point.x > box.right || point.y < box.top || point.y > box.bottom)
          )
            return bg;
          return over(rgba(style(node).backgroundColor), bg);
        },
        [255, 255, 255],
      );
    };
    let checked = 0;
    const bad: { text: string; element: string; ratio: number; color: string; background: number[] }[] = [];
    const inspect = (
      el: Element,
      text: string,
      color = style(el).color,
      point?: { x: number; y: number },
    ) => {
      if (el.closest(skip) || !el.getClientRects().length || style(el).visibility !== 'visible') return;
      const box = el.getBoundingClientRect();
      const bg = background(el, point ?? { x: box.x + box.width / 2, y: box.y + box.height / 2 }),
        fg = over(rgba(color), bg);
      const a = lum(fg),
        b = lum(bg),
        ratio = (Math.max(a, b) + 0.05) / (Math.min(a, b) + 0.05);
      checked++;
      if (ratio < 4.5 && bad.length < 40)
        bad.push({
          text: text.slice(0, 65),
          element: `${el.tagName}.${el.className}`,
          ratio: Math.round(ratio * 100) / 100,
          color,
          background: bg.map(Math.round),
        });
    };
    const walk = document.createTreeWalker(root, NodeFilter.SHOW_TEXT);
    while (walk.nextNode()) {
      const node = walk.currentNode,
        el = node.parentElement;
      if (!el || !node.textContent?.trim()) continue;
      const range = document.createRange();
      range.selectNodeContents(node);
      const box = el.getBoundingClientRect(),
        textBox = range.getBoundingClientRect();
      const left = Math.max(box.left, textBox.left),
        right = Math.min(box.right, textBox.right);
      const top = Math.max(box.top, textBox.top),
        bottom = Math.min(box.bottom, textBox.bottom);
      if (right <= left || bottom <= top) continue;
      inspect(el, node.textContent.trim(), style(el).color, { x: (left + right) / 2, y: (top + bottom) / 2 });
    }
    for (const el of Array.from(
      root.querySelectorAll(
        'input:not([type="range"]):not([type="checkbox"]):not([type="radio"]):not([type="file"]),textarea,select',
      ),
    )) {
      inspect(el, el.getAttribute('aria-label') ?? el.tagName);
      if (el.matches(':placeholder-shown'))
        inspect(
          el,
          'placeholder: ' + el.getAttribute('placeholder'),
          getComputedStyle(el, '::placeholder').color,
        );
    }
    return { checked, bad };
  });
  expect(result.checked, state + ': visible text was inspected').toBeGreaterThan(0);
  expect(result.bad, state).toEqual([]);
}
