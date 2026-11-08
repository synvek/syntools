import { expect, test, type Page } from '@playwright/test';

/**
 * P1-5 large-document performance.
 *
 * The pagination plugin publishes one `rte-page-layout` measure per pass (block measurement + page
 * planning). That number decides whether typing feels laggy, so it is the only metric asserted here —
 * wall-clock "input felt fast" claims are not reproducible across machines.
 */

test.use({ locale: 'zh-CN', viewport: { width: 1440, height: 900 } });
test.describe.configure({ mode: 'serial' });

async function openRichText(page: Page): Promise<void> {
  await page.goto('/tools/rich-text-editor');
  await expect(page.locator('.tiptap')).toBeVisible();
  await page.getByRole('tab', { name: '视图', exact: true }).click();
  await page.getByRole('combobox', { name: '视图模式' }).click();
  await page.getByRole('option', { name: '页面视图' }).click();
  await expect(page.locator('.rte-page-sheet').first()).toBeVisible();
}

async function waitForStableLayout(page: Page): Promise<void> {
  let previous = -1;
  for (let attempt = 0; attempt < 80; attempt += 1) {
    const count = await page.evaluate(
      () => document.querySelector('.tiptap')?.children.length ?? 0,
    );
    if (count === previous) return;
    previous = count;
    await page.waitForTimeout(100);
  }
}

async function openPageSetup(page: Page): Promise<void> {
  await page.getByRole('tab', { name: '页面布局', exact: true }).click();
  await page.getByRole('button', { name: '页面设置', exact: true }).click();
}

async function pastePlainText(page: Page, text: string): Promise<void> {
  await page.evaluate((value) => navigator.clipboard.writeText(value), text);
  await page.locator('.tiptap').click();
  await page.keyboard.press('ControlOrMeta+V');
  const lines = text.split('\n');
  await expect(
    page.locator('.tiptap p', { hasText: lines[lines.length - 1] }).first(),
  ).toBeVisible();
  await waitForStableLayout(page);
}

/** 200 pages of A4 body text at the default size — roughly 8400 short paragraphs */
const PARAGRAPHS = 8400;

test('rich text: 200-page pagination stays within the P1-5 budget', async ({ page }) => {
  test.setTimeout(600_000);
  await openRichText(page);

  const paragraphs = Array.from(
    { length: PARAGRAPHS },
    (_, index) =>
      `第 ${index + 1} 段：大文档分页与输入延迟的端到端采样内容，用于锁定 200 页文档的性能预算。`,
  ).join('\n');
  await pastePlainText(page, paragraphs);

  const sheetCount = await page.locator('.rte-page-sheet').count();
  expect(sheetCount).toBeGreaterThanOrEqual(200);

  // Five edits round-robin over the document: always editing the first paragraph would let the browser
  // reuse one hot layout path and under-report the cost of editing in the middle of a long document.
  await page.evaluate(() => performance.clearMeasures('rte-page-layout'));
  for (let round = 0; round < 5; round += 1) {
    const target = page.locator('.tiptap p').nth(round * 400);
    await target.scrollIntoViewIfNeeded();
    await target.click();
    await page.keyboard.type('改');
    await waitForStableLayout(page);
  }

  const stats = await page.evaluate(() => {
    const summarize = (name: string) => {
      const durations = performance
        .getEntriesByName(name)
        .map((entry) => entry.duration)
        .sort((a, b) => a - b);
      if (durations.length === 0) return null;
      const at = (fraction: number) =>
        durations[Math.min(durations.length - 1, Math.floor(durations.length * fraction))];
      return {
        passes: durations.length,
        median: Math.round(at(0.5) * 100) / 100,
        p95: Math.round(at(0.95) * 100) / 100,
        max: Math.round(durations[durations.length - 1] * 100) / 100,
      };
    };
    return {
      layout: summarize('rte-page-layout'),
      toolbar: summarize('rte-toolbar-state'),
      tabs: summarize('rte-ribbon-tabs'),
      sheets: document.querySelectorAll('.rte-page-sheet').length,
    };
  });

  expect(stats.layout).not.toBeNull();
  // P1-5 acceptance: 200-page input P95 stays under one 60fps frame
  console.info('200-page layout pass cost (ms)', stats.layout);
  console.info('ribbon state recompute cost (ms)', stats.toolbar);
  console.info('ribbon tab config build cost (ms)', stats.tabs);
  expect(stats.layout?.p95).toBeLessThan(16);
  expect(stats.layout?.passes).toBeGreaterThanOrEqual(5);
  // The selector recomputes ~50 flags per transaction; it must stay a small fraction of the frame
  expect(stats.toolbar?.p95 ?? 0).toBeLessThan(16);
  // Building the six tab configs (static skeleton + dynamic flags) must not become the new bottleneck
  expect(stats.tabs?.p95 ?? 0).toBeLessThan(16);
});

test('find highlights cover only the visible slice of a 200-page document', async ({ page }) => {
  test.setTimeout(600_000);
  await openRichText(page);
  // Every paragraph contains 段: a common term means thousands of matches
  const paragraphs = Array.from(
    { length: PARAGRAPHS },
    (_, index) => `第 ${index + 1} 段：大文档的查找高亮只覆盖视口附近的范围。`,
  ).join('\n');
  await pastePlainText(page, paragraphs);

  await page.keyboard.press('ControlOrMeta+f');
  const find = page.getByLabel('查找', { exact: true });
  await expect(find).toBeFocused();
  await find.fill('段');

  const counter = find.locator('xpath=..').locator('span[aria-live="polite"]');
  await expect(counter).toHaveText(/^1\/\d+$/);
  const total = Number((await counter.textContent())?.split('/')[1] ?? 0);
  expect(total).toBeGreaterThanOrEqual(PARAGRAPHS);

  // P1-5: decorating every match would build thousands of inline spans on every keystroke
  const highlighted = async () => page.locator('.rte-find-match, .rte-find-current').count();
  expect(await highlighted()).toBeGreaterThan(0);
  expect(await highlighted()).toBeLessThan(1000);

  // Jumping to the next match scrolls it into view and the clip follows the new viewport
  await page.keyboard.press('Enter');
  await expect(counter).toHaveText(/^2\/\d+$/);
  await expect(page.locator('.rte-find-current')).toHaveCount(1);
  expect(await highlighted()).toBeLessThan(1000);
});

/** Sheet count plus every gap widget height (rounded to 1px): a fingerprint of the page breaks */
async function pageStructure(page: Page): Promise<{ sheets: number; gaps: number[] }> {
  return page.evaluate(() => ({
    sheets: document.querySelectorAll('.rte-page-sheet').length,
    gaps: Array.from(document.querySelectorAll('[data-page-gap]')).map((el) =>
      Math.round(Number.parseFloat((el as HTMLElement).style.height) || 0),
    ),
  }));
}

/** Runtime flag override: one build, both layout paths (see `layoutFlag.ts`) */
async function setIncrementalLayout(page: Page, enabled: boolean): Promise<void> {
  await page.evaluate((value) => {
    (globalThis as { __RTE_INCR_LAYOUT__?: boolean }).__RTE_INCR_LAYOUT__ = value;
    // A resize drops the cached block geometry, so the next pass is a full measure either way
    window.dispatchEvent(new Event('resize'));
  }, enabled);
  await waitForStableLayout(page);
}

test('incremental pagination paginates exactly like the full measure', async ({ page }) => {
  test.setTimeout(180_000);
  await openRichText(page);
  const paragraphs = Array.from(
    { length: 120 },
    (_, index) => `第 ${index + 1} 段：增量分页与全量测量的结果必须逐像素一致。`,
  ).join('\n');
  await pastePlainText(page, paragraphs);
  expect((await pageStructure(page)).sheets).toBeGreaterThanOrEqual(2);

  // Both paths on the same document: the incremental result and the full measure must describe the
  // same page breaks (sheet count + every page-gap height). Toggling the flag dispatches a resize,
  // which drops the cached geometry and re-paginates from scratch.
  const expectMatchesFullMeasure = async () => {
    const incremental = await pageStructure(page);
    await setIncrementalLayout(page, false);
    expect(await pageStructure(page)).toEqual(incremental);
    await setIncrementalLayout(page, true);
  };

  // Typing in the middle: the incremental path re-reads only the touched blocks
  await setIncrementalLayout(page, true);
  const target = page.locator('.tiptap p').nth(60);
  await target.scrollIntoViewIfNeeded();
  await target.click();
  await page.keyboard.type('增量分页增量分页增量分页增量分页增量分页');
  await waitForStableLayout(page);
  await expectMatchesFullMeasure();

  // Splitting a paragraph (Enter) changes the block count, which must fall back to a full measure
  const splitTarget = page.locator('.tiptap p').nth(30);
  await splitTarget.scrollIntoViewIfNeeded();
  await splitTarget.click();
  await page.keyboard.press('End');
  await page.keyboard.press('Enter');
  await expect(page.locator('.tiptap p')).toHaveCount(121);
  await waitForStableLayout(page);
  await expectMatchesFullMeasure();
});

test('spellcheck marks cover only the visible slice of a 200-page document', async ({ page }) => {
  test.setTimeout(600_000);
  await openRichText(page);
  // Every paragraph carries one misspelling: without clipping this is 8400 inline decorations
  const paragraphs = Array.from(
    { length: PARAGRAPHS },
    (_, index) => `Paragraph ${index + 1} contains one wrold to underline.`,
  ).join('\n');
  await pastePlainText(page, paragraphs);

  await page.getByRole('tab', { name: '审阅', exact: true }).click();
  await page.getByRole('button', { name: '拼写检查', exact: true }).click();
  const panel = page.getByTestId('rich-text-spellcheck');
  await panel.getByRole('button', { name: '加载英文词表' }).click();
  await panel.getByRole('button', { name: '已关闭' }).click();

  // Marks appear for the viewport only (P1-5); the whole document would be thousands of spans
  await expect(page.locator('.rte-spell-error').first()).toBeVisible({ timeout: 30_000 });
  const marked = await page.locator('.rte-spell-error').count();
  expect(marked).toBeGreaterThan(0);
  expect(marked).toBeLessThan(1000);
});

test('changing the paper size re-paginates without a document edit', async ({ page }) => {
  // Guards the P1-5 `docChanged` gate: page setup lives outside ProseMirror, so it relies on the
  // explicit force signal instead of an empty transaction
  test.setTimeout(180_000);
  await openRichText(page);
  const paragraphs = Array.from(
    { length: 40 },
    (_, index) => `第 ${index + 1} 段：纸张切换后的分页回归。`,
  ).join('\n');
  await pastePlainText(page, paragraphs);

  const sheet = page.locator('.rte-page-sheet').first();
  const before = await sheet.boundingBox();
  expect(before?.height ?? 0).toBeGreaterThan(0);

  await openPageSetup(page);
  const panel = page.getByTestId('rich-text-page-setup');
  await expect(panel).toBeVisible();
  // Letter is shorter than A4: the sheet itself must shrink once pagination re-runs
  await panel.locator('select').nth(0).selectOption('Letter');
  await panel.getByRole('button', { name: '关闭页面设置' }).click();

  await expect
    .poll(async () => (await sheet.boundingBox())?.height ?? 0)
    .toBeLessThan((before?.height ?? 0) - 20);
});
