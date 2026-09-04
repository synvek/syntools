import { expect, test } from '@playwright/test';

/** 每个工具 1 条冒烟用例：打开 → 输入 → 断言输出（Tasks T24） */

test('Base64：编码输出正确', async ({ page }) => {
  await page.goto('/tools/base64');
  await page.getByRole('textbox', { name: '原始文本' }).fill('SynTools');
  await expect(page.getByRole('textbox', { name: 'Base64 结果' })).toHaveValue('U3luVG9vbHM=');
});

test('URL 编解码：component 模式编码正确', async ({ page }) => {
  await page.goto('/tools/url-codec');
  await page.getByRole('textbox', { name: '原始文本' }).fill('a b&c');
  await expect(page.getByRole('textbox', { name: '结果' })).toHaveValue('a%20b%26c');
});

test('正则验证：匹配计数与高亮', async ({ page }) => {
  await page.goto('/tools/regex-tester');
  await page.getByLabel('表达式').fill('\\d+');
  await page.getByRole('textbox', { name: '测试文本' }).fill('abc 123 def 45');
  await expect(page.getByText('共 2 个匹配')).toBeVisible();
  await expect(page.locator('mark', { hasText: '123' })).toBeVisible();
});

test('文本对比：差异统计正确', async ({ page }) => {
  await page.goto('/tools/text-diff');
  await page.getByRole('textbox', { name: '原文本' }).fill('a\nb');
  await page.getByRole('textbox', { name: '新文本' }).fill('a\nc');
  await expect(page.getByText('+1 新增 / −1 删除 / 1 未变')).toBeVisible();
});

test('JSON 格式化：4 空格缩进', async ({ page }) => {
  await page.goto('/tools/json-format');
  await page.getByLabel('缩进').selectOption('4');
  await page.getByRole('textbox', { name: 'JSON 输入' }).fill('{"a":1}');
  await expect(page.getByRole('textbox', { name: '输出' })).toHaveValue('{\n    "a": 1\n}');
});

test('时间戳：秒级时间戳解析', async ({ page }) => {
  await page.goto('/tools/timestamp');
  await page.getByLabel('时间戳输入').fill('1725000000');
  await expect(page.getByText('2024-08-30T06:40:00')).toBeVisible();
});

test('UUID：生成 v4 格式正确', async ({ page }) => {
  await page.goto('/tools/uuid');
  await page.getByRole('button', { name: '生成' }).click();
  await expect(page.getByRole('textbox', { name: '生成结果（每行一个）' })).toHaveValue(
    /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/,
  );
});

test('哈希计算：SHA-256 与标准向量一致', async ({ page }) => {
  await page.goto('/tools/hash');
  await page.getByRole('textbox', { name: '文本输入' }).fill('abc');
  await expect(page.getByRole('textbox', { name: 'SHA-256 结果' })).toHaveValue(
    'ba7816bf8f01cfea414140de5dae2223b00361a396177a9cb410ff61f20015ad',
  );
});
