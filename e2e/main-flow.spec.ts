import { expect, test } from '@playwright/test';

// Assertions rely on Simplified Chinese copy, while the UI language follows the browser (en-US by default)
test.use({ locale: 'zh-CN' });

/** Main flow: home → search → open tool → input → copy (Tasks T24) */
test('main flow: home → search → open tool → input → copy', async ({ page }) => {
  await page.goto('/');

  // Home lists every tool (sidebar and cards share link names, so take first to avoid strict-mode ambiguity)
  await expect(
    page.getByRole('link', { name: 'Base64 编解码', exact: true }).first(),
  ).toBeVisible();
  await expect(page.getByRole('link', { name: '哈希计算', exact: true }).first()).toBeVisible();

  // Press / to open search, type a keyword and hit Enter to navigate
  await page.keyboard.press('/');
  // The language dropdown (#header-lang) is also a combobox, so it must be distinguished by name
  const searchInput = page.getByRole('combobox', { name: '搜索工具' });
  await expect(searchInput).toBeVisible();
  await searchInput.fill('json');
  await searchInput.press('Enter');
  await expect(page).toHaveURL(/\/tools\/json-format/);

  // Input → live formatted output
  await page.getByRole('textbox', { name: 'JSON 输入' }).fill('{"a":1}');
  const output = page.getByRole('textbox', { name: '输出' });
  await expect(output).toHaveValue('{\n  "a": 1\n}');

  // Copy the result and verify the clipboard contents
  await page.getByRole('button', { name: '复制', exact: true }).click();
  await expect(page.getByRole('button', { name: '已复制' })).toBeVisible();
  const clipboard = await page.evaluate(() => navigator.clipboard.readText());
  expect(clipboard).toBe('{\n  "a": 1\n}');
});

/** SPA deep links open tool pages directly (guaranteed by the fallback route after deploy) */
test('deep link opens a tool page directly', async ({ page }) => {
  await page.goto('/tools/base64');
  await expect(page.getByRole('textbox', { name: '原始文本' })).toBeVisible();
});
