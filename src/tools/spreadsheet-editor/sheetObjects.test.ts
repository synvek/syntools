import type { ConditionalFormattingOptions } from 'exceljs';
import { describe, expect, it } from 'vitest';
import type { CommentThread } from '../../core/comments/model';
import { collectExportIssues } from './fidelity';
import {
  SHEET_OBJECT_FIELDS,
  SHEET_OBJECT_SPECS,
  applySheetObjects,
  readSheetObjects,
  type SheetObjectSource,
} from './sheetObjects';
import { createEmptySnapshot, type WorkbookSnapshot } from './xlsx-io';

/**
 * 对象注册表（P2-5）：九类对象 + 往返 extras。
 *
 * 这里守的不是"某个函数能跑"，而是**漏接会失败**：注册表少一个快照字段，`tsc` 就报错；
 * 某一类对象写进快照却读不回来，下面的往返用例会失败。之前那段手写合并出过一次事故
 * （`applySnapshot` 漏了图片与形状，切文档后上一份文档的图形留在了新文档里），
 * 这类"少写一行"正是注册表要消灭的。
 */

const sheetId = (): string => createEmptySnapshot('book').sheetOrder[0];

const chart = {
  id: 'chart-1',
  type: 'bar' as const,
  range: { startRow: 0, startColumn: 0, endRow: 2, endColumn: 1 },
  x: 0,
  y: 0,
  width: 320,
  height: 200,
};

const pivot = {
  id: 'pivot-1',
  name: '透视表',
  sheetId: sheetId(),
  range: { startRow: 0, startColumn: 0, endRow: 3, endColumn: 2 },
  rows: [0],
  cols: [1],
  values: [{ column: 2, aggregation: 'sum' as const }],
  filters: {},
  hasHeader: true,
};

const shape = {
  id: 'shape-1',
  prst: 'rect',
  sheetId: sheetId(),
  from: { col: 1, row: 1, colOff: 4, rowOff: 6 },
  width: 180,
  height: 100,
  fill: '#4472C4',
  stroke: '#2F5597',
  strokeWidth: 1,
  z: 1,
};

const image = {
  id: 'image-1',
  sheetId: sheetId(),
  from: { col: 2, row: 2, colOff: 0, rowOff: 0 },
  width: 120,
  height: 80,
  src: 'data:image/png;base64,iVBORw0KGgo=',
  name: 'logo.png',
  z: 2,
};

const table = {
  id: 'table-1',
  name: 'Sales',
  sheetId: sheetId(),
  range: { startRow: 0, startColumn: 0, endRow: 2, endColumn: 1 },
  columns: ['区域', '金额'],
  headerRow: true,
  totalsRow: false,
  style: { name: 'TableStyleMedium2', showRowStripes: true },
};

const thread: CommentThread = {
  id: 'thread-1',
  anchor: { kind: 'cell', sheetId: sheetId(), row: 0, col: 0 },
  resolved: false,
  comments: [{ id: 'c1', author: '甲', createdAt: 1, body: '这里要复核' }],
};

/** 十类内容全有值：用来验证"写进快照的东西都能原样读回来" */
function fullSource(): SheetObjectSource {
  const sheet = sheetId();
  return {
    charts: [{ ...chart, sheetId: sheet }],
    rawParts: {
      version: 1,
      parts: { 'xl/charts/chart1.xml': 'PHN2Zz48L3N2Zz4=' },
      sheetDrawings: { Sheet1: 'xl/drawings/drawing1.xml' },
    },
    pivots: [{ ...pivot, sheetId: sheet }],
    shapes: [{ ...shape, sheetId: sheet }],
    images: [{ ...image, sheetId: sheet }],
    namedRanges: [{ id: 'name-1', name: 'Total', ref: 'A1:B2' }],
    protection: [{ sheetId: sheet, enabled: true, flags: { formatCells: false } }],
    tables: [{ ...table, sheetId: sheet }],
    comments: { [sheet]: [thread] },
    extras: {
      version: 1,
      sheets: { Sheet1: { conditionalFormattings: [{} as ConditionalFormattingOptions] } },
    },
  };
}

describe('SHEET_OBJECT_SPECS', () => {
  it('每个工具字段都恰好登记一次（新增字段而不登记时 tsc 会先失败）', () => {
    const fields = SHEET_OBJECT_SPECS.map((spec) => spec.field);
    expect(new Set(fields).size).toBe(fields.length);
    expect(fields).toEqual([...SHEET_OBJECT_FIELDS]);
    // 九类对象 + 往返 extras；少一个说明注册表与快照脱节
    expect(fields).toHaveLength(10);
    const keys = SHEET_OBJECT_SPECS.map((spec) => spec.key);
    expect(new Set(keys).size).toBe(keys.length);
  });

  it('读回的值与写进去的值一致（往返不变量）', () => {
    const source = fullSource();
    const snapshot = applySheetObjects(createEmptySnapshot('book'), source);
    expect(readSheetObjects(snapshot)).toEqual(source);
  });

  it('空值不写空壳字段，且不产生新的快照对象', () => {
    const base = createEmptySnapshot('book');
    const empty = readSheetObjects(base);
    const same = applySheetObjects(base, empty);
    // 一个字段都没写 → 连对象都不该换（上层据此省掉一次 JSON.stringify）
    expect(same).toBe(base);
    expect(
      Object.keys(same).filter((key) => key.startsWith('syntools') || key === 'namedRanges'),
    ).toEqual([]);
  });

  it('内容清空后把字段删掉，而不是留一个空数组', () => {
    const withChart = applySheetObjects(createEmptySnapshot('book'), fullSource());
    expect(withChart.syntoolsCharts).toHaveLength(1);
    const cleared = applySheetObjects(withChart, readSheetObjects(createEmptySnapshot('book')));
    expect('syntoolsCharts' in cleared).toBe(false);
    expect('syntoolsComments' in cleared).toBe(false);
    expect('syntoolsExtras' in cleared).toBe(false);
  });

  it('对残缺 / 非法形态的快照不抛错，一律退化成空值', () => {
    const broken = {
      ...createEmptySnapshot('book'),
      syntoolsCharts: null,
      syntoolsPivots: 'nope',
      namedRanges: 42,
      syntoolsComments: { broken: 'no-threads' },
      syntoolsExtras: { version: 2, sheets: {} },
    } as unknown as WorkbookSnapshot;
    const back = readSheetObjects(broken);
    expect(back.charts).toEqual([]);
    expect(back.pivots).toEqual([]);
    expect(back.namedRanges).toEqual([]);
    expect(back.comments).toEqual({});
    expect(back.extras).toBeNull();
  });

  it('落盘前清洗坏名称与坏表格', () => {
    const source = fullSource();
    source.namedRanges = [
      { id: 'ok', name: 'Total', ref: 'A1:B2' },
      { id: 'bad', name: 'A1', ref: 'A1' }, // 长得像单元格引用
      { id: 'noref', name: 'Broken', ref: '不是区域' },
    ];
    source.tables = [
      { ...table, id: 'good', name: 'Good' },
      { ...table, id: 'empty', name: 'Empty', columns: [] },
    ];
    const snapshot = applySheetObjects(createEmptySnapshot('book'), source);
    expect(snapshot.namedRanges?.map((item) => item.name)).toEqual(['Total']);
    expect(snapshot.syntoolsTables?.map((item) => item.name)).toEqual(['Good']);
  });

  it('注册表登记的保真度 code 与导出报告一致', () => {
    // 一份把"会被报告的对象"都放进去的快照：图表能画 → kept；形状 → kept；
    // 透视指向空区域 → 只能退回静态值；批注 → 压平成备注；条件格式 → 原样保留
    const base = createEmptySnapshot('book');
    const sheet = base.sheetOrder[0];
    [
      ['区域', '季度', '金额'],
      ['华东', 'Q1', 100],
      ['华南', 'Q1', 30],
    ].forEach((row, rowIndex) => {
      base.sheets[sheet].cellData[String(rowIndex)] = {};
      row.forEach((value, column) => {
        base.sheets[sheet].cellData[String(rowIndex)][String(column)] = {
          v: value as string | number,
        };
      });
    });
    const snapshot = applySheetObjects(base, {
      ...fullSource(),
      // 第二列是文字（季度），数值在第三列：区间覆盖到第三列才有可画的系列
      charts: [{ ...chart, sheetId: sheet, range: { ...chart.range, endColumn: 2 } }],
      pivots: [
        {
          ...pivot,
          sheetId: sheet,
          // 空区域：原生透视表写不出来，只能退回静态值 → 需要告警
          range: { startRow: 6, startColumn: 0, endRow: 9, endColumn: 2 },
        },
      ],
      comments: { [sheet]: [thread] },
    });
    const emitted = new Set(collectExportIssues(snapshot).map((issue) => issue.code));
    for (const spec of SHEET_OBJECT_SPECS) {
      if (!spec.fidelityCode) continue;
      expect(
        emitted.has(spec.fidelityCode),
        `${spec.key} 的 ${spec.fidelityCode} 未出现在报告里`,
      ).toBe(true);
    }
  });
});
