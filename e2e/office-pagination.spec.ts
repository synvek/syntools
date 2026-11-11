import { expect, test, type Page } from '@playwright/test';

// Assertions rely on Simplified Chinese copy (the UI follows the browser locale)
test.use({ locale: 'zh-CN', viewport: { width: 1440, height: 900 } });

/**
 * Pagination control (plan P1-4, first slice): 段中不分页 / 段内不拆页 / 孤行控制.
 *
 * The flags are `w:pPr` toggles. Mammoth drops that part of the document on import, so the round trip
 * is the interesting case: ribbon → `data-*` → `w:keepNext` → back to the same attribute.
 */

async function openRichText(page: Page): Promise<void> {
  await page.goto('/tools/rich-text-editor');
  await expect(page.locator('.tiptap')).toBeVisible();
  await page.locator('.tiptap').click();
}

test('rich text: pagination flags reach .docx and come back on import', async ({ page }) => {
  await openRichText(page);
  const errors: string[] = [];
  page.on('pageerror', (error) => errors.push(String(error)));

  await page.keyboard.type('第一段');
  await page.keyboard.press('Enter');
  await page.keyboard.type('第二段');

  // Turn the flags on for the first paragraph only
  await page.locator('.tiptap p').first().click();
  await page.getByRole('button', { name: '段中不分页', exact: true }).click();
  await page.getByRole('button', { name: '段内不拆页', exact: true }).click();
  await page.getByRole('button', { name: '孤行控制', exact: true }).click();

  const first = page.locator('.tiptap p').first();
  await expect(first).toHaveAttribute('data-keep-next', 'true');
  await expect(first).toHaveAttribute('data-keep-lines', 'true');
  await expect(first).toHaveAttribute('data-widow-control', 'off');
  // The second paragraph keeps the defaults
  await expect(page.locator('.tiptap p').last()).not.toHaveAttribute('data-keep-next', 'true');

  const [download] = await Promise.all([
    page.waitForEvent('download'),
    (async () => {
      await page.getByTestId('menubar-more').click();
      await page.getByRole('menuitem', { name: '导出 Word (.docx)' }).click();
    })(),
  ]);
  const file = test.info().outputPath('pagination.docx');
  await download.saveAs(file);

  // Clear the flags locally, then import: they can only come back from the file
  await page.getByRole('button', { name: '段中不分页', exact: true }).click();
  await expect(first).not.toHaveAttribute('data-keep-next', 'true');

  await page.getByTestId('rich-text-import-input').setInputFiles(file);
  await expect(page.locator('.tiptap p').first()).toHaveAttribute('data-keep-next', 'true');
  await expect(page.locator('.tiptap p').first()).toHaveAttribute('data-keep-lines', 'true');
  await expect(page.locator('.tiptap p').first()).toHaveAttribute('data-widow-control', 'off');
  await expect(page.locator('.tiptap p').last()).not.toHaveAttribute('data-keep-next', 'true');

  expect(errors).toEqual([]);
});

test('rich text: dragging a ruler marker sets the paragraph indent', async ({ page }) => {
  await openRichText(page);
  await page.keyboard.type('缩进段落');

  const handle = page.getByTestId('rte-ruler-handle-left');
  await expect(handle).toBeVisible();
  const box = await handle.boundingBox();
  expect(box).toBeTruthy();
  if (!box) return;

  // Drag right by 48px: the marker dispatches 4px steps, so the indent lands in that neighbourhood
  await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2);
  await page.mouse.down();
  await page.mouse.move(box.x + box.width / 2 + 48, box.y + box.height / 2, { steps: 10 });
  await page.mouse.up();

  const paragraph = page.locator('.tiptap p').first();
  await expect(paragraph).toHaveAttribute('style', /margin-left: (?:3[6-9]|[4-6]\d)px/);
  const applied = Number(await handle.getAttribute('data-value'));
  expect(applied).toBeGreaterThanOrEqual(36);

  // The right marker starts at the content edge and only ever grows the indent inwards
  const right = page.getByTestId('rte-ruler-handle-right');
  await expect(right).toHaveAttribute('data-value', '0');
  const rightBox = await right.boundingBox();
  if (!rightBox) return;
  await page.mouse.move(rightBox.x + rightBox.width / 2, rightBox.y + rightBox.height / 2);
  await page.mouse.down();
  await page.mouse.move(rightBox.x + rightBox.width / 2 - 40, rightBox.y + rightBox.height / 2, {
    steps: 10,
  });
  await page.mouse.up();
  await expect(paragraph).toHaveAttribute('style', /margin-right: (?:3[2-9]|[4-6]\d)px/);
});
