import { readFile } from 'node:fs/promises';
import JSZip from 'jszip';
import { expect, test, type Page } from '@playwright/test';

// Assertions rely on Simplified Chinese copy; the UI language follows the browser locale
test.use({ locale: 'zh-CN' });

/**
 * Office P3 e2e (shape plan §5, acceptance 1–6 / 10).
 *
 * Only a real browser can prove the parts the unit tests stub out: the SVG body actually renders,
 * the selection overlay exposes resize / adjustment handles, and the exported package contains a
 * `wps:wsp` drawing instead of the export-time placeholder.
 */

async function openEditor(page: Page): Promise<void> {
  await page.goto('/tools/rich-text-editor');
  await expect(page.locator('.tiptap')).toBeVisible();
}

async function pickMenu(page: Page, menuId: string, label: string): Promise<void> {
  await page.getByTestId(`menubar-${menuId}`).click();
  // Scope to the open dropdown: top-level menu buttons are `menuitem`s too
  await page.getByRole('menu').getByRole('menuitem', { name: label }).first().click();
}

async function readDocumentXml(path: string): Promise<string> {
  const zip = await JSZip.loadAsync(await readFile(path));
  return (await zip.file('word/document.xml')?.async('string')) ?? '';
}

test('rich text: inserted shape renders as SVG and exports as a native wps:wsp', async ({
  page,
}) => {
  await openEditor(page);
  await page.locator('.tiptap').click();
  await page.keyboard.type('形状测试');

  // 1) Insert from the palette
  await page.getByRole('button', { name: '插入形状' }).click();
  const panel = page.getByTestId('rich-text-shapes');
  await expect(panel).toBeVisible();
  await expect(panel.locator('[data-shape-preset]').first()).toBeVisible();
  await panel.locator('[data-shape-preset="roundRect"]').click();

  // 2) The node renders its own SVG body (no image placeholder involved)
  const shape = page.locator('.tiptap .rte-shape-node');
  await expect(shape).toHaveCount(1);
  await expect(shape.locator('svg path')).toHaveAttribute('d', /^M /);

  // 3) Selected shape exposes the interaction overlay: frame + adjustment handle for roundRect
  await shape.click();
  await expect(page.getByTestId('rich-text-shape-frame')).toBeVisible();
  await expect(page.locator('[data-shape-adjust="adj1"]')).toBeVisible();
  await expect(page.locator('[data-shape-handle="rotate"]')).toBeVisible();

  // 4) Panel edits flow into the node attributes (fill + text)
  // Fill is canonicalised as lowercase `#rrggbb` across the app (`normalizeHex`, docx import); the
  // exporter upper-cases it for `a:srgbClr@val`, so the node attribute stays lowercase.
  await panel.locator('input[type="color"]').first().fill('#ff8800');
  await expect(shape).toHaveAttribute('data-shape-fill', '#ff8800');
  await panel.getByLabel('形状文字').fill('图内文字');
  await expect(shape).toHaveAttribute('data-shape-text', '图内文字');

  // 5) Export: the placeholder paragraph must be gone, the drawing present
  const [download] = await Promise.all([
    page.waitForEvent('download'),
    pickMenu(page, 'file', '导出 Word (.docx)'),
  ]);
  const target = test.info().outputPath('shape.docx');
  await download.saveAs(target);

  const xml = await readDocumentXml(target);
  expect(xml).not.toContain('@@SHAPE:');
  expect(xml).toContain('<wps:wsp>');
  expect(xml).toContain('xmlns:wps=');
  expect(xml).toContain('<a:prstGeom prst="roundRect">');
  expect(xml).toContain('<wps:txbx>');
  expect(xml).toContain('图内文字');
  expect(xml).toContain('形状测试');
});
