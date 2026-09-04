import { expect, test } from '@playwright/test';

/** 主链路：首页 → 搜索 → 打开工具 → 输入 → 复制（Tasks T24） */
test('主链路：首页 → 搜索 → 打开工具 → 输入 → 复制', async ({ page }) => {
  await page.goto('/');

  // 首页展示全部工具（侧边栏与卡片均含同名链接，取 first 避免 strict mode 歧义）
  await expect(
    page.getByRole('link', { name: 'Base64 编解码', exact: true }).first(),
  ).toBeVisible();
  await expect(page.getByRole('link', { name: '哈希计算', exact: true }).first()).toBeVisible();

  // 按 / 唤起搜索，输入关键词并回车跳转
  await page.keyboard.press('/');
  const searchInput = page.getByRole('combobox');
  await expect(searchInput).toBeVisible();
  await searchInput.fill('json');
  await searchInput.press('Enter');
  await expect(page).toHaveURL(/\/tools\/json-format/);

  // 输入 → 实时格式化输出
  await page.getByRole('textbox', { name: 'JSON 输入' }).fill('{"a":1}');
  const output = page.getByRole('textbox', { name: '输出' });
  await expect(output).toHaveValue('{\n  "a": 1\n}');

  // 复制结果并校验剪贴板内容
  await page.getByRole('button', { name: '复制', exact: true }).click();
  await expect(page.getByRole('button', { name: '已复制' })).toBeVisible();
  const clipboard = await page.evaluate(() => navigator.clipboard.readText());
  expect(clipboard).toBe('{\n  "a": 1\n}');
});

/** SPA 深链可直接访问工具页（部署后由 fallback 路由保障） */
test('深链直接访问工具页', async ({ page }) => {
  await page.goto('/tools/base64');
  await expect(page.getByRole('textbox', { name: '原始文本' })).toBeVisible();
});
