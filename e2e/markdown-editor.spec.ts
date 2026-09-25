import { expect, test } from '@playwright/test';

test.use({ viewport: { width: 1440, height: 1000 } });

const ZH = () =>
  localStorage.setItem('syntools:settings.v1', JSON.stringify({ lang: 'zh', langExplicit: true }));

test('Markdown 编辑器：实时预览 / 任务列表 / 大纲 / 视图模式 / 草稿恢复', async ({ page }) => {
  await page.addInitScript(ZH);

  // 0) 首页卡片已更名为「Markdown 编辑器」
  await page.goto('/');
  await expect(
    page.getByRole('link', { name: 'Markdown 编辑器', exact: true }).first(),
  ).toBeVisible();

  await page.goto('/tools/markdown-preview');

  const editor = page.getByRole('textbox', { name: 'Markdown 编辑' });
  const preview = page.locator('[data-testid="markdown-preview"]');
  await expect(editor).toBeVisible();

  // 1) 实时预览：标题渲染并带上锚点 id
  await editor.click();
  await page.keyboard.type('# Hello');
  await page.waitForTimeout(120);
  await expect(preview.locator('h1')).toHaveText('Hello');
  await expect(preview.locator('h1')).toHaveAttribute('id', 'md-h-1');

  // 2) 任务列表按钮（此时焦点仍在编辑器，延续当前光标）
  await page.keyboard.press('Enter');
  await page.keyboard.press('Enter');
  await page.keyboard.type('todo');
  await page.getByRole('button', { name: '任务列表' }).click();
  await page.waitForTimeout(120);
  await expect(editor).toContainText('- [ ] todo');
  await expect(preview.locator('input[type="checkbox"]')).toHaveCount(1);

  // 3) 大纲：列出标题
  await page.getByRole('button', { name: '大纲' }).click();
  const outline = page.locator('nav[aria-label="大纲"]');
  await expect(outline).toBeVisible();
  await expect(outline.getByRole('button', { name: 'Hello' })).toBeVisible();

  // 4) 统计栏
  await expect(page.getByText('阅读时长', { exact: false }).first()).toBeVisible();

  // 5) 视图模式：编辑 / 预览 / 分屏
  await page.getByRole('button', { name: '编辑', exact: true }).click();
  await expect(preview).toHaveCount(0);
  await expect(editor).toBeVisible();
  await page.getByRole('button', { name: '预览', exact: true }).click();
  await expect(editor).toHaveCount(0);
  await expect(preview).toBeVisible();
  await page.getByRole('button', { name: '分屏', exact: true }).click();
  await expect(editor).toBeVisible();
  await expect(preview).toBeVisible();

  // 6) 草稿自动保存 + 刷新恢复
  await page.waitForTimeout(1200);
  await page.reload();
  const restored = page.getByRole('textbox', { name: 'Markdown 编辑' });
  await expect(restored).toContainText('Hello');
  await expect(restored).toContainText('- [ ] todo');
});
