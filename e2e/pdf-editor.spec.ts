import { fileURLToPath } from 'node:url';
import { expect, test, type Page } from '@playwright/test';

// Tool copy follows the UI locale; assertions rely on Simplified Chinese
test.use({ locale: 'zh-CN', viewport: { width: 1440, height: 900 } });

const fixture = (name: string) =>
  fileURLToPath(new URL(`../fixtures/pdf/${name}`, import.meta.url));

async function openPdf(page: Page, name: string): Promise<void> {
  await page.goto('/tools/pdf-editor');
  await page.locator('input[type="file"]').setInputFiles(fixture(name));
  await expect(page.getByTestId('pdf-ribbon')).toBeVisible();
}

/**
 * PDF editor M1 smoke: open → navigate → panels → text box → save, plus the encrypted path.
 *
 * Runs against the production build (`pnpm build && pnpm e2e e2e/pdf-editor.spec.ts`) with the
 * fixtures in `fixtures/pdf/`.
 */
test.describe('PDF 编辑器（M1）', () => {
  test('空态可访问，且不渲染功能区', async ({ page }) => {
    const errors: string[] = [];
    page.on('pageerror', (error) => errors.push(error.message));

    await page.goto('/tools/pdf-editor');

    await expect(page.getByRole('heading', { name: 'PDF 编辑器' })).toBeVisible();
    await expect(page.getByText('打开一份 PDF 开始编辑')).toBeVisible();
    await expect(page.getByTestId('pdf-status-page')).toHaveText('未打开文件');
    await expect(page.getByTestId('pdf-ribbon')).toHaveCount(0);
    expect(errors).toEqual([]);
  });

  test('非 PDF 文件在校验后报错', async ({ page }) => {
    await page.goto('/tools/pdf-editor');

    await page.locator('input[type="file"]').setInputFiles({
      name: 'notes.txt',
      mimeType: 'text/plain',
      buffer: Buffer.from('hello'),
    });

    await expect(page.getByRole('alert')).toContainText('请选择 PDF 文件');
    await expect(page.getByTestId('pdf-ribbon')).toHaveCount(0);
  });

  test('打开 3 页文档后可翻页与跳转', async ({ page }) => {
    await openPdf(page, 'three-pages.pdf');

    await expect(page.getByTestId('pdf-status-page')).toHaveText('第 1 / 3 页');
    await expect(page.getByTestId('pdf-page')).toHaveCount(3);
    // Lazily rendered canvas: the first page lands in view
    await expect(page.getByTestId('pdf-page-canvas').first()).toHaveAttribute(
      'data-rendered',
      'true',
    );

    await page.getByTestId('ribbon-navigate-next').click();
    await expect(page.getByTestId('pdf-status-page')).toHaveText('第 2 / 3 页');

    await page.keyboard.press('End');
    await expect(page.getByTestId('pdf-status-page')).toHaveText('第 3 / 3 页');
    await expect(page.getByTestId('ribbon-navigate-next')).toBeDisabled();

    await page.keyboard.press('Home');
    await expect(page.getByTestId('pdf-status-page')).toHaveText('第 1 / 3 页');
  });

  test('缩略图面板可跳页，大纲面板有空态', async ({ page }) => {
    await openPdf(page, 'three-pages.pdf');

    await page.getByRole('tab', { name: '视图' }).click();
    await page.getByTestId('ribbon-panels-thumbnails').click();
    await page.getByTestId('ribbon-panels-outline').click();

    const thumbnails = page.getByTestId('pdf-thumbnails');
    await expect(thumbnails).toBeVisible();

    await thumbnails.locator('[data-page="3"]').click();
    await expect(page.getByTestId('pdf-status-page')).toHaveText('第 3 / 3 页');
    await expect(thumbnails.locator('[data-page="3"]')).toHaveAttribute('aria-selected', 'true');

    await expect(page.getByTestId('pdf-outline')).toContainText('此文档没有大纲');
  });

  test('双击插入文本框并保存下载', async ({ page }) => {
    await openPdf(page, 'three-pages.pdf');

    await page
      .getByTestId('pdf-page')
      .first()
      .dblclick({ position: { x: 160, y: 220 } });
    const input = page.getByTestId('pdf-text-input');
    await expect(input).toBeVisible();
    await page.keyboard.type('Hello');

    // Blur commits the text box
    await page.getByTestId('pdf-status-page').click();
    await expect(page.getByTestId('pdf-text-object')).toHaveText('Hello');
    await expect(page.getByTestId('pdf-save-status')).toHaveAttribute('data-state', 'dirty');

    const downloadPromise = page.waitForEvent('download');
    await page.keyboard.press('Control+s');
    const download = await downloadPromise;

    expect(download.suggestedFilename()).toBe('three-pages-edited.pdf');
    await expect(page.getByTestId('pdf-save-status')).toHaveAttribute('data-state', 'saved');
  });

  test('未保存的编辑会存成本地草稿，刷新后可恢复', async ({ page }) => {
    await openPdf(page, 'three-pages.pdf');

    await page
      .getByTestId('pdf-page')
      .first()
      .dblclick({ position: { x: 160, y: 220 } });
    await page.keyboard.type('Draft text');
    await page.getByTestId('pdf-status-page').click();
    await expect(page.getByTestId('pdf-text-object')).toHaveText('Draft text');

    // Autosave debounce is 1.5s
    await page.waitForTimeout(2200);
    await page.reload();

    await expect(page.getByTestId('pdf-draft-prompt')).toBeVisible();
    await page.getByTestId('pdf-draft-resume').click();

    await expect(page.getByTestId('pdf-ribbon')).toBeVisible();
    await expect(page.getByTestId('pdf-text-object')).toHaveText('Draft text');
    await expect(page.getByTestId('pdf-banner')).toContainText('已恢复上次编辑的内容');
  });

  test('丢弃草稿后不再提示', async ({ page }) => {
    await openPdf(page, 'three-pages.pdf');
    await page
      .getByTestId('pdf-page')
      .first()
      .dblclick({ position: { x: 160, y: 220 } });
    await page.keyboard.type('Throw away');
    await page.getByTestId('pdf-status-page').click();
    await page.waitForTimeout(2200);

    await page.reload();
    await page.getByTestId('pdf-draft-discard').click();
    await expect(page.getByTestId('pdf-draft-prompt')).toHaveCount(0);

    await page.reload();
    await expect(page.getByTestId('pdf-draft-prompt')).toHaveCount(0);
  });

  test('加密 PDF：错误密码可重试，正确密码后打开', async ({ page }) => {
    await page.goto('/tools/pdf-editor');
    await page.locator('input[type="file"]').setInputFiles(fixture('encrypted.pdf'));

    const password = page.getByLabel('PDF 密码');
    await expect(password).toBeVisible();

    await password.fill('wrong');
    await page.getByRole('button', { name: '解锁' }).click();
    await expect(page.getByText('密码错误，请重试')).toBeVisible();
    // The typed value survives the failed attempt
    await expect(password).toHaveValue('wrong');

    await password.fill('syntools');
    await page.getByRole('button', { name: '解锁' }).click();
    await expect(page.getByTestId('pdf-ribbon')).toBeVisible();
    await expect(page.getByTestId('pdf-status-page')).toHaveText('第 1 / 1 页');
  });
});
