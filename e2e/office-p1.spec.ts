import { readFile } from 'node:fs/promises';
import { join } from 'node:path';
import { expect, test, type Page } from '@playwright/test';

// Assertions rely on Simplified Chinese copy; the UI language follows the browser locale
test.use({ locale: 'zh-CN' });

/**
 * Office P1 e2e (plan §5.3).
 *
 * Covers the slide-side deliverables that only a real browser can prove: the vector PDF channel
 * produces text that pdf.js can extract (the same path a reader's Ctrl+F uses), non-encodable
 * pages degrade to bitmaps with a notice, and the print dialog counts pages from the layout model.
 */

async function openSlideTool(page: Page): Promise<void> {
  await page.goto('/tools/slide-editor');
  await expect(page.getByTestId('menubar-file')).toBeVisible();
}

/** Menus render top-level entries as `menuitem` so they never collide with canvas buttons */
async function pickFileMenu(page: Page, label: string): Promise<void> {
  await page.getByTestId('menubar-file').click();
  await page.getByRole('menuitem', { name: label }).click();
}

/** Markdown outline → deck: the quickest way to real slides without importing a file */
async function generateFromOutline(page: Page, outline: string): Promise<void> {
  await pickFileMenu(page, '从大纲生成');
  await page.getByRole('textbox', { name: '从大纲生成' }).fill(outline);
  await page.getByRole('button', { name: '生成幻灯片' }).click();
}

/** Export PDF and save the download; returns the local path */
async function exportPdf(page: Page, name: string): Promise<string> {
  const [download] = await Promise.all([
    page.waitForEvent('download'),
    pickFileMenu(page, '导出 PDF'),
  ]);
  const target = test.info().outputPath(name);
  await download.saveAs(target);
  return target;
}

/** Per-page text as a reader would extract it (pdf.js, the engine behind Ctrl+F) */
async function extractPdfPages(path: string): Promise<string[]> {
  const pdfjs = await import('pdfjs-dist/legacy/build/pdf.mjs');
  const document = await pdfjs.getDocument({
    data: new Uint8Array(await readFile(path)),
    standardFontDataUrl: join(process.cwd(), 'node_modules/pdfjs-dist/standard_fonts/'),
  }).promise;
  const pages: string[] = [];
  for (let index = 1; index <= document.numPages; index += 1) {
    const content = await (await document.getPage(index)).getTextContent();
    pages.push(
      content.items
        .map((item) => ('str' in item ? item.str : ''))
        .join(' ')
        .replace(/\s+/g, ' ')
        .trim(),
    );
  }
  return pages;
}

test('slide: outline deck exports PDF whose text pdf.js can extract', async ({ page }) => {
  await openSlideTool(page);
  // Same heading level → one slide each (a deeper heading would become a bullet on the same page)
  await generateFromOutline(
    page,
    ['# Quarterly Report', '', '- Europe up 12%', '', '# Regional Detail', '', '- Asia flat'].join(
      '\n',
    ),
  );

  const file = await exportPdf(page, 'vector-deck.pdf');
  const pages = await extractPdfPages(file);

  expect(pages.length).toBeGreaterThanOrEqual(2);
  expect(pages.join('\n')).toContain('Quarterly Report');
  expect(pages.join('\n')).toContain('Europe up 12%');
});

test('slide: non-encodable pages fall back to bitmaps and the report says so', async ({ page }) => {
  await openSlideTool(page);
  await generateFromOutline(page, ['# 季度报告', '', '## 营收', '', '- 欧洲增长 12%'].join('\n'));

  const file = await exportPdf(page, 'cjk-deck.pdf');
  const pages = await extractPdfPages(file);

  // Bitmap pages carry no text operators, so nothing on them is searchable
  expect(pages.every((text) => !text.includes('季度报告'))).toBe(true);
  const dialog = page.getByRole('dialog', { name: '保真度报告' });
  await expect(dialog).toBeVisible();
  await expect(dialog.getByText(/已转为位图/)).toBeVisible();
});

test('slide: present enters real fullscreen, and leaving it ends the show', async ({ page }) => {
  await openSlideTool(page);
  await generateFromOutline(page, '# 全屏冒烟');

  await page.getByRole('button', { name: '放映', exact: true }).click();
  await expect.poll(() => page.evaluate(() => Boolean(document.fullscreenElement))).toBe(true);

  // Browser-handled exit (Esc / system) must close the presentation, not leave it stranded
  await page.evaluate(() => document.exitFullscreen());
  await expect.poll(() => page.evaluate(() => Boolean(document.fullscreenElement))).toBe(false);
  await expect(page.getByRole('button', { name: '放映', exact: true })).toBeVisible();
});

test('slide: print dialog counts pages from the layout model', async ({ page }) => {
  await openSlideTool(page);
  await generateFromOutline(page, ['# 第一页', '', '# 第二页'].join('\n'));

  await pickFileMenu(page, '打印…');
  await expect(page.getByText('共 2 页')).toBeVisible();
});
