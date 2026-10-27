import { expect, test } from '@playwright/test';

test.use({ viewport: { width: 1440, height: 1000 } });

const ZH = () =>
  localStorage.setItem('syntools:settings.v1', JSON.stringify({ lang: 'zh', langExplicit: true }));

test('Markdown editor: live preview / task list / outline / view modes / draft restore', async ({
  page,
}) => {
  await page.addInitScript(ZH);

  // 0) The home card is now named "Markdown 编辑器"
  await page.goto('/');
  await expect(
    page.getByRole('link', { name: 'Markdown 编辑器', exact: true }).first(),
  ).toBeVisible();

  await page.goto('/tools/markdown-preview');

  const editor = page.getByRole('textbox', { name: 'Markdown 编辑' });
  const preview = page.locator('[data-testid="markdown-preview"]');
  await expect(editor).toBeVisible();

  // 1) Live preview: heading renders with an anchor id
  await editor.click();
  await page.keyboard.type('# Hello');
  await page.waitForTimeout(120);
  await expect(preview.locator('h1')).toHaveText('Hello');
  await expect(preview.locator('h1')).toHaveAttribute('id', 'md-h-1');

  // 2) Task list button (focus is still in the editor, continuing from the caret)
  await page.keyboard.press('Enter');
  await page.keyboard.press('Enter');
  await page.keyboard.type('todo');
  await page.getByRole('button', { name: '任务列表' }).click();
  await page.waitForTimeout(120);
  await expect(editor).toContainText('- [ ] todo');
  await expect(preview.locator('input[type="checkbox"]')).toHaveCount(1);

  // 3) Outline: lists the headings
  await page.getByRole('button', { name: '大纲' }).click();
  const outline = page.locator('nav[aria-label="大纲"]');
  await expect(outline).toBeVisible();
  await expect(outline.getByRole('button', { name: 'Hello' })).toBeVisible();

  // 4) Stats bar
  await expect(page.getByText('阅读时长', { exact: false }).first()).toBeVisible();

  // 5) View modes: edit / preview / split
  await page.getByRole('button', { name: '编辑', exact: true }).click();
  await expect(preview).toHaveCount(0);
  await expect(editor).toBeVisible();
  await page.getByRole('button', { name: '预览', exact: true }).click();
  await expect(editor).toHaveCount(0);
  await expect(preview).toBeVisible();
  await page.getByRole('button', { name: '分屏', exact: true }).click();
  await expect(editor).toBeVisible();
  await expect(preview).toBeVisible();

  // 6) Draft auto-save + restore after reload
  await page.waitForTimeout(1200);
  await page.reload();
  const restored = page.getByRole('textbox', { name: 'Markdown 编辑' });
  await expect(restored).toContainText('Hello');
  await expect(restored).toContainText('- [ ] todo');
});
