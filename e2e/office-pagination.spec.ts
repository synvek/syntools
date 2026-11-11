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

/**
 * Line spacing is a paragraph property (P1-4): it must survive the `.docx` trip as `w:line`, which
 * used to be a fixed 300 for every paragraph regardless of what the ribbon showed.
 */
test('rich text: paragraph line spacing reaches .docx and comes back on import', async ({
  page,
}) => {
  await openRichText(page);
  await page.keyboard.type('一倍半');
  await page.keyboard.press('Enter');
  await page.keyboard.type('默认行距');

  await page.locator('.tiptap p').first().click();
  await page.getByRole('combobox', { name: '行距' }).first().click();
  const options = page.getByRole('listbox', { name: '行距' });
  await expect(options).toBeVisible();
  await options.getByRole('option', { name: '1.5', exact: true }).click();

  const first = page.locator('.tiptap p').first();
  await expect(first).toHaveAttribute('style', /line-height: 1.5/);
  // The second paragraph keeps the document default: this is not a document-wide switch
  await expect(page.locator('.tiptap p').last()).not.toHaveAttribute('style', /line-height/);

  const [download] = await Promise.all([
    page.waitForEvent('download'),
    (async () => {
      await page.getByTestId('menubar-more').click();
      await page.getByRole('menuitem', { name: '导出 Word (.docx)' }).click();
    })(),
  ]);
  const file = test.info().outputPath('line-height.docx');
  await download.saveAs(file);

  // Clear locally, then import: the 1.5 can only come back out of the file
  await page.getByRole('combobox', { name: '行距' }).first().click();
  await page.getByRole('listbox', { name: '行距' }).getByRole('option').first().click();
  await expect(first).not.toHaveAttribute('style', /line-height: 1.5/);

  await page.getByTestId('rich-text-import-input').setInputFiles(file);
  await expect(page.locator('.tiptap p').first()).toHaveAttribute('style', /line-height: 1.5/);
  await expect(page.locator('.tiptap p').last()).not.toHaveAttribute('style', /line-height: 1.5/);
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

test('rich text: clicking the ruler sets a tab stop and Tab lands on it', async ({ page }) => {
  await openRichText(page);
  await page.keyboard.type('甲');

  // Click the tick strip: the stop lands where the pointer is (snapped to the 4px grid)
  const content = page.locator('.rte-ruler-content:not(.rte-ruler-content--v)');
  await expect(content).toBeVisible();
  await content.click({ position: { x: 200, y: 8 } });

  const marker = page.getByTestId('rte-ruler-tabstop');
  await expect(marker).toHaveCount(1);
  const pos = Number(await marker.getAttribute('data-pos'));
  expect(pos).toBeGreaterThan(190);
  expect(pos).toBeLessThan(210);
  await expect(page.locator('.tiptap p').first()).toHaveAttribute(
    'data-tab-stops',
    new RegExp(`^${pos}:left$`),
  );

  // Tab inserts the atom (not a `\t` text node) and the following text starts at the stop
  await page.keyboard.press('Tab');
  await page.keyboard.type('乙');
  const tab = page.locator('.tiptap .rte-tab').first();
  await expect(tab).toHaveCount(1);

  const paragraphBox = await page.locator('.tiptap p').first().boundingBox();
  const tabBox = await tab.boundingBox();
  expect(paragraphBox && tabBox).toBeTruthy();
  if (!paragraphBox || !tabBox) return;
  // Measured advance: the tab starts where the text ends and pushes the next text onto the stop
  expect(tabBox.width).toBeGreaterThan(100);
  expect(Math.abs(tabBox.x + tabBox.width - paragraphBox.x - pos)).toBeLessThan(2);

  // Shift-Tab steps back one stop: it walks left over the text and removes the tab it runs into
  await page.keyboard.press('Shift+Tab');
  await expect(page.locator('.tiptap .rte-tab')).toHaveCount(0);

  // Clicking the marker again removes the stop
  await marker.click();
  await expect(page.getByTestId('rte-ruler-tabstop')).toHaveCount(0);
  await expect(page.locator('.tiptap p').first()).not.toHaveAttribute('data-tab-stops');
});
