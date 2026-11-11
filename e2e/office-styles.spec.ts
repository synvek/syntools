import { expect, test, type Page, type Locator } from '@playwright/test';

// Assertions rely on Simplified Chinese copy (the UI follows the browser locale)
test.use({ locale: 'zh-CN', viewport: { width: 1440, height: 900 } });

/**
 * Named styles (plan P1-1, first slice).
 *
 * The rules live in `namedStyles.test.ts`; this covers what jsdom cannot: a style edit repaints every
 * block that uses it (the document is never rewritten), the rename is persisted, and a refresh keeps
 * both the style set and the blocks that point at it.
 */

async function openRichText(page: Page): Promise<void> {
  await page.goto('/tools/rich-text-editor');
  await expect(page.locator('.tiptap')).toBeVisible();
}

/** The gallery dismisses on an outside pointer-down, so clicking in the document closes it: reopen on demand */
async function ensureGallery(page: Page): Promise<Locator> {
  const gallery = page.getByTestId('rich-text-style-gallery');
  if (!(await gallery.isVisible())) {
    await page.getByRole('button', { name: '样式', exact: true }).click();
    await expect(gallery).toBeVisible();
  }
  return gallery;
}

test('rich text: editing 标题 1 updates every heading that uses it, and the change survives a reload', async ({
  page,
}) => {
  await openRichText(page);
  const errors: string[] = [];
  page.on('pageerror', (error) => errors.push(String(error)));

  await page.locator('.tiptap').click();
  await page.keyboard.type('第一章');
  await page.keyboard.press('Enter');
  await page.keyboard.type('正文内容');

  // Style the first paragraph as 标题 1
  await page.locator('.tiptap p').first().click();
  let gallery = await ensureGallery(page);
  await gallery.locator('[data-style-id="title"]').click();
  const heading = page.locator('.tiptap h1').first();
  await expect(heading).toHaveText('第一章');
  await expect(heading).toHaveAttribute('data-rte-style', 'title');

  // A second paragraph using the same style
  await page.locator('.tiptap p').last().click();
  await page.keyboard.press('ControlOrMeta+End');
  await page.keyboard.press('Enter');
  await page.keyboard.type('第二章');
  gallery = await ensureGallery(page);
  await gallery.locator('[data-style-id="title"]').click();
  await expect(page.locator('.tiptap h1')).toHaveCount(2);

  // One edit of the style object repaints both headings: the document itself is untouched (P1-1 acceptance)
  gallery = await ensureGallery(page);
  const size = gallery.getByTestId('style-size');
  await size.fill('30');
  // 30pt at 96dpi
  await expect(page.locator('.tiptap h1').first()).toHaveCSS('font-size', '40px');
  await expect(page.locator('.tiptap h1').last()).toHaveCSS('font-size', '40px');

  // Rename the style: the gallery entry follows immediately
  const name = gallery.getByTestId('style-name');
  await name.fill('我的标题');
  await expect(gallery.locator('[data-style-id="title"]')).toHaveText('我的标题');

  // Both the style set and the blocks that use it come back after a refresh
  await page.reload();
  await expect(page.locator('.tiptap')).toBeVisible();
  await expect(page.locator('.tiptap h1').first()).toHaveAttribute('data-rte-style', 'title');
  await expect(page.locator('.tiptap h1').first()).toHaveCSS('font-size', '40px');
  // The pane follows the caret, so put it in a styled heading before reading the style back
  await page.locator('.tiptap h1').first().click();
  const reopened = await ensureGallery(page);
  await expect(reopened.locator('[data-style-id="title"]')).toHaveText('我的标题');
  await expect(reopened.getByTestId('style-editor-title')).toHaveText('我的标题');
  await expect(reopened.getByTestId('style-size')).toHaveValue('30');

  expect(errors).toEqual([]);
});

test('rich text: built-in styles cannot be deleted, custom ones can', async ({ page }) => {
  await openRichText(page);
  await page.locator('.tiptap').click();
  await page.keyboard.type('段落');

  const gallery = await ensureGallery(page);
  await expect(gallery.getByTestId('style-delete')).toBeDisabled();

  await gallery.getByTestId('style-new').click();
  await expect(gallery.locator('[data-style-id="custom-1"]')).toHaveText('新建样式');
  // Applying the new style makes it the one being edited; it inherits from the previous style
  await gallery.locator('[data-style-id="custom-1"]').click();
  await expect(gallery.getByTestId('style-based-on')).toHaveValue('body');
  await expect(gallery.getByTestId('style-delete')).toBeEnabled();

  await gallery.getByTestId('style-delete').click();
  await expect(gallery.locator('[data-style-id="custom-1"]')).toHaveCount(0);
  await expect(page.locator('.tiptap')).toBeVisible();
});

test('rich text: a .docx round trip keeps the named style and the heading', async ({ page }) => {
  await openRichText(page);
  await page.locator('.tiptap').click();
  await page.keyboard.type('第一章');

  let gallery = await ensureGallery(page);
  await gallery.locator('[data-style-id="title"]').click();
  await gallery.getByTestId('style-size').fill('30');
  await gallery.getByTestId('style-name').fill('章节标题');
  await expect(page.locator('.tiptap h1').first()).toHaveCSS('font-size', '40px');

  // Export through the ⋯ menu: w:styles + w:pStyle carry the whole set into the file
  const [download] = await Promise.all([
    page.waitForEvent('download'),
    (async () => {
      await page.getByTestId('menubar-more').click();
      await page.getByRole('menuitem', { name: '导出 Word (.docx)' }).click();
    })(),
  ]);
  // `download.path()` has no `.docx` suffix, which the import guard rejects: save it under the real name
  const file = test.info().outputPath('roundtrip.docx');
  await download.saveAs(file);

  // Rename locally first: after the import the name can only come from the file
  gallery = await ensureGallery(page);
  await gallery.getByTestId('style-name').fill('旧名称');
  await expect(gallery.locator('[data-style-id="title"]')).toHaveText('旧名称');

  await page.getByTestId('rich-text-import-input').setInputFiles(file);

  const heading = page.locator('.tiptap h1').first();
  await expect(heading).toHaveText('第一章');
  await expect(heading).toHaveAttribute('data-rte-style', 'title');
  // The imported definition is what paints it, so the size came back from the .docx and not the defaults
  await expect(heading).toHaveCSS('font-size', '40px');

  await heading.click();
  gallery = await ensureGallery(page);
  await expect(gallery.locator('[data-style-id="title"]')).toHaveText('章节标题');
  await expect(gallery.getByTestId('style-size')).toHaveValue('30');
});
