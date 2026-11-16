import type { ChartConfig } from './charts';
import type { UniverStyleLite } from './core';
import type { PivotConfig } from './pivot';
import type { SheetShapeConfig } from './shapes';
import {
  createEmptySheet,
  createEmptySnapshot,
  type CellSnapshot,
  type SheetSnapshot,
  type WorkbookSnapshot,
} from './xlsx-io';

/**
 * 内置模板（P2-6）：让新用户 30 秒内看到"这个工具能做什么"。
 *
 * 三份模板刻意各覆盖一组能力，而不是三张长得差不多的表：
 * - 预算：公式（`SUM` / `IF`）+ 数字格式 + 条件格式（超支标红）；
 * - 销售：明细 → `SUMIF` 汇总 → 原生图表 + 透视配置；
 * - 排期：日期序列 + 冻结首行 + 浮动形状（里程碑）。
 *
 * 为什么是"快照工厂"而不是 `samples/*.xlsx`：
 * ① 模板要跟着数据结构演进（图表/透视字段一改，xlsx 里的旧字节不会自己更新）；
 * ② 单测能直接断言"公式在第几行""条件格式覆盖哪个区域"，不需要解压比对二进制；
 * ③ 仓库里少三份二进制资产，diff 也看得见。
 *
 * 表名固定用 ASCII（`Budget` / `Data` / `Summary` / `Schedule`）：跨表公式要写表名，
 * ASCII 名字不必加引号、不随界面语言变化，避免了"切语言后 `SUMIF` 引用坏掉"这一类问题。
 * 翻译的是**文档标题与单元格内容**，用户真正看见的部分。
 */

export type TemplateId = 'budget' | 'sales' | 'schedule';

export interface SheetTemplate {
  id: TemplateId;
  /** 文档标题的 i18n key；快照里存已翻译的字符串，和导入 / 库里的其它文档一致 */
  titleKey: string;
  /** 每次调用返回全新对象：同一份模板可以被连续打开多次（互不共享 cellData） */
  build(title: string, locale: WorkbookSnapshot['locale']): WorkbookSnapshot;
}

/* ---------------------------------------------------------------- 共用小工具 */

const HEADER: UniverStyleLite = {
  bl: 1,
  bg: { rgb: '#dbe5f1' },
  cl: { rgb: '#1f3864' },
  ht: 2,
};
const MONEY: UniverStyleLite = { n: { pattern: '#,##0' } };
const PERCENT: UniverStyleLite = { n: { pattern: '0%' } };
const DATE: UniverStyleLite = { n: { pattern: 'yyyy-mm-dd' } };
const BOLD: UniverStyleLite = { bl: 1 };

/** Conditional-formatting rules live where Univer's sheet plugin puts them: plugin → unitId → sheetId */
const CF_PLUGIN = 'SHEET_CONDITIONAL_FORMATTING_PLUGIN';

interface CfRange {
  startRow: number;
  startColumn: number;
  endRow: number;
  endColumn: number;
}

interface CfEntry {
  sheetId: string;
  ranges: CfRange[];
  /** Univer 的规则体，`cfdv.ts` 导出时按同一套字段读（subType / operator / value / style） */
  rule: Record<string, unknown>;
}

function put(
  sheet: SheetSnapshot,
  row: number,
  column: number,
  value: CellSnapshot | string | number,
): void {
  const record = (sheet.cellData[row] ??= {});
  record[column] = typeof value === 'object' ? value : { v: value };
}

/** 数字单元格：值 + 可选数字格式 */
function num(
  sheet: SheetSnapshot,
  row: number,
  column: number,
  value: number,
  style?: UniverStyleLite,
): void {
  put(sheet, row, column, { v: value, ...(style ? { s: style } : {}) });
}

/** 公式单元格：`f` 是唯一事实来源，`v` 只是引擎算出结果前的占位显示 */
function calc(
  sheet: SheetSnapshot,
  row: number,
  column: number,
  formula: string,
  value?: number | string,
  style?: UniverStyleLite,
): void {
  put(sheet, row, column, {
    f: formula,
    ...(value === undefined ? {} : { v: value }),
    ...(style ? { s: style } : {}),
  });
}

function header(sheet: SheetSnapshot, labels: readonly string[]): void {
  labels.forEach((label, column) => put(sheet, 0, column, { v: label, s: HEADER }));
}

function widths(sheet: SheetSnapshot, values: readonly number[]): void {
  values.forEach((w, index) => {
    sheet.columnData[String(index)] = { w };
  });
}

function freezeFirstRow(sheet: SheetSnapshot): void {
  sheet.freeze = { xSplit: 0, ySplit: 1, startRow: 0, startColumn: 0 };
}

/** Excel 日期序列（1900 日期系统），保留 6 位避免浮点噪声 */
function excelSerial(iso: string): number {
  const ms = Date.parse(`${iso}T00:00:00Z`);
  return Math.round(((ms - Date.UTC(1899, 11, 30)) / 86_400_000) * 1e6) / 1e6;
}

function withConditionalFormats(
  snapshot: WorkbookSnapshot,
  entries: readonly CfEntry[],
): WorkbookSnapshot {
  let index = 0;
  const bySheet: Record<string, unknown[]> = {};
  for (const entry of entries) {
    index += 1;
    (bySheet[entry.sheetId] ??= []).push({
      cfId: `cf-${index}`,
      stopIfTrue: false,
      ranges: entry.ranges,
      rule: entry.rule,
    });
  }
  snapshot.resources = {
    ...(snapshot.resources ?? {}),
    [CF_PLUGIN]: { [snapshot.id]: bySheet },
  };
  return snapshot;
}

/** 只有一个工作表时，把默认表换成模板表 */
function singleSheet(snapshot: WorkbookSnapshot, id: string, name: string): SheetSnapshot {
  const sheet = createEmptySheet(id, name);
  snapshot.sheetOrder = [id];
  snapshot.sheets = { [id]: sheet };
  return sheet;
}

/* ---------------------------------------------------------------- 文案（中英两套） */

interface TemplateText {
  budgetSheet: string;
  budgetHead: readonly string[];
  budgetItems: readonly string[];
  budgetTotal: string;

  dataSheet: string;
  summarySheet: string;
  salesHead: readonly string[];
  summaryHead: readonly string[];
  regions: readonly string[];
  quarters: readonly string[];
  products: readonly string[];
  summaryTotal: string;

  scheduleSheet: string;
  scheduleHead: readonly string[];
  tasks: readonly { name: string; owner: string; start: string; days: number; progress: number }[];
  milestone: string;
}

const ZH: TemplateText = {
  budgetSheet: 'Budget',
  budgetHead: ['项目', '预算', '实际', '差额', '使用率'],
  budgetItems: ['办公用品', '差旅', '市场推广', '培训', '外包'],
  budgetTotal: '合计',

  dataSheet: 'Data',
  summarySheet: 'Summary',
  salesHead: ['区域', '季度', '产品', '数量', '金额'],
  summaryHead: ['区域', '金额'],
  regions: ['华东', '华南', '华北', '西部'],
  quarters: ['Q1', 'Q2', 'Q3'],
  products: ['标准版', '专业版', '企业版'],
  summaryTotal: '合计',

  scheduleSheet: 'Schedule',
  scheduleHead: ['任务', '负责人', '开始', '工期(天)', '结束', '进度'],
  tasks: [
    { name: '需求梳理', owner: '张伟', start: '2026-11-02', days: 4, progress: 1 },
    { name: '原型设计', owner: '李梦', start: '2026-11-04', days: 6, progress: 0.8 },
    { name: '前端开发', owner: '王强', start: '2026-11-09', days: 10, progress: 0.45 },
    { name: '后端开发', owner: '陈静', start: '2026-11-09', days: 12, progress: 0.4 },
    { name: '联调测试', owner: '赵磊', start: '2026-11-23', days: 5, progress: 0 },
    { name: '上线发布', owner: '孙悦', start: '2026-11-30', days: 2, progress: 0 },
  ],
  milestone: '里程碑',
};

const EN: TemplateText = {
  budgetSheet: 'Budget',
  budgetHead: ['Item', 'Budget', 'Actual', 'Variance', 'Used'],
  budgetItems: ['Office supplies', 'Travel', 'Marketing', 'Training', 'Outsourcing'],
  budgetTotal: 'Total',

  dataSheet: 'Data',
  summarySheet: 'Summary',
  salesHead: ['Region', 'Quarter', 'Product', 'Qty', 'Amount'],
  summaryHead: ['Region', 'Amount'],
  regions: ['East', 'South', 'North', 'West'],
  quarters: ['Q1', 'Q2', 'Q3'],
  products: ['Standard', 'Pro', 'Enterprise'],
  summaryTotal: 'Total',

  scheduleSheet: 'Schedule',
  scheduleHead: ['Task', 'Owner', 'Start', 'Days', 'End', 'Progress'],
  tasks: [
    { name: 'Discovery', owner: 'Wei Zhang', start: '2026-11-02', days: 4, progress: 1 },
    { name: 'Prototype', owner: 'Meng Li', start: '2026-11-04', days: 6, progress: 0.8 },
    { name: 'Front end', owner: 'Qiang Wang', start: '2026-11-09', days: 10, progress: 0.45 },
    { name: 'Back end', owner: 'Jing Chen', start: '2026-11-09', days: 12, progress: 0.4 },
    { name: 'QA', owner: 'Lei Zhao', start: '2026-11-23', days: 5, progress: 0 },
    { name: 'Release', owner: 'Yue Sun', start: '2026-11-30', days: 2, progress: 0 },
  ],
  milestone: 'Milestone',
};

function textFor(locale: WorkbookSnapshot['locale']): TemplateText {
  return locale === 'enUS' ? EN : ZH;
}

/* ---------------------------------------------------------------- ① 预算表 */

function buildBudget(
  title: string,
  locale: WorkbookSnapshot['locale'],
  text = ZH,
): WorkbookSnapshot {
  const snapshot = createEmptySnapshot(title, locale);
  snapshot.id = 'tpl-budget';
  const sheet = singleSheet(snapshot, 'sheet-budget', text.budgetSheet);

  header(sheet, text.budgetHead);
  widths(sheet, [180, 110, 110, 110, 90]);

  const budget = [5000, 12000, 20000, 8000, 30000];
  const actual = [4200, 15600, 18300, 5100, 29800];
  text.budgetItems.forEach((item, index) => {
    const row = index + 1;
    const line = row + 1;
    put(sheet, row, 0, item);
    num(sheet, row, 1, budget[index], MONEY);
    num(sheet, row, 2, actual[index], MONEY);
    // 差额 = 预算 - 实际（负数就是超支）
    calc(sheet, row, 3, `=B${line}-C${line}`, budget[index] - actual[index], MONEY);
    calc(
      sheet,
      row,
      4,
      `=IF(B${line}=0,0,C${line}/B${line})`,
      actual[index] / budget[index],
      PERCENT,
    );
  });

  const totalRow = text.budgetItems.length + 1;
  const totalLine = totalRow + 1;
  const lastLine = totalRow;
  put(sheet, totalRow, 0, { v: text.budgetTotal, s: BOLD });
  calc(sheet, totalRow, 1, `=SUM(B2:B${lastLine})`, 75000, { ...MONEY, ...BOLD });
  calc(sheet, totalRow, 2, `=SUM(C2:C${lastLine})`, 73000, { ...MONEY, ...BOLD });
  calc(sheet, totalRow, 3, `=SUM(D2:D${lastLine})`, 2000, { ...MONEY, ...BOLD });
  calc(sheet, totalRow, 4, `=IF(B${totalLine}=0,0,C${totalLine}/B${totalLine})`, 73000 / 75000, {
    ...PERCENT,
    ...BOLD,
  });

  freezeFirstRow(sheet);
  // 使用率 > 100% 标红：模板里唯一一条条件格式，用来演示"规则跟着数据走"
  return withConditionalFormats(snapshot, [
    {
      sheetId: sheet.id,
      ranges: [{ startRow: 1, startColumn: 4, endRow: lastLine - 1, endColumn: 4 }],
      rule: {
        type: 'highlightCell',
        subType: 'number',
        operator: 'greaterThan',
        value: 1,
        style: { bg: { rgb: '#FFC7CE' }, cl: { rgb: '#9C0006' }, bl: 1 },
      },
    },
  ]);
}

/* ---------------------------------------------------------------- ② 销售透视 */

function buildSales(
  title: string,
  locale: WorkbookSnapshot['locale'],
  text = ZH,
): WorkbookSnapshot {
  const snapshot = createEmptySnapshot(title, locale);
  snapshot.id = 'tpl-sales';
  const data = singleSheet(snapshot, 'sheet-data', text.dataSheet);
  header(data, text.salesHead);
  widths(data, [90, 70, 110, 70, 110]);
  freezeFirstRow(data);

  // 4 区域 × 3 季度：金额随季度递增，SUMIF 汇总才有形状
  let row = 1;
  const regionTotals: number[] = [];
  text.regions.forEach((region, regionIndex) => {
    let regionTotal = 0;
    text.quarters.forEach((quarter, quarterIndex) => {
      const qty = 10 + regionIndex * 4 + quarterIndex * 6;
      const amount = qty * 1000 + (quarterIndex + 1) * 5000;
      put(data, row, 0, region);
      put(data, row, 1, quarter);
      put(data, row, 2, text.products[(regionIndex + quarterIndex) % text.products.length]);
      num(data, row, 3, qty, MONEY);
      num(data, row, 4, amount, MONEY);
      regionTotal += amount;
      row += 1;
    });
    regionTotals.push(regionTotal);
  });
  const lastDataRow = row - 1;
  const dataLine = lastDataRow + 1;

  const summary = createEmptySheet('sheet-summary', text.summarySheet);
  snapshot.sheetOrder = [data.id, summary.id];
  snapshot.sheets = { [data.id]: data, [summary.id]: summary };
  header(summary, text.summaryHead);
  widths(summary, [90, 130]);
  text.regions.forEach((region, index) => {
    const line = index + 2;
    put(summary, index + 1, 0, region);
    calc(
      summary,
      index + 1,
      1,
      `=SUMIF(${text.dataSheet}!$A$2:$A$${dataLine},A${line},${text.dataSheet}!$E$2:$E$${dataLine})`,
      regionTotals[index],
      MONEY,
    );
  });
  const totalRow = text.regions.length + 1;
  put(summary, totalRow, 0, { v: text.summaryTotal, s: BOLD });
  calc(
    summary,
    totalRow,
    1,
    `=SUM(B2:B${totalRow})`,
    regionTotals.reduce((sum, v) => sum + v, 0),
    {
      ...MONEY,
      ...BOLD,
    },
  );

  const chart: ChartConfig = {
    id: 'chart-1',
    type: 'bar',
    // 汇总表的 A1:B5：首行表头 + 4 个区域（不含合计行，否则图上会多一根"合计"柱子）
    range: { startRow: 0, startColumn: 0, endRow: text.regions.length, endColumn: 1 },
    sheetId: summary.id,
    x: 320,
    y: 60,
    width: 460,
    height: 300,
    title: title,
  };

  const pivot: PivotConfig = {
    id: 'pivot-1',
    name: 'pivot-1',
    sheetId: data.id,
    range: { startRow: 0, startColumn: 0, endRow: lastDataRow, endColumn: 4 },
    rows: [0],
    cols: [1],
    values: [{ column: 4, aggregation: 'sum' }],
    filters: {},
    hasHeader: true,
  };

  snapshot.syntoolsCharts = [chart];
  snapshot.syntoolsPivots = [pivot];
  return snapshot;
}

/* ---------------------------------------------------------------- ③ 项目排期 */

function buildSchedule(
  title: string,
  locale: WorkbookSnapshot['locale'],
  text = ZH,
): WorkbookSnapshot {
  const snapshot = createEmptySnapshot(title, locale);
  snapshot.id = 'tpl-schedule';
  const sheet = singleSheet(snapshot, 'sheet-schedule', text.scheduleSheet);
  header(sheet, text.scheduleHead);
  widths(sheet, [140, 100, 110, 90, 110, 90]);
  freezeFirstRow(sheet);

  text.tasks.forEach((task, index) => {
    const row = index + 1;
    const line = row + 1;
    put(sheet, row, 0, task.name);
    put(sheet, row, 1, task.owner);
    num(sheet, row, 2, excelSerial(task.start), DATE);
    num(sheet, row, 3, task.days);
    // 结束 = 开始 + 工期
    calc(sheet, row, 4, `=C${line}+D${line}`, excelSerial(task.start) + task.days, DATE);
    num(sheet, row, 5, task.progress, PERCENT);
  });

  const shapes: SheetShapeConfig[] = [
    {
      id: 'shape-1',
      prst: 'roundRect',
      sheetId: sheet.id,
      from: { col: 6, row: 1, colOff: 30, rowOff: 8 },
      width: 150,
      height: 32,
      fill: '#4472c4',
      stroke: '#2f5597',
      strokeWidth: 1,
      text: `${text.milestone} 1`,
      z: 0,
    },
    {
      id: 'shape-2',
      prst: 'roundRect',
      sheetId: sheet.id,
      from: { col: 6, row: 4, colOff: 30, rowOff: 8 },
      width: 150,
      height: 32,
      fill: '#ed7d31',
      stroke: '#c55a11',
      strokeWidth: 1,
      text: `${text.milestone} 2`,
      z: 1,
    },
  ];
  snapshot.syntoolsShapes = shapes;

  // 进度到 100% 标绿：和预算表那条红色规则对称，演示"同一机制、两种用法"
  return withConditionalFormats(snapshot, [
    {
      sheetId: sheet.id,
      ranges: [{ startRow: 1, startColumn: 5, endRow: text.tasks.length, endColumn: 5 }],
      rule: {
        type: 'highlightCell',
        subType: 'number',
        operator: 'greaterThanOrEqual',
        value: 1,
        style: { bg: { rgb: '#C6EFCE' }, cl: { rgb: '#006100' } },
      },
    },
  ]);
}

/* ---------------------------------------------------------------- 注册表 */

export const SHEET_TEMPLATES: readonly SheetTemplate[] = [
  {
    id: 'budget',
    titleKey: 'tools.sheet.templateBudget',
    build: (title, locale) => buildBudget(title, locale, textFor(locale)),
  },
  {
    id: 'sales',
    titleKey: 'tools.sheet.templateSales',
    build: (title, locale) => buildSales(title, locale, textFor(locale)),
  },
  {
    id: 'schedule',
    titleKey: 'tools.sheet.templateSchedule',
    build: (title, locale) => buildSchedule(title, locale, textFor(locale)),
  },
];

/** URL / 参数里来的字符串 → 模板；认不出来返回 null（不猜、不抛） */
export function templateById(id: string | null | undefined): SheetTemplate | null {
  if (!id) return null;
  return SHEET_TEMPLATES.find((template) => template.id === id) ?? null;
}
