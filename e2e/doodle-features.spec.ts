import { expect, test, type Locator } from '@playwright/test';

// The canvas is tall (top toolbar + canvas + zoom bar), so the viewport must be tall enough for clicks to land fully
test.use({ viewport: { width: 1280, height: 1200 } });

const stats = (canvas: Locator) =>
  canvas.evaluate((el: HTMLCanvasElement) => {
    const ctx = el.getContext('2d');
    if (!ctx) return { count: 0, minX: 0, minY: 0, maxX: 0, maxY: 0 };
    const { data } = ctx.getImageData(0, 0, el.width, el.height);
    let count = 0;
    let minX = Number.POSITIVE_INFINITY;
    let minY = Number.POSITIVE_INFINITY;
    let maxX = -1;
    let maxY = -1;
    for (let y = 0; y < el.height; y += 1) {
      for (let x = 0; x < el.width; x += 1) {
        if (data[(y * el.width + x) * 4 + 3] > 8) {
          count += 1;
          if (x < minX) minX = x;
          if (x > maxX) maxX = x;
          if (y < minY) minY = y;
          if (y > maxY) maxY = y;
        }
      }
    }
    return { count, minX, minY, maxX, maxY };
  });

test('doodle board enhancements: polygon / move / eyedropper / zoom / background color', async ({
  page,
}) => {
  await page.addInitScript(() => {
    localStorage.setItem(
      'syntools:settings.v1',
      JSON.stringify({ lang: 'zh', langExplicit: true }),
    );
  });
  await page.goto('/tools/doodle-board');
  const canvas = page.locator('canvas');
  await expect(canvas).toBeVisible();
  await page.waitForTimeout(400);
  const box = (await canvas.boundingBox())!;

  // 1) Switch the background to a dark color so the eyedropper can be verified
  await page.getByRole('button', { name: '#111827' }).click();

  // 2) Zoom: the percentage should grow after zooming in
  const zoomLabel = page.locator('button[title="缩放"]');
  const before = Number((await zoomLabel.innerText()).replace('%', ''));
  await page.getByRole('button', { name: '放大' }).click();
  const after = Number((await zoomLabel.innerText()).replace('%', ''));
  expect(after).toBeGreaterThan(before);
  await page.getByRole('button', { name: '适应窗口' }).click();

  // 3) Free-form polygon: three points + click back on the start point to close
  await page.getByRole('button', { name: '多边形' }).click();
  const cx = box.x + box.width * 0.35;
  const cy = box.y + box.height * 0.45;
  await page.mouse.click(cx, cy);
  await page.mouse.click(cx + 120, cy - 40);
  await page.mouse.click(cx + 90, cy + 90);
  await page.mouse.click(cx, cy); // click back on the start point → close
  await page.waitForTimeout(120);
  const drawn = await stats(canvas);
  expect(drawn.count).toBeGreaterThan(0);

  // 4) Move everything: drag 60px to the right, the content bounding box should shift right
  await page.getByRole('button', { name: '移动' }).click();
  await page.mouse.move(cx + 40, cy + 20);
  await page.mouse.down();
  await page.mouse.move(cx + 100, cy + 20, { steps: 8 });
  await page.mouse.up();
  await page.waitForTimeout(120);
  const moved = await stats(canvas);
  expect(moved.count).toBeGreaterThan(0);
  expect(moved.minX).toBeGreaterThan(drawn.minX + 30);

  // 5) Eyedropper: click an empty spot to pick the canvas background, then it switches back to the previous tool
  await page.getByRole('button', { name: '吸管' }).click();
  await page.mouse.click(box.x + 8, box.y + 8);
  await page.waitForTimeout(120);
  const fg = await page
    .getByRole('button', { name: '更多颜色' })
    .evaluate((el: HTMLElement) => el.querySelectorAll('span')[1]?.style.backgroundColor);
  expect(fg).toBe('rgb(17, 24, 39)');
  await expect(page.getByRole('button', { name: '移动' })).toHaveAttribute('aria-pressed', 'true');

  // 6) Right-click a swatch → set as background color
  await page.getByRole('button', { name: '更多颜色' }).click();
  await page.getByRole('button', { name: '#ef4444' }).first().click({ button: 'right' });
  const bg = await page
    .getByRole('button', { name: '更多颜色' })
    .evaluate((el: HTMLElement) => el.querySelectorAll('span')[0]?.style.backgroundColor);
  expect(bg).toBe('rgb(239, 68, 68)');

  // 7) Shapes default to a "background color" fill: interior pixels should equal the background (opaque)
  await page.keyboard.press('Escape');
  await page.getByRole('button', { name: '矩形' }).click();
  await page.mouse.move(box.x + 120, box.y + 120);
  await page.mouse.down();
  await page.mouse.move(box.x + 300, box.y + 260, { steps: 6 });
  await page.mouse.up();
  await page.waitForTimeout(200);
  const inner = await canvas.evaluate((el: HTMLCanvasElement) => {
    const ctx = el.getContext('2d');
    if (!ctx) return null;
    // Rectangle from top-left (120,120) to bottom-right (300,260); sample a point inside
    const x = Math.round((120 + (300 - 120) * 0.5) * (el.width / el.clientWidth));
    const y = Math.round((120 + (260 - 120) * 0.5) * (el.height / el.clientHeight));
    const d = ctx.getImageData(x, y, 1, 1).data;
    return [d[0], d[1], d[2], d[3]];
  });
  expect(inner).toEqual([239, 68, 68, 255]);

  // 8) Collapse the toolbar: the tool panel hides and the canvas gains height; it can be expanded again
  const heightBefore = (await canvas.boundingBox())!.height;
  await page.getByRole('button', { name: '收起工具栏' }).click();
  await expect(page.getByRole('button', { name: '矩形' })).toHaveCount(0);
  await expect(page.getByRole('button', { name: '展开工具栏' })).toBeVisible();
  // Collapsing should make the canvas taller (max-h goes from 64vh → 88vh)
  await page.waitForTimeout(200);
  expect((await canvas.boundingBox())!.height).toBeGreaterThanOrEqual(heightBefore);
  await page.getByRole('button', { name: '展开工具栏' }).click();
  await expect(page.getByRole('button', { name: '矩形' })).toBeVisible();
});
