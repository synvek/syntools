import { fileURLToPath } from 'node:url';
import { expect, test, type Page } from '@playwright/test';

// Tool copy follows the UI locale; assertions rely on Simplified Chinese
test.use({ locale: 'zh-CN', viewport: { width: 1440, height: 900 } });

const fixture = (name: string) =>
  fileURLToPath(new URL(`../fixtures/pdf/${name}`, import.meta.url));

async function openPdf(page: Page, name: string): Promise<void> {
  await page.goto('/tools/pdf-editor');
  await page.locator('input[type="file"]').first().setInputFiles(fixture(name));
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

    await page
      .locator('input[type="file"]')
      .first()
      .setInputFiles({
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

  test('有未保存修改时，站内跳转会先确认', async ({ page }) => {
    await openPdf(page, 'three-pages.pdf');
    await page
      .getByTestId('pdf-page')
      .first()
      .dblclick({ position: { x: 160, y: 220 } });
    await page.keyboard.type('Unsaved');
    await page.getByTestId('pdf-status-page').click();

    const homeLink = page.locator('header a[href="/"]').first();

    await homeLink.click();
    await expect(page.getByTestId('pdf-leave-guard')).toBeVisible();
    await page.getByTestId('pdf-leave-stay').click();
    await expect(page.getByTestId('pdf-leave-guard')).toHaveCount(0);
    await expect(page.getByTestId('pdf-ribbon')).toBeVisible();

    await homeLink.click();
    await expect(page.getByTestId('pdf-leave-guard')).toBeVisible();
    await page.getByTestId('pdf-leave-confirm').click();
    await expect(page).toHaveURL(/\/$/);
  });

  test('加密 PDF：错误密码可重试，正确密码后打开', async ({ page }) => {
    await page.goto('/tools/pdf-editor');
    await page.locator('input[type="file"]').first().setInputFiles(fixture('encrypted.pdf'));

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

/**
 * M3/M4 smoke: annotation baking, Word and image export.
 *
 * These exercise the same paths the component tests cover, but through pdf-lib/pdfjs in a real
 * browser — the only place canvas-based rasterisation and `docx` packaging can actually be observed.
 */
test.describe('PDF 编辑器（M3/M4）', () => {
  test('高亮注释可保存下载', async ({ page }) => {
    await openPdf(page, 'three-pages.pdf');

    await page.getByRole('tab', { name: '注释' }).click();
    await page.getByTestId('ribbon-markup-highlight').click();

    const overlay = page.getByTestId('pdf-overlay').first();
    const box = await overlay.boundingBox();
    expect(box).not.toBeNull();
    if (!box) return;

    await page.mouse.move(box.x + 40, box.y + 80);
    await page.mouse.down();
    await page.mouse.move(box.x + 160, box.y + 120, { steps: 5 });
    await page.mouse.up();

    await expect(page.getByTestId('pdf-object').first()).toHaveAttribute('data-kind', 'markup');

    const downloadPromise = page.waitForEvent('download');
    await page.keyboard.press('Control+s');
    expect((await downloadPromise).suggestedFilename()).toBe('three-pages-edited.pdf');
  });

  test('插入图片后可保存', async ({ page }) => {
    await openPdf(page, 'three-pages.pdf');
    await page.getByRole('tab', { name: '注释' }).click();

    const chooserPromise = page.waitForEvent('filechooser');
    await page.getByTestId('ribbon-insert-image').click();
    const chooser = await chooserPromise;
    await chooser.setFiles({
      name: 'dot.png',
      mimeType: 'image/png',
      buffer: Buffer.from(
        'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==',
        'base64',
      ),
    });

    await expect(page.getByTestId('pdf-object').first()).toHaveAttribute('data-kind', 'image');

    const downloadPromise = page.waitForEvent('download');
    await page.keyboard.press('Control+s');
    expect((await downloadPromise).suggestedFilename()).toBe('three-pages-edited.pdf');
  });

  test('导出 Word（混合模式）下载 .docx', async ({ page }) => {
    await openPdf(page, 'three-pages.pdf');

    await page.getByTestId('ribbon-export-docx').click();
    await expect(page.getByTestId('pdf-export-docx-dialog')).toBeVisible();

    const downloadPromise = page.waitForEvent('download');
    await page.getByTestId('pdf-export-confirm').click();
    expect((await downloadPromise).suggestedFilename()).toBe('three-pages.docx');
  });

  test('导出单页 PNG', async ({ page }) => {
    await openPdf(page, 'three-pages.pdf');

    await page.getByTestId('ribbon-export-images').click();
    await page.getByTestId('pdf-image-pages').fill('1');
    await page.getByTestId('pdf-image-dpi').selectOption('96');

    const downloadPromise = page.waitForEvent('download');
    await page.getByTestId('pdf-image-confirm').click();
    expect((await downloadPromise).suggestedFilename()).toBe('three-pages.png');
  });
});
