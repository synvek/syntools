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

/** Ribbon tabs: the home tab is active on open, everything document-editing lives there */
async function openTab(page: Page, name: '注释' | '编辑' | '视图'): Promise<void> {
  const tab = page.getByRole('tab', { name });
  if (await tab.isVisible().catch(() => false)) await tab.click();
  else await page.getByRole('tab', { name: '开始' }).click();
}

/**
 * Create a text box by dragging the text tool.
 *
 * Since the text tool replaced "double-click on empty paper", creation is always a drag: the tool
 * arms, the drag defines the box, and the textarea opens immediately.
 */
async function createTextBox(page: Page, text: string): Promise<void> {
  await openTab(page, '注释');
  await page.getByTestId('ribbon-insert-text').click();
  const overlay = page.getByTestId('pdf-overlay').first();
  const box = await overlay.boundingBox();
  if (!box) throw new Error('PDF overlay is not visible');
  await page.mouse.move(box.x + 60, box.y + 100);
  await page.mouse.down();
  await page.mouse.move(box.x + 260, box.y + 150, { steps: 4 });
  await page.mouse.up();
  await expect(page.getByTestId('pdf-text-input')).toBeVisible();
  await page.keyboard.type(text);
  await page.getByTestId('pdf-status-page').click();
  await expect(page.getByTestId('pdf-text-object').first()).toContainText(text);
  // Text tool stays armed after a commit (Acrobat behaviour); back to select for the next step
  await page.keyboard.press('Escape');
}

/**
 * ⇧⌘S exports the flattened PDF for delivery.
 *
 * ⌘S saves the editable `.pdfproj` instead — a flat PDF bakes every object into the page, so it can
 * no longer be moved or restyled after saving.
 */
async function exportFlatPdf(page: Page): Promise<void> {
  await page.keyboard.press('Control+Shift+s');
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

    await openTab(page, '视图');
    await page.getByTestId('ribbon-navigate-next').click();
    await expect(page.getByTestId('pdf-status-page')).toHaveText('第 2 / 3 页');

    // Home/End act on the document only when focus is outside the ribbon tablist: inside it those
    // keys move between tabs (WAI-ARIA), and the click above leaves focus on the paging button
    await page.keyboard.press('End');
    await expect(page.getByTestId('pdf-status-page')).toHaveText('第 3 / 3 页');
    await expect(page.getByTestId('ribbon-navigate-next')).toBeDisabled();

    await page.keyboard.press('Home');
    await expect(page.getByTestId('pdf-status-page')).toHaveText('第 1 / 3 页');
    await expect(page.getByTestId('ribbon-navigate-prev')).toBeDisabled();
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

  test('拖拽文本工具插入文本框并保存工程', async ({ page }) => {
    await openPdf(page, 'three-pages.pdf');

    await createTextBox(page, 'Hello');
    await expect(page.getByTestId('pdf-save-status')).toHaveAttribute('data-state', 'dirty');

    const downloadPromise = page.waitForEvent('download');
    // ⌘S writes the editable project; the flattened PDF moved to ⇧⌘S
    await page.keyboard.press('Control+s');
    const download = await downloadPromise;

    expect(download.suggestedFilename()).toBe('three-pages.pdfproj');
    await expect(page.getByTestId('pdf-save-status')).toHaveAttribute('data-state', 'saved');
  });

  test('未保存的编辑会存成本地草稿，刷新后可恢复', async ({ page }) => {
    await openPdf(page, 'three-pages.pdf');

    await createTextBox(page, 'Draft text');

    // Autosave debounce is 1.5s
    await page.waitForTimeout(2200);
    await page.reload();

    await expect(page.getByTestId('pdf-draft-prompt')).toBeVisible();
    await page.getByTestId('pdf-draft-resume').click();

    await expect(page.getByTestId('pdf-ribbon')).toBeVisible();
    await expect(page.getByTestId('pdf-text-object')).toHaveText('Draft text');
    await expect(page.getByTestId('pdf-banner')).toContainText('已恢复上次编辑的内容');

    // The restore notice explains why the page already has content; it stays until dismissed
    await page.getByTestId('pdf-banner-dismiss').click();
    await expect(page.getByTestId('pdf-banner')).toHaveCount(0);
  });

  test('丢弃草稿后不再提示', async ({ page }) => {
    await openPdf(page, 'three-pages.pdf');
    await createTextBox(page, 'Throw away');
    await page.waitForTimeout(2200);

    await page.reload();
    await page.getByTestId('pdf-draft-discard').click();
    await expect(page.getByTestId('pdf-draft-prompt')).toHaveCount(0);

    await page.reload();
    await expect(page.getByTestId('pdf-draft-prompt')).toHaveCount(0);
  });

  test('有未保存修改时，站内跳转会先确认', async ({ page }) => {
    await openPdf(page, 'three-pages.pdf');
    await createTextBox(page, 'Unsaved');

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
    await exportFlatPdf(page);
    expect((await downloadPromise).suggestedFilename()).toBe('three-pages-edited.pdf');
  });

  test('插入图片后可保存', async ({ page }) => {
    await openPdf(page, 'three-pages.pdf');
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
    await exportFlatPdf(page);
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

    // Only images get a contextual tab; a selected shape keeps `开始` active, so the pen is one click away
    await page.getByTestId('ribbon-ink-ink').click();
    await page.mouse.move(box.x + 260, box.y + 60);
    await page.mouse.down();
    await page.mouse.move(box.x + 310, box.y + 100, { steps: 3 });
    await page.mouse.move(box.x + 360, box.y + 60, { steps: 3 });
    await page.mouse.up();
    await expect(page.locator('[data-testid="pdf-object"][data-kind="ink"]')).toHaveCount(1);

    const downloadPromise = page.waitForEvent('download');
    await exportFlatPdf(page);
    expect((await downloadPromise).suggestedFilename()).toBe('three-pages-edited.pdf');
  });

  test('点选原文本行可修补并保存', async ({ page }) => {
    await openPdf(page, 'three-pages.pdf');
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
    await exportFlatPdf(page);
    expect((await downloadPromise).suggestedFilename()).toBe('three-pages-edited.pdf');
  });

  test('手写签名落到页面上', async ({ page }) => {
    await openPdf(page, 'three-pages.pdf');
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
    await exportFlatPdf(page);
    expect((await downloadPromise).suggestedFilename()).toBe('three-pages-edited.pdf');
  });

  test('旋转 90° + 非零 CropBox 的页面文本可命中', async ({ page }) => {
    await openPdf(page, 'rotated-cropbox.pdf');
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

  test('从文件插入的页用附件自身的内容渲染', async ({ page }) => {
    await openPdf(page, 'three-pages.pdf');
    await page.getByRole('tab', { name: '视图' }).click();
    await page.getByTestId('ribbon-panels-thumbnails').click();

    await page.getByTestId('pdf-page-insert-from-file').click();
    await expect(page.getByTestId('pdf-insert-pages-dialog')).toBeVisible();
    await page.getByTestId('pdf-insert-pages-file').setInputFiles(fixture('scanned-no-text.pdf'));
    await page.getByTestId('pdf-insert-pages-confirm').click();

    // Inserting selects the new page
    await expect(page.getByTestId('pdf-status-page')).toHaveText(/\/ 4 页/);
    const label = (await page.getByTestId('pdf-status-page').textContent()) ?? '';
    const pageNumber = Number(/第 (\d+)/.exec(label)?.[1] ?? '0');
    expect(pageNumber).toBeGreaterThan(1);

    // The inserted page must render its own scan (beige paper), not the main file's white page.
    // Poll instead of reading once: the attachment proxy attaches a beat after the page mounts, so a
    // single read can catch the white paint that precedes it.
    const holder = page
      .locator(`[data-testid="pdf-page"][data-page="${pageNumber}"]`)
      .getByTestId('pdf-page-canvas');
    await expect(holder).toHaveAttribute('data-rendered', 'true');
    await expect
      .poll(
        async () =>
          holder.locator('canvas').evaluate((element) => {
            const context = (element as HTMLCanvasElement).getContext('2d');
            return context ? context.getImageData(4, 4, 1, 1).data[0] : 255;
          }),
        { timeout: 8000 },
      )
      .toBeLessThan(252);
  });

  test('删除一页后保存，下载文件只剩两页', async ({ page }) => {
    await openPdf(page, 'three-pages.pdf');
    await page.getByRole('tab', { name: '视图' }).click();
    await page.getByTestId('ribbon-panels-thumbnails').click();
    await expect(page.getByTestId('pdf-page-toolbar')).toBeVisible();

    await page.getByTestId('pdf-page-delete').click();
    await expect(page.getByTestId('pdf-status-page')).toHaveText(/\/ 2 页/);

    const downloadPromise = page.waitForEvent('download');
    await exportFlatPdf(page);
    const download = await downloadPromise;
    const path = await download.path();
    expect(path).not.toBeNull();
    if (!path) return;

    const bytes = await readFile(path);
    const saved = await PDFDocument.load(bytes);
    expect(saved.getPageCount()).toBe(2);
  });
});

test.describe('PDF 编辑器（P1-A 页面装饰）', () => {
  test('页码与页眉实时预览，应用后可保存', async ({ page }) => {
    await openPdf(page, 'three-pages.pdf');

    await page.getByTestId('ribbon-decorate-decoration').click();
    await expect(page.getByTestId('pdf-decoration-dialog')).toBeVisible();

    await page.getByTestId('pdf-decoration-numbers').check();
    await page.getByTestId('pdf-decoration-number-format').fill('第 {n} / {total} 页');
    await page.getByTestId('pdf-decoration-header').fill('SynTools');
    await page.getByTestId('pdf-decoration-watermark').fill('DRAFT');
    await page.getByTestId('pdf-decoration-watermark-tiled').check();
    await page.getByTestId('pdf-decoration-apply').click();

    await expect(page.getByTestId('pdf-decoration-dialog')).toHaveCount(0);
    // Live preview on every page box
    await expect(page.getByTestId('pdf-decoration-number').first()).toHaveText('第 1 / 3 页');
    await expect(page.getByTestId('pdf-decoration-layer').first()).toContainText('SynTools');
    await expect(page.getByTestId('pdf-decoration-layer').first()).toContainText('DRAFT');

    const downloadPromise = page.waitForEvent('download');
    await exportFlatPdf(page);
    expect((await downloadPromise).suggestedFilename()).toBe('three-pages-edited.pdf');
  });

  test('清除装饰后预览消失', async ({ page }) => {
    await openPdf(page, 'three-pages.pdf');
    await page.getByTestId('ribbon-decorate-decoration').click();
    await page.getByTestId('pdf-decoration-numbers').check();
    await page.getByTestId('pdf-decoration-apply').click();
    await expect(page.getByTestId('pdf-decoration-number')).toHaveCount(3);

    await page.getByTestId('ribbon-decorate-decoration').click();
    await expect(page.getByTestId('pdf-decoration-numbers')).toBeChecked();
    await page.getByTestId('pdf-decoration-clear').click();

    await expect(page.getByTestId('pdf-decoration-number')).toHaveCount(0);
    await expect(page.getByTestId('pdf-decoration-layer')).toHaveCount(0);
  });
});

test.describe('PDF 编辑器（保存入口与吸顶）', () => {
  test('头部保存按钮保存工程文件', async ({ page }) => {
    await openPdf(page, 'three-pages.pdf');
    const button = page.getByTestId('pdf-save-button');
    await expect(button).toBeVisible();
    // The default save keeps the document editable; a flat PDF is the explicit "deliver" command
    await expect(button).toHaveText('保存工程');

    const downloadPromise = page.waitForEvent('download');
    await button.click();
    expect((await downloadPromise).suggestedFilename()).toBe('three-pages.pdfproj');
  });

  test('左侧 ⋯ 菜单提供打开/插入/保存工程/扁平导出/导出', async ({ page }) => {
    await openPdf(page, 'three-pages.pdf');

    await expect(page.getByTestId('pdf-qat-undo')).toBeVisible();
    await expect(page.getByTestId('pdf-qat-redo')).toBeVisible();
    await page.getByTestId('pdf-file-menu').click();

    const menu = page.getByRole('menu');
    await expect(menu).toBeVisible();
    await expect(menu.getByRole('menuitem')).toHaveCount(7);
    await expect(menu.getByRole('menuitem', { name: '保存工程' })).toBeVisible();
    await expect(menu.getByRole('menuitem', { name: '另存为 PDF（扁平）' })).toBeVisible();
    await expect(menu.getByRole('menuitem', { name: '导出 Word' })).toBeVisible();

    const projectPromise = page.waitForEvent('download');
    await menu.getByRole('menuitem', { name: '保存工程' }).click();
    expect((await projectPromise).suggestedFilename()).toBe('three-pages.pdfproj');

    // Selecting a menu item closes the menu, so re-open it for the second command
    await page.getByTestId('pdf-file-menu').click();
    const flatPromise = page.waitForEvent('download');
    await page.getByRole('menu').getByRole('menuitem', { name: '另存为 PDF（扁平）' }).click();
    expect((await flatPromise).suggestedFilename()).toBe('three-pages-edited.pdf');
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

/**
 * The point of `.pdfproj`: saving must not end editing.
 *
 * A flattened PDF paints every object into the page content stream, so shapes and text boxes come
 * back as pixels. This suite saves the project, reopens it in the same editor and checks that the
 * objects are model objects again — then proves they are still live by nudging one.
 */
test.describe('PDF 编辑器（工程文件可继续编辑）', () => {
  test('保存工程后重新打开，文本框与矩形仍可编辑', async ({ page }) => {
    await openPdf(page, 'three-pages.pdf');
    await createTextBox(page, 'Keep me');

    const overlay = page.getByTestId('pdf-overlay').first();
    const box = await overlay.boundingBox();
    if (!box) throw new Error('PDF overlay is not visible');
    await page.getByTestId('ribbon-shapes-rect').click();
    await page.mouse.move(box.x + 300, box.y + 300);
    await page.mouse.down();
    await page.mouse.move(box.x + 430, box.y + 390, { steps: 4 });
    await page.mouse.up();
    await expect(page.locator('[data-testid="pdf-object"][data-kind="shape"]')).toHaveCount(1);
    await page.keyboard.press('Escape');

    const downloadPromise = page.waitForEvent('download');
    await page.keyboard.press('Control+s');
    const download = await downloadPromise;
    expect(download.suggestedFilename()).toBe('three-pages.pdfproj');
    const path = await download.path();
    if (!path) throw new Error('project download has no path');
    const projectBytes = await readFile(path);
    await expect(page.getByTestId('pdf-save-status')).toHaveAttribute('data-state', 'saved');

    // Re-open the saved project: the objects come back as objects, not as baked pixels.
    // Playwright's temp download path has no extension, so the name is restored explicitly —
    // `.pdfproj` is what routes the file to the project reader.
    await page.getByTestId('pdf-open-input').setInputFiles({
      name: 'three-pages.pdfproj',
      mimeType: 'application/zip',
      buffer: projectBytes,
    });
    await expect(page.getByTestId('pdf-text-object')).toHaveText('Keep me');
    await expect(page.locator('[data-testid="pdf-object"][data-kind="shape"]')).toHaveCount(1);
    await expect(page.getByTestId('pdf-status-page')).toHaveText('第 1 / 3 页');
    // Saved revision travelled with the file: a reopened project starts clean
    await expect(page.getByTestId('pdf-save-status')).toHaveAttribute('data-state', 'saved');

    await expect(page.getByTestId('pdf-banner')).toContainText('已打开工程文件');
    await page.getByTestId('pdf-banner-dismiss').click();
    await expect(page.getByTestId('pdf-banner')).toHaveCount(0);

    // Still editable: selecting the text box and nudging it dirties the document again
    await page.getByTestId('pdf-text-object').first().click();
    await page.keyboard.press('ArrowRight');
    await expect(page.getByTestId('pdf-save-status')).toHaveAttribute('data-state', 'dirty');
  });
});
