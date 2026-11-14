import { expect, test, type Page } from '@playwright/test';

/**
 * Sheet editor P0 guarantees (plan P0-1 / P0-3 / P0-6).
 *
 * Only the parts that need a real browser live here: the tab strip must expose tab semantics, and
 * the canvas grid must announce the selection through a live region — unit tests cannot observe
 * either, because both are accessibility-tree facts.
 */

test.use({ locale: 'zh-CN', viewport: { width: 1440, height: 900 } });

async function openEditor(page: Page): Promise<void> {
  await page.goto('/tools/spreadsheet-editor');
  await expect(page.locator('canvas').first()).toBeVisible();
  // Univer paints after its own async plugin bootstrapping
  await page.waitForTimeout(1500);
}

test('spreadsheet: sheet tabs are a tablist with a selected tab', async ({ page }) => {
  await openEditor(page);

  const tablist = page.getByTestId('sheet-tabs');
  await expect(tablist).toHaveAttribute('role', 'tablist');
  const tabs = tablist.getByRole('tab');
  await expect(tabs).toHaveCount(1);
  await expect(tabs.first()).toHaveAttribute('aria-selected', 'true');
});

test('spreadsheet: selecting a cell is announced to assistive tech', async ({ page }) => {
  await openEditor(page);

  const status = page.getByTestId('sheet-a11y-status');
  await expect(status).toHaveAttribute('aria-live', 'polite');

  const grid = await page.locator('canvas[id^="univer-sheet-main-canvas"]').boundingBox();
  if (!grid) throw new Error('sheet grid is not laid out');
  // Cell C4-ish: far enough from the default A1 selection to produce a new announcement
  await page.mouse.click(grid.x + 220, grid.y + 140);

  await expect(status).toContainText(/已选中|Selected/);
});
