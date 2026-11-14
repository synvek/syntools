import { expect, test, type Page } from '@playwright/test';

/**
 * Sheet editor P1 surfaces (plan P1-1 / P1-2).
 *
 * Both features are only reachable through the keyboard layer, so this spec is the regression net for
 * "the binding exists but nothing happens" — the exact failure the old hand-written `⌘N` label had.
 */

test.use({ locale: 'zh-CN', viewport: { width: 1440, height: 900 } });

/** `Mod` in the app is ⌘ on macOS and Ctrl elsewhere; follow the runner's platform */
const MOD = process.platform === 'darwin' ? 'Meta' : 'Control';

async function openEditor(page: Page): Promise<void> {
  await page.goto('/tools/spreadsheet-editor');
  await expect(page.locator('canvas').first()).toBeVisible();
  await page.waitForTimeout(1500);
}

test('sheet: shortcut help opens from the keyboard layer and closes with Escape', async ({
  page,
}) => {
  await openEditor(page);

  await page.keyboard.press(`${MOD}+Alt+/`);
  const dialog = page.getByTestId('sheet-shortcut-help');
  await expect(dialog).toBeVisible();
  // The cheat sheet is generated from the command table, so a bound command must appear in it
  await expect(dialog).toContainText(/导出|Export/);

  await page.keyboard.press('Escape');
  await expect(dialog).toHaveCount(0);
});

test('sheet: Format Cells opens with the shortcut and applies a border', async ({ page }) => {
  await openEditor(page);

  const grid = await page.locator('canvas[id^="univer-sheet-main-canvas"]').boundingBox();
  if (!grid) throw new Error('sheet grid is not laid out');
  await page.mouse.click(grid.x + 140, grid.y + 90);

  await page.keyboard.press(`${MOD}+Alt+1`);
  const dialog = page.getByTestId('sheet-format-cells-dialog');
  await expect(dialog).toBeVisible();

  await page.getByTestId('sheet-format-tab-border').click();
  await page.getByTestId('sheet-format-border-preset').selectOption('all');
  await page.getByTestId('sheet-format-apply').click();

  await expect(dialog).toHaveCount(0);
});
