import { describe, expect, it } from 'vitest';
import { buildPivot, type PivotConfig } from './pivot';
import { appendPivotSheets, buildPivotSheet } from './pivotSheet';
import { DEFAULT_SHEET_PRINT_OPTIONS, buildSheetPrintModel, paginateSheet } from './print';
import { createEmptySnapshot, type SheetSnapshot, type WorkbookSnapshot } from './xlsx-io';

/** P2-4.6 / P2-4.7：透视结果落到工作表（导出 xlsx 与打印共用同一条路径） */

const SALES: unknown[][] = [
  ['区域', '季度', '金额'],
  ['华东', 'Q1', 100],
  ['华东', 'Q2', 50],
  ['华南', 'Q1', 30],
  ['华南', 'Q2', 20],
];

function snapshotOf(rows: unknown[][]): WorkbookSnapshot {
  const base = createEmptySnapshot('book');
  const cellData: SheetSnapshot['cellData'] = {};
  rows.forEach((row, rowIndex) => {
    row.forEach((value, colIndex) => {
      cellData[String(rowIndex)] ??= {};
      cellData[String(rowIndex)][String(colIndex)] = { v: value as string | number | boolean };
    });
  });
  const sheet: SheetSnapshot = { ...base.sheets[base.sheetOrder[0]], id: 's1', cellData };
  return { ...base, sheetOrder: ['s1'], sheets: { s1: sheet } };
}

function configOf(overrides: Partial<PivotConfig> = {}): PivotConfig {
  return {
    id: 'pivot-1',
    name: '透视表',
    sheetId: 's1',
    range: { startRow: 0, startColumn: 0, endRow: 4, endColumn: 2 },
    rows: [0],
    cols: [1],
    values: [{ column: 2, aggregation: 'sum' }],
    filters: {},
    hasHeader: true,
    ...overrides,
  };
}

describe('buildPivotSheet', () => {
  it('writes the matrix into cells and keeps numbers numeric', () => {
    const config = configOf();
    const sheet = buildPivotSheet(
      'pivot1',
      config,
      buildPivot(snapshotOf(SALES), config),
      '(空白)',
    );
    expect(sheet).not.toBeNull();
    // 表头在 0 行，数据从 1 行开始；合计行在最后
    expect(sheet!.cellData['0']['1']).toEqual({ v: 'Q1' });
    expect(sheet!.cellData['1']['0']).toEqual({ v: '华东' });
    expect(sheet!.cellData['1']['3']).toEqual({ v: 150 });
    expect(sheet!.cellData['3']['3']).toEqual({ v: 200 });
    // 名字带序号（取自 sheet id），避免与已有工作表重名
    expect(sheet!.name).toBe('透视表 1');
  });

  it('returns null when the pivot has no rows', () => {
    const config = configOf({ range: { startRow: 0, startColumn: 0, endRow: 0, endColumn: 2 } });
    expect(
      buildPivotSheet('pivot-print', config, buildPivot(snapshotOf(SALES), config), '(空白)'),
    ).toBeNull();
  });
});

describe('appendPivotSheets', () => {
  it('appends one sheet per pivot and leaves the original order intact', () => {
    const base = createEmptySnapshot('book');
    const snapshot = { ...base, ...snapshotOf(SALES), name: 'book', locale: 'zhCN' as const };
    const next = appendPivotSheets(snapshot, [configOf()], '(空白)');
    expect(next.sheetOrder).toEqual([...snapshot.sheetOrder, 'pivot1']);
    expect(next.sheets.pivot1.name).toBe('透视表 1');
    // 原快照不被改写（导出是纯函数式的，失败时不留下半成品）
    expect(snapshot.sheets.pivot1).toBeUndefined();
  });

  it('skips pivots without data instead of writing an empty sheet', () => {
    const base = createEmptySnapshot('book');
    const snapshot = { ...base, ...snapshotOf(SALES), name: 'book', locale: 'zhCN' as const };
    const empty = configOf({ range: { startRow: 0, startColumn: 0, endRow: 0, endColumn: 2 } });
    expect(appendPivotSheets(snapshot, [empty], '(空白)').sheetOrder).toEqual(snapshot.sheetOrder);
  });

  it('never reuses an existing sheet id or name', () => {
    const base = createEmptySnapshot('book');
    const source = snapshotOf(SALES);
    // 上一次导出的静态透视表还在文档里：id 与名字都被占用
    const existing = buildPivotSheet(
      'pivot1',
      configOf(),
      buildPivot(snapshotOf(SALES), configOf()),
      '(空白)',
    )!;
    const snapshot = {
      ...base,
      ...source,
      name: 'book',
      locale: 'zhCN' as const,
      sheets: { ...source.sheets, pivot1: existing },
      sheetOrder: [...source.sheetOrder, 'pivot1'],
    };

    const next = appendPivotSheets(snapshot, [configOf()], '(空白)');
    expect(next.sheetOrder.filter((id) => id.startsWith('pivot'))).toEqual(['pivot1', 'pivot2']);
    expect(next.sheets.pivot2.name).toBe('透视表 2');
    // 旧的工作表原样保留，没有被覆盖
    expect(next.sheets.pivot1).toBe(existing);
    const names = [existing.name, next.sheets.pivot2.name].map((name) => name.toLowerCase());
    expect(new Set(names).size).toBe(names.length);
  });

  it('disambiguates names that collide case-insensitively with a user sheet', () => {
    const base = createEmptySnapshot('book');
    const source = snapshotOf(SALES);
    const clash = { ...base.sheets[base.sheetOrder[0]], name: '透视表 1' };
    const snapshot = {
      ...base,
      ...source,
      name: 'book',
      locale: 'zhCN' as const,
      sheets: { ...source.sheets, user: clash },
      sheetOrder: [...source.sheetOrder, 'user'],
    };

    const next = appendPivotSheets(snapshot, [configOf()], '(空白)');
    expect(next.sheets.pivot1.name).toBe('透视表 1 (2)');
    expect(next.sheets.user.name).toBe('透视表 1');
  });

  it('reuses the sheet the user already inserted into the document', () => {
    const source = snapshotOf(SALES);
    const config = configOf({ outputSheetId: 'doc-pivot' });
    const docSheet = buildPivotSheet(
      'doc-pivot',
      config,
      buildPivot(snapshotOf(SALES), config),
      '(空白)',
    )!;
    const snapshot: WorkbookSnapshot = {
      ...source,
      syntoolsPivots: [config],
      sheets: { ...source.sheets, 'doc-pivot': docSheet },
      sheetOrder: [...source.sheetOrder, 'doc-pivot'],
    };

    const next = appendPivotSheets(snapshot, [config], '(空白)');
    // 面板「插入到文档」已经落过一张表：导出不追加副本，只登记链接（原生 part 挂在它上面）
    expect(next.sheetOrder).toEqual(snapshot.sheetOrder);
    expect(next.syntoolsPivotSheets).toEqual([{ sheetId: 'doc-pivot', configId: config.id }]);
    expect(next.sheets['doc-pivot']).toBe(docSheet);
  });
});

describe('pivot printing', () => {
  it('feeds the print pipeline with the same matrix the panel shows', () => {
    const config = configOf();
    const sheet = buildPivotSheet(
      'pivot-print',
      config,
      buildPivot(snapshotOf(SALES), config),
      '(空白)',
    )!;
    const base = createEmptySnapshot('透视表');
    const snapshot = { ...base, sheets: { [sheet.id]: sheet }, sheetOrder: [sheet.id] };

    const model = buildSheetPrintModel(snapshot, sheet.id, null);
    expect(model).not.toBeNull();
    // 4 行（表头 + 2 数据行 + 合计行）× 4 列（行标签 + 2 列键 + 合计）
    expect(model!.rows).toHaveLength(4);
    expect(model!.columns).toHaveLength(4);
    const pages = paginateSheet(model!, DEFAULT_SHEET_PRINT_OPTIONS);
    expect(pages.length).toBeGreaterThanOrEqual(1);
  });

  it('splits a wide pivot across pages instead of clipping it', () => {
    // 30 个列键 → 31 列，A4 纵向单页放不下，必须横向分页
    const rows: unknown[][] = [['区域', '季度', '金额']];
    for (let index = 0; index < 30; index += 1) {
      rows.push(['华东', `Q${index}`, index + 1]);
    }
    const config = configOf({ range: { startRow: 0, startColumn: 0, endRow: 30, endColumn: 2 } });
    const sheet = buildPivotSheet(
      'pivot-print',
      config,
      buildPivot(snapshotOf(rows), config),
      '(空白)',
    )!;
    const base = createEmptySnapshot('透视表');
    const snapshot = { ...base, sheets: { [sheet.id]: sheet }, sheetOrder: [sheet.id] };
    const model = buildSheetPrintModel(snapshot, sheet.id, null)!;
    // 面板里的一键打印用的就是默认选项：fit 触到下限定为 50%，再宽就横向分页
    const pages = paginateSheet(model, DEFAULT_SHEET_PRINT_OPTIONS);
    // 宽表被切成多页，而不是把右边几列裁掉
    expect(pages.length).toBeGreaterThan(1);
    const printedColumns = new Set(pages.flatMap((page) => page.columns));
    expect(printedColumns.size).toBe(model.columns.length);
    const totalCells = pages.reduce((sum, page) => sum + page.rows.length * page.columns.length, 0);
    expect(totalCells).toBeGreaterThan(0);
  });
});
