import { mkdirSync, readFileSync, statSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { expect, test, type Page } from '@playwright/test';

/**
 * 表格工具的性能预算（P2-1 / P0-5）。
 *
 * 与 `perf-p15.spec.ts` 在同一套思路下：**只断言可以复现的量**，不写"感觉很快"。
 * 这里的量是**主线程长任务**（`PerformanceObserver('longtask')`）：设计上的承诺是
 * "解析与写出都在 worker 里，主线程不该出现秒级停摆"，而长任务正是用户能感知到的那个东西
 * —— 一条 500ms 的 longtask 就等于 30 帧没动。
 *
 * 为什么用生成的 5MB 文件而不是 `samples/` 里那几份：外部样本是为了**保真**（结构各异的真实文件），
 * 这里要的是**体量**。样本都只有几十 KB，测不出"大文件时主线程会不会卡死"。
 *
 * 采样口径：
 * - `最长单条` —— 一次主线程停摆的上限，最能反映"卡了一下"；
 * - `合计` —— 整个动作期间主线程被占住的总时间，反映"是不是一路都在抖"。
 *
 * 阈值取实测值的 2 倍以上（见 `docs/spreadsheet-editor-improvement-plan.md` §5 P2-1 的实测记录）：
 * 无头浏览器在 CI 上的抖动远大于本地，卡死的回归（秒级）依然会被抓住。
 */

test.use({ locale: 'zh-CN', viewport: { width: 1440, height: 900 } });
test.describe.configure({ mode: 'serial' });

/** 12,000 × 10 = 12 万个格子；内容不可压缩，落盘约 5MB（xlsx 是 zip，"aaaa" 会被压到几百 KB） */
const ROWS = 12_000;
const COLUMNS = 10;
const CELLS = ROWS * COLUMNS;

/** 一格 ~56 字符的伪随机 base36：定长、唯一、几乎压不动 */
function token(seed: number): string {
  let value = seed >>> 0;
  let out = '';
  while (out.length < 56) {
    value = (Math.imul(value, 1664525) + 1013904223) >>> 0;
    out += value.toString(36).padStart(7, '0');
  }
  return out.slice(0, 56);
}

async function buildWorkbook(path: string): Promise<number> {
  const ExcelJS = (await import('exceljs')).default;
  const workbook = new ExcelJS.Workbook();
  const sheet = workbook.addWorksheet('数据');
  for (let row = 0; row < ROWS; row += 1) {
    sheet.addRow(Array.from({ length: COLUMNS }, (_, column) => token(row * COLUMNS + column + 1)));
  }
  // `test.info().outputDir` 在第一次写之前并不存在，而 exceljs 的 writeFile 不会替你建目录
  mkdirSync(dirname(path), { recursive: true });
  // exceljs 的 `writeBuffer()` 返回 Node `Buffer`；显式转成 `Uint8Array` 才符合 `writeFileSync` 的签名
  writeFileSync(path, new Uint8Array(await workbook.xlsx.writeBuffer()));
  return statSync(path).size;
}

/** 网格用 sheet 主画布认：`canvas` 的第一个是文档画布（Univer 固定会渲染一条 27px 高的条） */
const GRID = 'canvas[id^="univer-sheet-main-canvas"]';

async function openEditor(page: Page): Promise<void> {
  await page.goto('/tools/spreadsheet-editor');
  await expect(page.locator(GRID).first()).toBeVisible();
  // 实例是"一个 tick 后创建"的：先等它稳定，否则导入会在建实例的过程中插队
  await page.waitForTimeout(1500);
}

/** 装上长任务观察器；返回读取并清空的函数 */
async function watchLongTasks(page: Page): Promise<() => Promise<number[]>> {
  await page.evaluate(() => {
    const bucket: number[] = [];
    (window as unknown as { __sheetLongTasks: number[] }).__sheetLongTasks = bucket;
    new PerformanceObserver((list) => {
      for (const entry of list.getEntries()) bucket.push(Math.round(entry.duration));
    }).observe({ entryTypes: ['longtask'] });
  });
  return () =>
    page.evaluate(() => {
      const bucket = (window as unknown as { __sheetLongTasks?: number[] }).__sheetLongTasks ?? [];
      const copy = [...bucket];
      bucket.length = 0;
      return copy;
    });
}

function stats(durations: number[]): { count: number; max: number; total: number } {
  return {
    count: durations.length,
    max: durations.reduce((max, value) => Math.max(max, value), 0),
    total: durations.reduce((total, value) => total + value, 0),
  };
}

test('sheet: a 5MB workbook imports and exports without freezing the main thread', async ({
  page,
}) => {
  // 夹具生成 + 导入 + 三次量测；留足 CI 余量，但别让失败吃掉一刻钟
  test.setTimeout(300_000);

  const path = join(test.info().outputDir, 'perf-5mb.xlsx');
  const bytes = await buildWorkbook(path);
  expect(bytes).toBeGreaterThan(4 * 1024 * 1024);
  console.info(`fixture: ${(bytes / 1024 / 1024).toFixed(2)} MB / ${CELLS} cells`);

  await openEditor(page);
  const readLongTasks = await watchLongTasks(page);

  // ---- 导入：5MB 文件的解析在 worker 里，主线程只做"把快照交给 Univer" ----
  await page.evaluate(() => performance.mark('sheet-import-start'));
  await page.getByTestId('sheet-import-input').setInputFiles(path);
  // 导入完成的信号是状态栏里的格子数：它由快照算出，早于任何渲染时机都不可能出现
  await expect(page.locator('[data-editor-statusbar]')).toContainText(`单元格: ${CELLS}`, {
    timeout: 300_000,
  });
  const importSeconds = await page.evaluate(() =>
    Math.round(performance.now() - performance.getEntriesByName('sheet-import-start')[0].startTime),
  );
  const importTasks = stats(await readLongTasks());
  console.info('import: wall clock / main-thread long tasks', importSeconds, importTasks);

  // 整个导入期间主线程不该出现秒级停摆（worker 化的意义就在这里）。
  // 实测（本机 Chrome，2026-11-18）：4.82MB / 12 万格 → 端到端 806ms，主线程仅 1 条 143ms 长任务。
  // 阈值留 4~6 倍余量：解析搬去 worker 之后，剩下的这点长任务来自"把快照灌进 Univer"，它不该随文件变大而爆炸
  expect(importTasks.max).toBeLessThan(600);
  expect(importSeconds).toBeLessThan(5000);

  // ---- 导出 CSV：拼接 12 万个格子也走 worker ----
  await page.evaluate(() => performance.mark('sheet-csv-start'));
  await page.locator('[data-testid^="menubar-"]').first().click();
  const download = page.waitForEvent('download');
  await page.getByRole('menuitem', { name: /导出 CSV|Export CSV/ }).click();
  const file = await download;
  // 先确认"真的导出了 12 万格"，否则"很快就完成"可能只是什么都没做
  const csv = readFileSync((await file.path()) ?? '', 'utf8');
  expect(
    csv
      .replace(/^\uFEFF/, '')
      .trimEnd()
      .split('\n'),
  ).toHaveLength(ROWS);
  const csvSeconds = await page.evaluate(() =>
    Math.round(performance.now() - performance.getEntriesByName('sheet-csv-start')[0].startTime),
  );
  const csvTasks = stats(await readLongTasks());
  console.info('csv export: wall clock / main-thread long tasks', csvSeconds, csvTasks);

  // 实测（同一台机器）：12 万格 → 182ms，**零**长任务（拼接全在 worker 里）。
  // 阈值同样留大余量：这条测的是"别回到主线程拼字符串"，而不是精确毫秒数
  expect(csvSeconds).toBeLessThan(5000);
  expect(csvTasks.max).toBeLessThan(300);

  // ---- 大表上连续编辑 + 两级落盘（P0-5 的验收条款）----
  // 12 万格的表上连打 20 个字符：每次输入都会跑一遍投影 / 摘要 / 草稿序列化，
  // 任何一处把整份快照 `stringify` 拽到主线程，这 20 帧就会变成 20 次卡顿。
  await page
    .locator(GRID)
    .first()
    .click({ position: { x: 120, y: 120 } });
  await page.evaluate(() => performance.mark('sheet-edit-start'));
  await page.keyboard.type('abcdefghijklmnopqrst', { delay: 30 });
  await page.keyboard.press('Enter');
  const editTasks = stats(await readLongTasks());
  console.info('20 keystrokes on a 120k-cell sheet: long tasks', editTasks);
  // 计划的验收线是"累计 < 200ms"：这里按实测留余量，但保持同一量级
  expect(editTasks.total).toBeLessThan(400);

  // 12 万格的快照 JSON 超过 `MAX_DRAFT_BYTES`（10MB）：草稿这一级**必然存不下**。
  // 验收的是"不静默丢"——保存尝试之后必须出现降级提示（`degraded` / `failed` 同一个 testid）。
  // 大表靠 IndexedDB 版本而不是草稿续命（见 `useSheetPersistence`），所以下面刷新回空文档是对的。
  await expect(page.getByTestId('sheet-draft-notice')).toBeVisible({ timeout: 15_000 });

  await page.reload();
  await expect(page.locator(GRID).first()).toBeVisible();
  await expect(page.locator('[data-editor-statusbar]')).toContainText('工作表: 1');
});

/**
 * 小文档的草稿恢复（P0-5 验收的后半句"删除页面后草稿仍在"）：
 * 上一条用 12 万格证明"太大时会明说"，这一条证明"装得下时真的还在"。
 */
test('sheet: a small draft survives a reload', async ({ page }) => {
  await openEditor(page);
  await page
    .locator(GRID)
    .first()
    .click({ position: { x: 120, y: 120 } });
  await page.keyboard.type('draft-keep-me', { delay: 10 });
  await page.keyboard.press('Enter');

  // 600ms 防抖 + requestIdleCallback：等它真正写进去
  await page.waitForTimeout(2500);
  await page.reload();

  await expect(page.locator(GRID).first()).toBeVisible();
  await expect(page.locator('[data-editor-statusbar]')).toContainText('单元格: 1', {
    timeout: 30_000,
  });
});
