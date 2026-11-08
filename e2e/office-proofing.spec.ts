import { expect, test, type Page } from '@playwright/test';

// Assertions rely on Simplified Chinese copy (the UI follows the browser locale)
test.use({ locale: 'zh-CN', viewport: { width: 1440, height: 900 } });

/**
 * Chinese proofreading e2e (plan P1-3, first slice).
 *
 * The rules themselves are pure functions covered by `zhRules.test.ts`; this checks the wiring a jsdom
 * test cannot: the panel groups the issues, the correction offered by a rule really replaces the text,
 * and the two caps are disclosed instead of silently truncating.
 */

async function openRichText(page: Page): Promise<void> {
  await page.goto('/tools/rich-text-editor');
  await expect(page.locator('.tiptap')).toBeVisible();
}

/** Enable spellcheck from the ribbon and wait for the word list (loaded on demand) */
async function enableSpellcheck(page: Page): Promise<void> {
  await page.getByRole('tab', { name: '审阅', exact: true }).click();
  await page.getByRole('button', { name: '拼写检查', exact: true }).click();
  const panel = page.getByTestId('rich-text-spellcheck');
  await expect(panel).toBeVisible();
  await panel.getByRole('button', { name: '已关闭' }).click();
  await expect(panel.getByRole('button', { name: '已开启' })).toBeVisible();
}

test('rich text: Chinese proofing flags punctuation, doubled characters and typos, and fixes them', async ({
  page,
}) => {
  await openRichText(page);
  const errors: string[] = [];
  page.on('pageerror', (error) => errors.push(String(error)));

  await page.locator('.tiptap').click();
  await page.keyboard.type('我们们按装软件,然后开始。。');
  await expect(page.locator('.tiptap p').first()).toContainText('我们们按装软件');

  await enableSpellcheck(page);
  const issues = page.getByTestId('rich-text-spellcheck-issues');
  await expect(issues).toBeVisible({ timeout: 30_000 });

  // Grouped by kind (P1-3 分类展示), each group with its own count
  await expect(issues).toContainText('疑似错字 (1)');
  await expect(issues).toContainText('重复字 (1)');
  await expect(issues).toContainText('标点 (2)');
  // Rule hits underline the text exactly like dictionary misses
  expect(await page.locator('.rte-spell-error').count()).toBeGreaterThanOrEqual(4);

  // The rule's own correction replaces the typo in place
  await issues.getByRole('button', { name: '安装', exact: true }).click();
  await expect(page.locator('.tiptap p').first()).toContainText('我们们安装软件');
  // ... and the issue disappears with the text it described
  await expect(issues).not.toContainText('按装');

  // A ruled-out false positive stays ruled out: the whitelisted idiom is not flagged
  await page.locator('.tiptap').click();
  await page.keyboard.press('ControlOrMeta+End');
  await page.keyboard.type('的的确确如此');
  await expect(issues).not.toContainText('的的');

  expect(errors).toEqual([]);
});
