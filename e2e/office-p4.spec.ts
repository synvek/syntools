import { readFile } from 'node:fs/promises';
import JSZip from 'jszip';
import { expect, test, type Page } from '@playwright/test';

// Assertions rely on Simplified Chinese copy; the UI language follows the browser locale
test.use({ locale: 'zh-CN' });

/**
 * Office P4 e2e (sheet shape plan §5).
 *
 * The unit tests pin the anchor / projection math; only a real browser can prove the two things that
 * were actually broken here:
 *
 * 1. a shape lands **inside the grid** (the overlay used to start at the container's top-left, so a
 *    shape anchored to A1 was painted over the ribbon / formula bar);
 * 2. the shape follows the grid when the sheet scrolls, instead of staying glued to the viewport.
 */

async function openEditor(page: Page): Promise<void> {
  await page.goto('/tools/spreadsheet-editor');
  await expect(page.locator('canvas').first()).toBeVisible();
  // Univer paints after its own async plugin bootstrapping
  await page.waitForTimeout(1500);
}

async function insertShape(page: Page, preset = 'roundRect'): Promise<void> {
  await page.getByTestId('menubar-insert').click();
  await page.getByRole('menu').getByRole('menuitem', { name: '插入形状' }).first().click();
  await expect(page.getByTestId('sheet-shape-palette')).toBeVisible();
  await page.locator(`[data-shape-preset="${preset}"]`).click();
  await expect(page.getByTestId('sheet-shape')).toHaveCount(1);
}

/** Grid canvas box and shape box, both relative to the tool surface */
async function geometry(page: Page): Promise<{
  grid: { left: number; top: number };
  shape: { left: number; top: number } | null;
}> {
  return page.evaluate(() => {
    const surface = document.querySelector('.sheet-canvas')?.parentElement as HTMLElement;
    const bounds = surface.getBoundingClientRect();
    const canvas = [...document.querySelectorAll('canvas')].find((item) =>
      item.id.startsWith('univer-sheet-main-canvas'),
    ) as HTMLCanvasElement;
    const grid = canvas.getBoundingClientRect();
    const el = document.querySelector('[data-testid="sheet-shape"]') as HTMLElement | null;
    const rect = el?.getBoundingClientRect();
    return {
      grid: { left: grid.left - bounds.left, top: grid.top - bounds.top },
      shape: rect ? { left: rect.left - bounds.left, top: rect.top - bounds.top } : null,
    };
  });
}

test('spreadsheet: inserted shape sits inside the grid, not over the ribbon', async ({ page }) => {
  await openEditor(page);
  await insertShape(page);

  const { grid, shape } = await geometry(page);
  expect(shape).not.toBeNull();
  // The grid origin already includes the row / column headers, so "inside the grid" is the strict test
  expect(shape!.left).toBeGreaterThan(grid.left);
  expect(shape!.top).toBeGreaterThan(grid.top);
});

test('spreadsheet: shape follows the sheet when it scrolls', async ({ page }) => {
  await openEditor(page);
  await insertShape(page);

  const before = await geometry(page);
  const canvas = await page.locator('canvas[id^="univer-sheet-main-canvas"]').boundingBox();
  expect(canvas).not.toBeNull();
  await page.mouse.move(canvas!.x + canvas!.width / 2, canvas!.y + canvas!.height / 2);

  // Scroll down 120px: the shape must move up by the same amount (content-anchored, not viewport-pinned)
  await page.mouse.wheel(0, 120);
  await page.waitForTimeout(400);
  const afterY = await geometry(page);
  expect(afterY.shape).not.toBeNull();
  expect(Math.round(before.shape!.top - afterY.shape!.top)).toBeGreaterThan(60);

  // Scroll right 80px: same story on the horizontal axis
  await page.mouse.wheel(80, 0);
  await page.waitForTimeout(400);
  const afterX = await geometry(page);
  expect(afterX.shape).not.toBeNull();
  expect(Math.round(before.shape!.left - afterX.shape!.left)).toBeGreaterThan(40);

  // Back to the origin: the anchor is the source of truth, so the shape returns to where it started
  await page.mouse.wheel(-80, -120);
  await page.waitForTimeout(400);
  const restored = await geometry(page);
  expect(restored.shape).not.toBeNull();
  expect(Math.round(restored.shape!.left)).toBe(Math.round(before.shape!.left));
  expect(Math.round(restored.shape!.top)).toBe(Math.round(before.shape!.top));
});

test('spreadsheet: shapes export as native xdr:sp anchors', async ({ page }) => {
  await openEditor(page);
  await insertShape(page, 'ellipse');

  const [download] = await Promise.all([
    page.waitForEvent('download'),
    (async () => {
      await page.getByTestId('menubar-file').click();
      await page
        .getByRole('menu')
        .getByRole('menuitem', { name: '导出 Excel (.xlsx)' })
        .first()
        .click();
    })(),
  ]);
  const target = test.info().outputPath('shapes.xlsx');
  await download.saveAs(target);

  const zip = await JSZip.loadAsync(await readFile(target));
  const drawingPath = Object.keys(zip.files).find(
    (name) => name.startsWith('xl/drawings/drawing') && name.endsWith('.xml'),
  );
  expect(drawingPath).toBeDefined();
  const drawing = (await zip.file(drawingPath!)?.async('string')) ?? '';
  expect(drawing).toContain('<xdr:oneCellAnchor>');
  expect(drawing).toContain('<xdr:sp ');
  expect(drawing).toContain('<a:prstGeom prst="ellipse"');
});
