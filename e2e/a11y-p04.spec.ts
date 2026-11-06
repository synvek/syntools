import AxeBuilder from '@axe-core/playwright';
import { expect, test } from '@playwright/test';

/**
 * P0-4 accessibility baseline (plan §5.4 / §8.2): the surfaces this task owns — the shared ribbon
 * on all three editors and the word processor's modal dialogs — must have zero critical / serious
 * WCAG A + AA violations.
 *
 * Scope note: a whole-page scan also reports pre-existing debt outside P0-4 — the Tiptap
 * contenteditable has no accessible name (`aria-input-field-name`), global sidebar hints / `kbd`
 * fail `color-contrast`, and Univer's grid ships `aria-allowed-attr` / `label` violations. Those
 * belong to P2-6 (accessibility checker) and are recorded in `findings.md`, not silently waived
 * here. The M1 gate therefore scans the ribbon / dialog surfaces that P0-4 actually changed.
 */
test.use({ locale: 'zh-CN', viewport: { width: 1440, height: 900 } });

const ROUTES = [
  ['word processor', '/tools/rich-text-editor'],
  ['slide editor', '/tools/slide-editor'],
  ['spreadsheet', '/tools/spreadsheet-editor'],
] as const;

test.describe('P0-4 axe baseline', () => {
  for (const [name, route] of ROUTES) {
    test(`${name}: no critical / serious violations`, async ({ page }) => {
      await page.goto(route);
      await expect(page.getByRole('tablist').first()).toBeVisible();

      const results = await new AxeBuilder({ page })
        .include('[data-testid$="-ribbon"]')
        .withTags(['wcag2a', 'wcag2aa'])
        .analyze();
      const blocking = results.violations.filter(
        (violation) => violation.impact === 'critical' || violation.impact === 'serious',
      );
      expect(
        blocking.map((violation) => ({
          id: violation.id,
          impact: violation.impact,
          nodes: violation.nodes.slice(0, 3).map((node) => node.target),
        })),
      ).toEqual([]);
    });
  }

  test('word processor modal dialog has an accessible name and description', async ({ page }) => {
    await page.goto('/tools/rich-text-editor');
    await page.getByTestId('menubar-more').click();
    await page.getByRole('menuitem', { name: '打印预览', exact: true }).click();
    const dialog = page.getByRole('dialog', { name: '打印预览' });
    await expect(dialog).toBeVisible();
    await expect(dialog).toHaveAttribute('aria-describedby', 'rte-print-preview-desc');
    await expect(page.locator('#rte-print-preview-desc')).toBeVisible();

    const results = await new AxeBuilder({ page })
      .include('[role="dialog"][aria-modal="true"]')
      .withTags(['wcag2a', 'wcag2aa'])
      .analyze();
    expect(results.violations.map((violation) => violation.id)).toEqual([]);
  });
});
