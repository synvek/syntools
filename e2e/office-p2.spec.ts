import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import JSZip from 'jszip';
import { expect, test, type Page } from '@playwright/test';

// Assertions rely on Simplified Chinese copy (the UI follows the browser locale)
test.use({ locale: 'zh-CN', viewport: { width: 1440, height: 900 } });

/**
 * Office P2 e2e (plan §3.2, P2-2.6).
 *
 * The only thing a browser can prove here that jsdom cannot: a long document (≈50 pages) with three
 * sections still paginates as three sections and exports three `w:sectPr` blocks. Section geometry
 * rounding, `sectPr` parsing and the slicing rules are covered by unit tests; this checks the wiring
 * (node → pagination → export) end to end.
 */

async function openRichText(page: Page): Promise<void> {
  await page.goto('/tools/rich-text-editor');
  await expect(page.locator('.tiptap')).toBeVisible();
  // Pagination (and the per-page sheets) only exists in page view; the default is flow view
  await pickMenu(page, 'view', '页面视图');
  await expect(page.locator('.rte-page-sheet').first()).toBeVisible();
}

/**
 * Wait until pagination has settled.
 *
 * Every edit makes the plugin re-measure and re-insert the inter-page gap widgets (a `setTimeout(0)`
 * dispatch plus a rAF pass). A caret move or a section-break insert issued during that window resolves
 * against stale coordinates: the click lands on the wrong block and the break (plus everything pasted
 * afterwards) silently ends up at the end of the document instead of the section the test meant.
 * Watching the block count is a cheap settlement signal — gaps only change while layout is running.
 */
async function waitForStableLayout(page: Page): Promise<void> {
  let previous = -1;
  for (let attempt = 0; attempt < 60; attempt += 1) {
    const count = await page.evaluate(
      () => document.querySelector('.tiptap')?.children.length ?? 0,
    );
    if (count === previous) return;
    previous = count;
    await page.waitForTimeout(100);
  }
}

/** Paste plain text: ProseMirror splits on newlines, so this is the fastest way to a long document */
async function pastePlainText(page: Page, text: string, atEnd = false): Promise<void> {
  await page.evaluate((value) => navigator.clipboard.writeText(value), text);
  if (atEnd) {
    // Clicking a text block first gives a text selection; jumping with Ctrl+End right after inserting a
    // section break would otherwise leave the atom's NodeSelection active and the paste would replace it
    await page.locator('.tiptap p').last().click();
    await page.keyboard.press('ControlOrMeta+End');
  } else {
    await page.locator('.tiptap').click();
  }
  await page.keyboard.press('ControlOrMeta+V');
  const lines = text.split('\n');
  await expect(
    page.locator('.tiptap p', { hasText: lines[lines.length - 1] }).first(),
  ).toBeVisible();
  await waitForStableLayout(page);
}

/** Insert a section break at the end of the document, then wait for pagination to settle */
async function insertSectionBreakAtEnd(page: Page): Promise<void> {
  await page.locator('.tiptap p').last().click();
  await page.keyboard.press('ControlOrMeta+End');
  await pickMenu(page, 'insert', '插入分节符');
  await waitForStableLayout(page);
}

async function pickMenu(page: Page, menuId: string, label: string): Promise<void> {
  await page.getByTestId(`menubar-${menuId}`).click();
  // Scope to the open dropdown: top-level menu buttons are `menuitem`s too, and other menus on the
  // page can contain a disabled entry with the same label
  await page.getByRole('menu').getByRole('menuitem', { name: label }).first().click();
}

async function readDocumentXml(path: string): Promise<string> {
  const zip = await JSZip.loadAsync(await readFile(path));
  return (await zip.file('word/document.xml')?.async('string')) ?? '';
}

/** Page count of an exported PDF, read with pdf.js (the same engine a reader uses) */
async function pdfPageCount(path: string): Promise<number> {
  const pdfjs = await import('pdfjs-dist/legacy/build/pdf.mjs');
  const document = await pdfjs.getDocument({
    data: new Uint8Array(await readFile(path)),
    standardFontDataUrl: join(process.cwd(), 'node_modules/pdfjs-dist/standard_fonts/'),
  }).promise;
  return document.numPages;
}

test('rich text: 50-page three-section document exports three w:sectPr', async ({ page }) => {
  test.setTimeout(180_000);
  await openRichText(page);

  // Three sections, each with real content (an empty section is dropped on export by design).
  // ~700 paragraphs per section ≈ 50 A4 pages in total at the default 12pt body size.
  const paragraphs = (from: number) =>
    Array.from(
      { length: 700 },
      (_, index) => `第 ${from + index + 1} 段：分节与分页的端到端验收内容。`,
    ).join('\n');

  await pastePlainText(page, paragraphs(0));
  await expect(page.locator('.rte-page-sheet').first()).toBeVisible();
  // Every insert goes through the caret-at-end helper, which also settles pagination: inserting while
  // the previous paste's gap widgets are still being laid out can drop the break at the wrong block.
  await insertSectionBreakAtEnd(page);
  await pastePlainText(page, paragraphs(700), true);

  await insertSectionBreakAtEnd(page);
  await pastePlainText(page, paragraphs(1400), true);

  await expect(page.locator('.rte-section-break-node')).toHaveCount(2);
  // A next-page section break always starts a new page, so two breaks add at least two pages
  await expect
    .poll(async () => page.locator('.rte-page-sheet').count(), { timeout: 20_000 })
    .toBeGreaterThan(40);

  const [download] = await Promise.all([
    page.waitForEvent('download'),
    pickMenu(page, 'file', '导出 Word'),
  ]);
  const target = test.info().outputPath('sections.docx');
  await download.saveAs(target);

  const xml = await readDocumentXml(target);
  expect((xml.match(/<w:sectPr/g) ?? []).length).toBe(3);
});

test('rich text: page count matches between page view and snapshot PDF', async ({ page }) => {
  test.setTimeout(180_000);
  await openRichText(page);

  const paragraphs = (from: number) =>
    Array.from(
      { length: 200 },
      (_, index) => `第 ${from + index + 1} 段：分节后屏幕页数与导出 PDF 页数必须一致。`,
    ).join('\n');

  // Three sections: A4 portrait / Letter landscape / A4 portrait.
  // Click a text block before every insert: a lingering atom NodeSelection would make the next insert replace it.
  await pastePlainText(page, paragraphs(0));
  await insertSectionBreakAtEnd(page);
  await expect(page.locator('.rte-section-break-node')).toHaveCount(1);

  await pastePlainText(page, paragraphs(200), true);
  await insertSectionBreakAtEnd(page);
  await expect(page.locator('.rte-section-break-node')).toHaveCount(2);

  await pastePlainText(page, paragraphs(400), true);
  await expect(page.locator('.tiptap p').nth(250)).toContainText('第 251 段');

  // Caret into the second section, then give that section its own paper/orientation
  await page.locator('.tiptap p').nth(250).click();
  await pickMenu(page, 'view', '页面设置');
  const panel = page.getByTestId('rich-text-page-setup');
  await expect(panel).toBeVisible();
  // The panel edits the section under the caret — assert it, otherwise the whole case proves nothing
  await expect(panel).toContainText('第 2 节');
  await panel.locator('select').nth(0).selectOption('Letter');
  await panel.locator('select').nth(1).selectOption('landscape');
  await panel.getByRole('button', { name: '关闭页面设置' }).click();
  await expect(panel).toBeHidden();

  // The paper must travel on the section-break node (section 2), not on the document setup (section 1)
  await expect(page.locator('.rte-section-break-node').first()).toHaveAttribute(
    'data-section-setup',
    /"size":"Letter".*"orientation":"landscape"/,
  );
  await expect
    .poll(() =>
      page.evaluate(() => {
        const surface = document.querySelector('.rte-surface');
        return surface ? getComputedStyle(surface).getPropertyValue('--rte-page-width').trim() : '';
      }),
    )
    .toBe('210mm');

  // Let pagination settle, then count the on-screen pages
  await expect.poll(async () => page.locator('.rte-page-sheet').count()).toBeGreaterThan(10);
  const sheetCount = await page.locator('.rte-page-sheet').count();

  // The export entries are disabled while the document snapshot is still empty; the editor syncs it on a
  // 600ms debounce, so wait for that before opening the menu
  await page.waitForTimeout(1200);
  await pickMenu(page, 'file', '导出 PDF');
  const dialog = page.getByTestId('rich-text-pdf-dialog');
  await expect(dialog).toBeVisible();
  await dialog.getByRole('radio', { name: '截图版' }).click();
  const [download] = await Promise.all([
    page.waitForEvent('download'),
    dialog.getByRole('button', { name: '导出 PDF' }).click(),
  ]);
  const target = test.info().outputPath('sections.pdf');
  await download.saveAs(target);

  // §3.2.4: screen and exported PDF must agree on the page count (0 pages of error)
  expect(await pdfPageCount(target)).toBe(sheetCount);
});

test('rich text: page break lands after the current block and keeps the caret after it', async ({
  page,
}) => {
  await openRichText(page);
  await pastePlainText(page, ['甲', '乙', '丙'].join('\n'));

  // Insert in the middle of a paragraph: the break must follow the whole block, not split it
  await page.locator('.tiptap p', { hasText: '乙' }).first().click();
  await pickMenu(page, 'insert', '插入分页符');
  await waitForStableLayout(page);

  const afterInsert = await page.evaluate(() => {
    // Ignore the inter-page gap widgets: they are inserted right after a page start and carry no text
    const blocks = (
      Array.from(document.querySelector('.tiptap')!.children) as HTMLElement[]
    ).filter((el) => el.tagName === 'P' || el.hasAttribute('data-page-break'));
    const index = blocks.findIndex((el) => el.hasAttribute('data-page-break'));
    return {
      breaks: blocks.filter((el) => el.hasAttribute('data-page-break')).length,
      before: blocks[index - 1]?.textContent ?? '',
      after: blocks[index + 1]?.textContent ?? '',
      paragraphs: blocks.filter((el) => el.tagName === 'P').map((el) => el.textContent ?? ''),
    };
  });
  expect(afterInsert.breaks).toBe(1);
  expect(afterInsert.before).toBe('乙');
  // No stray fragment: a mid-paragraph insert used to chop the paragraph into "乙" + tail after the break
  expect(afterInsert.paragraphs).toEqual(['甲', '乙', '丙']);
  expect(afterInsert.after).toBe('丙');

  // Insert at the very end: the document must not end on the atom, and typing continues after the break
  await page.locator('.tiptap p', { hasText: '丙' }).first().click();
  await page.keyboard.press('ControlOrMeta+End');
  await pickMenu(page, 'insert', '插入分页符');
  await waitForStableLayout(page);
  await page.keyboard.type('丁');
  await expect(page.locator('.tiptap p', { hasText: '丁' }).first()).toBeVisible();

  const afterTyping = await page.evaluate(() => {
    const order = (Array.from(document.querySelector('.tiptap')!.children) as HTMLElement[])
      .filter((el) => el.tagName === 'P' || el.hasAttribute('data-page-break'))
      .map((el) => (el.hasAttribute('data-page-break') ? 'BREAK' : (el.textContent ?? '').trim()));
    const last = order.lastIndexOf('BREAK');
    return { lastBreakBefore: order.slice(last - 1, last + 2) };
  });
  // The typed line sits after the last break (the caret did not fall back to the previous section)
  expect(afterTyping.lastBreakBefore).toEqual(['丙', 'BREAK', '丁']);
});

test('rich text: 50-page pagination stays within the 50ms budget per pass', async ({ page }) => {
  test.setTimeout(180_000);
  await openRichText(page);
  const paragraphs = Array.from(
    { length: 2100 },
    (_, index) => `第 ${index + 1} 段：分页耗时的端到端采样内容，用于锁定 50 页文档的重排预算。`,
  ).join('\n');
  await pastePlainText(page, paragraphs);
  const sheetCount = await page.locator('.rte-page-sheet').count();
  expect(sheetCount).toBeGreaterThanOrEqual(50);

  // §3.2.4 ②: budget for one pagination pass (block measurement + planning) on a ~50 page document.
  // Every edit re-measures all blocks, so this is the number that decides whether typing feels laggy.
  await page.evaluate(() => performance.clearMeasures('rte-page-layout'));
  for (let round = 0; round < 5; round += 1) {
    await page.locator('.tiptap p').first().click();
    await page.keyboard.type('改');
    await waitForStableLayout(page);
  }
  const stats = await page.evaluate(() => {
    const durations = performance
      .getEntriesByName('rte-page-layout')
      .map((entry) => entry.duration)
      .sort((a, b) => a - b);
    if (durations.length === 0) return null;
    const at = (fraction: number) =>
      durations[Math.min(durations.length - 1, Math.floor(durations.length * fraction))];
    return {
      passes: durations.length,
      median: Math.round(at(0.5) * 10) / 10,
      p95: Math.round(at(0.95) * 10) / 10,
      max: Math.round(durations[durations.length - 1] * 10) / 10,
    };
  });
  expect(stats).not.toBeNull();
  expect(stats?.passes).toBeGreaterThanOrEqual(5);
  // Report the numbers in the run log: the budget alone doesn't show regressions until it is exceeded
  console.info('page layout pass cost', stats);
  expect(stats?.p95).toBeLessThan(50);
});
test('rich text: compare with a .docx file turns the differences into reviewable revisions', async ({
  page,
}) => {
  test.setTimeout(120_000);
  await openRichText(page);
  await pastePlainText(page, '第一段原文\n第二段原文\n第三段原文');

  // 1) The exported .docx is the "other version": export first, edit afterwards
  const [download] = await Promise.all([
    page.waitForEvent('download'),
    pickMenu(page, 'file', '导出 Word (.docx)'),
  ]);
  // Save under a real .docx name: the import validates the extension, and the download's temp path has none
  const baseline = join(test.info().outputDir, 'baseline.docx');
  await download.saveAs(baseline);

  const edited = '第一段原文\n第二段改过的文字\n第三段原文\n第四段新增';
  await page.locator('.tiptap').click();
  await page.keyboard.press('ControlOrMeta+A');
  await page.keyboard.press('Delete');
  await pastePlainText(page, edited);

  /** Run one comparison through the real UI (review panel button -> file picker) */
  const compareWithBaseline = async () => {
    const chooser = page.waitForEvent('filechooser');
    await page.getByRole('button', { name: '与文件比较…' }).click();
    await (await chooser).setFiles(baseline);
  };

  await page.getByRole('button', { name: '批注与修订' }).click();
  await expect(page.getByTestId('rich-text-review')).toBeVisible();
  await compareWithBaseline();

  // The comparison is applied in place: deleted text stays (struck through), insertions are underlined
  await expect(page.locator('.tiptap del[data-track]').first()).toBeVisible();
  await expect(page.locator('.tiptap ins[data-track]').first()).toBeVisible();
  const perChangeReject = page.getByRole('button', { name: /^拒绝此条修订/ });
  expect(await perChangeReject.count()).toBeGreaterThanOrEqual(2);

  // Panel navigation: next/prev walk the revision list and move the editor selection with it
  const position = page.getByTestId('rich-text-change-position');
  await expect(position).toHaveText(/^1\/\d+$/);
  await page.getByRole('button', { name: '下一处修订' }).click();
  await expect(position).toHaveText(/^2\/\d+$/);
  await page.getByRole('button', { name: '上一处修订' }).click();
  await expect(position).toHaveText(/^1\/\d+$/);

  // 2) One comparison = one history step (plan §3.3.4)
  await page.locator('.tiptap p').first().click();
  await page.keyboard.press('ControlOrMeta+Z');
  await expect(page.locator('.tiptap del[data-track]')).toHaveCount(0);
  await expect(page.locator('.tiptap ins[data-track]')).toHaveCount(0);
  await expect(page.locator('.tiptap')).toContainText('第四段新增');

  // 3) Compare again, reject exactly one revision, then accept the rest
  await compareWithBaseline();
  const beforeReject = await perChangeReject.count();
  await perChangeReject.first().click();
  await expect(perChangeReject).toHaveCount(beforeReject - 1);

  await page.getByRole('button', { name: '全部接受', exact: true }).click();
  await expect(page.locator('.tiptap del[data-track]')).toHaveCount(0);
  await expect(page.locator('.tiptap ins[data-track]')).toHaveCount(0);
  // Accepting everything leaves the compared file's content plus nothing else (the rejected block stayed in its base form)
  await expect(page.locator('.tiptap')).toContainText('第一段原文');
  await expect(page.locator('.tiptap')).toContainText('第三段原文');
});

test('rich text: tracked changes survive a .docx round trip through import', async ({ page }) => {
  test.setTimeout(120_000);
  await openRichText(page);
  await pastePlainText(page, '甲乙丙');

  // 1) Mark the whole paragraph as an insertion
  await page.getByRole('button', { name: '批注与修订' }).click();
  await page.locator('.tiptap p').first().click();
  await page.keyboard.press('ControlOrMeta+A');
  await page.getByRole('button', { name: '标记为插入' }).click();
  await expect(page.getByTestId('rich-text-change-position')).toHaveText('1/1');
  await expect(page.locator('.tiptap ins[data-track]').first()).toBeVisible();

  // 2) Export (w:ins + trackRevisions), then import the same file back
  const [download] = await Promise.all([
    page.waitForEvent('download'),
    pickMenu(page, 'file', '导出 Word (.docx)'),
  ]);
  const file = join(test.info().outputDir, 'tracked.docx');
  await download.saveAs(file);

  const chooser = page.waitForEvent('filechooser');
  await pickMenu(page, 'file', '导入 Word (.docx)');
  await (await chooser).setFiles(file);

  // 3) The revision comes back as an editable revision, not as plain text
  await expect(page.locator('.tiptap ins[data-track]').first()).toBeVisible();
  await expect(page.getByTestId('rich-text-review')).toContainText('修订');
  expect(await page.getByRole('button', { name: /^接受此条修订/ }).count()).toBeGreaterThanOrEqual(
    1,
  );
  // No "revisions could not be mapped" notice: the round trip must stay exact
  await expect(page.getByRole('status').filter({ hasText: '修订标记未还原' })).toHaveCount(0);

  // Accepting clears the revision and keeps the text
  await page.getByRole('button', { name: '全部接受', exact: true }).click();
  await expect(page.locator('.tiptap ins[data-track]')).toHaveCount(0);
  await expect(page.locator('.tiptap')).toContainText('甲乙丙');
});

test('rich text: comments survive a .docx round trip through import', async ({ page }) => {
  test.setTimeout(120_000);
  await openRichText(page);
  await pastePlainText(page, '甲乙丙');

  // 1) Comment on a selection
  await page.getByRole('button', { name: '批注与修订' }).click();
  // Triple click selects the paragraph: a caret-only selection would silently create a document-level
  // comment (no mark), which is exactly what this test must not accept
  await page.locator('.tiptap p').first().click({ clickCount: 3 });
  await page.getByRole('button', { name: '新建批注' }).click();
  await expect(page.getByText('（未选中文本，将创建文档级批注）')).toHaveCount(0);
  await page.getByPlaceholder('输入批注内容，回车提交，Shift+回车换行').fill('这里需要补充来源');
  await page.getByRole('button', { name: '提交', exact: true }).click();
  await expect(page.getByTestId('rich-text-review')).toContainText('这里需要补充来源');
  await expect(page.locator('.tiptap span[data-comment-id]').first()).toBeVisible();

  // 2) Export, then import the same file back
  const [download] = await Promise.all([
    page.waitForEvent('download'),
    pickMenu(page, 'file', '导出 Word (.docx)'),
  ]);
  const file = join(test.info().outputDir, 'commented.docx');
  await download.saveAs(file);

  const chooser = page.waitForEvent('filechooser');
  await pickMenu(page, 'file', '导入 Word (.docx)');
  await (await chooser).setFiles(file);

  // 3) The comment (record + anchor) comes back, with a namespaced id that cannot collide with editor ids
  await expect(page.getByTestId('rich-text-review')).toContainText('这里需要补充来源');
  await expect(page.locator('.tiptap span[data-comment-id^="docx-cmt-"]').first()).toBeVisible();
  await expect(page.getByRole('status').filter({ hasText: '跨段落' })).toHaveCount(0);
  await expect(page.locator('.tiptap')).toContainText('甲乙丙');
});

test('spreadsheet: pivot table aggregates a range and exports as static values', async ({
  page,
}) => {
  test.setTimeout(120_000);
  const errors: string[] = [];
  page.on('pageerror', (error) => errors.push(String(error)));

  await page.goto('/tools/spreadsheet-editor');
  await expect(page.locator('.sheet-canvas')).toBeVisible();

  // 1) Seed through the CSV importer: Univer is a canvas, so typing cells is not a stable test input
  const csv = join(test.info().outputDir, 'sales.csv');
  await mkdir(test.info().outputDir, { recursive: true });
  await writeFile(csv, '区域,季度,金额\n华东,Q1,100\n华东,Q2,50\n华南,Q1,30\n华南,Q2,20', 'utf8');
  const chooser = page.waitForEvent('filechooser');
  await pickMenu(page, 'file', '导入 CSV (.csv)');
  await (await chooser).setFiles(csv);
  await expect(page.locator('.sheet-canvas')).toBeVisible();

  // 2) Single-cell selection falls back to the used range, so the panel opens with a real cross table
  await pickMenu(page, 'insert', '插入透视表');
  const panel = page.getByTestId('sheet-pivot');
  await expect(panel).toBeVisible();
  const table = panel.getByRole('table');
  await expect(table).toContainText('华东');
  await expect(table).toContainText('华南');
  // 行合计 150 / 50，列合计 130 / 70，总计 200（与手工计算一致）
  await expect(table).toContainText('150');
  await expect(table).toContainText('130');
  await expect(table).toContainText('200');

  // 3) Export: the pivot lands as a static value sheet and the file opens without repair prompts
  const [download] = await Promise.all([
    page.waitForEvent('download'),
    panel.getByRole('button', { name: '连同透视表导出 xlsx' }).click(),
  ]);
  const xlsx = join(test.info().outputDir, 'pivot.xlsx');
  await download.saveAs(xlsx);

  const ExcelJS = (await import('exceljs')).default;
  const workbook = new ExcelJS.Workbook();
  await workbook.xlsx.readFile(xlsx);
  const pivotSheet = workbook.getWorksheet('透视表 1');
  expect(pivotSheet).toBeTruthy();
  // 表头 + 第一行数据 + 合计行列
  expect(pivotSheet!.getCell('A2').value).toBe('华东');
  expect(pivotSheet!.getCell('D2').value).toBe(150);
  // 合计行：列合计 130 / 70，总计 200
  expect(pivotSheet!.getCell('B4').value).toBe(130);
  expect(pivotSheet!.getCell('C4').value).toBe(70);
  expect(pivotSheet!.getCell('D4').value).toBe(200);

  expect(errors).toEqual([]);
});
