import { readFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { expect, test, type Page } from '@playwright/test';
import { PDFDocument } from '@cantoo/pdf-lib';

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

test.describe('PDF 编辑器（M2-9 / M3-6）', () => {
  test('矩形与画笔都能保存', async ({ page }) => {
    await openPdf(page, 'three-pages.pdf');
    await page.getByRole('tab', { name: '注释' }).click();

    const overlay = page.getByTestId('pdf-overlay').first();
    const box = await overlay.boundingBox();
    expect(box).not.toBeNull();
    if (!box) return;

    // Rectangle: drag once and expect a shape object
    await page.getByTestId('ribbon-shapes-rect').click();
    await page.mouse.move(box.x + 60, box.y + 60);
    await page.mouse.down();
    await page.mouse.move(box.x + 200, box.y + 150, { steps: 4 });
    await page.mouse.up();
    await expect(page.getByTestId('pdf-object').first()).toHaveAttribute('data-kind', 'shape');

    // Selecting the shape switched the ribbon to its contextual tab; go back to 注释 for the pen
    await page.getByTestId('ribbon-tab-annotate').click();
    await page.getByTestId('ribbon-ink-ink').click();
    await page.mouse.move(box.x + 260, box.y + 60);
    await page.mouse.down();
    await page.mouse.move(box.x + 310, box.y + 100, { steps: 3 });
    await page.mouse.move(box.x + 360, box.y + 60, { steps: 3 });
    await page.mouse.up();
    await expect(page.locator('[data-testid="pdf-object"][data-kind="ink"]')).toHaveCount(1);

    const downloadPromise = page.waitForEvent('download');
    await page.keyboard.press('Control+s');
    expect((await downloadPromise).suggestedFilename()).toBe('three-pages-edited.pdf');
  });

  test('点选原文本行可修补并保存', async ({ page }) => {
    await openPdf(page, 'three-pages.pdf');
    await page.getByRole('tab', { name: '注释' }).click();
    await page.getByTestId('ribbon-insert-patch').click();

    const hint = page.getByTestId('pdf-patch-hint');
    if (await hint.isVisible().catch(() => false)) {
      await page.getByTestId('pdf-patch-hint-dismiss').click();
    }

    const line = page.getByTestId('pdf-text-line').first();
    await expect(line).toBeVisible();
    const lineBox = await line.boundingBox();
    expect(lineBox).not.toBeNull();
    if (!lineBox) return;

    // Text lines are pointer-events-none; the click must land on the layer at the same spot
    await page.mouse.click(lineBox.x + lineBox.width / 2, lineBox.y + lineBox.height / 2);

    const input = page.getByTestId('pdf-text-input');
    await expect(input).toBeVisible();
    await input.fill('E2E 修补');
    await input.press('Escape');

    await expect(page.getByTestId('pdf-text-object')).toHaveCount(1);

    const downloadPromise = page.waitForEvent('download');
    await page.keyboard.press('Control+s');
    expect((await downloadPromise).suggestedFilename()).toBe('three-pages-edited.pdf');
  });

  test('手写签名落到页面上', async ({ page }) => {
    await openPdf(page, 'three-pages.pdf');
    await page.getByRole('tab', { name: '注释' }).click();
    await page.getByTestId('ribbon-insert-signature').click();

    const canvas = page.getByTestId('pdf-signature-canvas');
    await expect(canvas).toBeVisible();
    const box = await canvas.boundingBox();
    expect(box).not.toBeNull();
    if (!box) return;

    await page.mouse.move(box.x + 40, box.y + box.height / 2);
    await page.mouse.down();
    await page.mouse.move(box.x + 90, box.y + box.height / 2 - 30, { steps: 4 });
    await page.mouse.move(box.x + 140, box.y + box.height / 2 + 10, { steps: 4 });
    await page.mouse.up();
    await page.getByTestId('pdf-signature-apply').click();

    await expect(page.getByTestId('pdf-object').first()).toHaveAttribute('data-kind', 'signature');

    const downloadPromise = page.waitForEvent('download');
    await page.keyboard.press('Control+s');
    expect((await downloadPromise).suggestedFilename()).toBe('three-pages-edited.pdf');
  });

  test('旋转 90° + 非零 CropBox 的页面文本可命中', async ({ page }) => {
    await openPdf(page, 'rotated-cropbox.pdf');
    await page.getByTestId('ribbon-tab-annotate').click();
    await page.getByTestId('ribbon-insert-patch').click();

    const hint = page.getByTestId('pdf-patch-hint');
    if (await hint.isVisible().catch(() => false)) {
      await page.getByTestId('pdf-patch-hint-dismiss').click();
    }

    const line = page.getByTestId('pdf-text-line').first();
    await expect(line).toBeVisible();
    const lineBox = await line.boundingBox();
    expect(lineBox).not.toBeNull();
    if (!lineBox) return;

    await page.mouse.click(lineBox.x + lineBox.width / 2, lineBox.y + lineBox.height / 2);
    const input = page.getByTestId('pdf-text-input');
    await expect(input).toBeVisible();
    await input.fill('Rotated patch');
    await input.press('Escape');
    await expect(page.getByTestId('pdf-text-object')).toHaveCount(1);
  });

  test('删除一页后保存，下载文件只剩两页', async ({ page }) => {
    await openPdf(page, 'three-pages.pdf');
    await page.getByRole('tab', { name: '视图' }).click();
    await page.getByTestId('ribbon-panels-thumbnails').click();
    await expect(page.getByTestId('pdf-page-toolbar')).toBeVisible();

    await page.getByTestId('pdf-page-delete').click();
    await expect(page.getByTestId('pdf-status-page')).toHaveText(/\/ 2 页/);

    const downloadPromise = page.waitForEvent('download');
    await page.keyboard.press('Control+s');
    const download = await downloadPromise;
    const path = await download.path();
    expect(path).not.toBeNull();
    if (!path) return;

    const bytes = await readFile(path);
    const saved = await PDFDocument.load(bytes);
    expect(saved.getPageCount()).toBe(2);
  });
});

test.describe('PDF 编辑器（保存入口与吸顶）', () => {
  test('头部保存按钮直接下载 PDF', async ({ page }) => {
    await openPdf(page, 'three-pages.pdf');
    const button = page.getByTestId('pdf-save-button');
    await expect(button).toBeVisible();
    await expect(button).toHaveText('保存 PDF');

    const downloadPromise = page.waitForEvent('download');
    await button.click();
    expect((await downloadPromise).suggestedFilename()).toBe('three-pages-edited.pdf');
  });

  test('左侧 ⋯ 菜单提供打开/插入/保存/导出', async ({ page }) => {
    await openPdf(page, 'three-pages.pdf');

    await expect(page.getByTestId('pdf-qat-undo')).toBeVisible();
    await expect(page.getByTestId('pdf-qat-redo')).toBeVisible();
    await page.getByTestId('pdf-file-menu').click();

    const menu = page.getByRole('menu');
    await expect(menu).toBeVisible();
    await expect(menu.getByRole('menuitem')).toHaveCount(6);
    await expect(menu.getByRole('menuitem', { name: '保存' })).toBeVisible();
    await expect(menu.getByRole('menuitem', { name: '导出 Word' })).toBeVisible();

    const downloadPromise = page.waitForEvent('download');
    await menu.getByRole('menuitem', { name: '保存' }).click();
    expect((await downloadPromise).suggestedFilename()).toBe('three-pages-edited.pdf');
  });

  test('滚动到第 3 页时功能区仍固定在顶部', async ({ page }) => {
    await openPdf(page, 'three-pages.pdf');

    const topBefore = await page
      .getByTestId('pdf-ribbon')
      .evaluate((element) => element.getBoundingClientRect().top);
    await page.evaluate(() => window.scrollTo(0, 1200));
    const topAfter = await page
      .getByTestId('pdf-ribbon')
      .evaluate((element) => element.getBoundingClientRect().top);

    // The app header is h-14 (56px); the ribbon sticks right below it instead of scrolling away
    expect(Math.abs(topAfter - 56)).toBeLessThanOrEqual(1);
    expect(topAfter).toBeLessThanOrEqual(topBefore);
    await expect(page.getByTestId('pdf-save-button')).toBeVisible();
    await expect(page.getByTestId('pdf-qat-undo')).toBeVisible();
  });
});
