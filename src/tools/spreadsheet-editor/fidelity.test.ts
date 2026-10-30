import type { ConditionalFormattingOptions, DataValidation } from 'exceljs';
import { describe, expect, it } from 'vitest';
import { collectExportIssues } from './fidelity';
import { appendPivotSheets } from './pivotSheet';
import { buildPivotXlsxPlan } from './pivotXlsx';
import { createEmptySnapshot } from './xlsx-io';

/** Workbook export fidelity: charts and preserved native features */

const chart = {
  id: 'chart-1',
  type: 'bar' as const,
  range: { startRow: 0, startColumn: 0, endRow: 3, endColumn: 1 },
  x: 0,
  y: 0,
  width: 320,
  height: 200,
};

describe('collectExportIssues', () => {
  it('reports nothing for a workbook without charts or extras', () => {
    expect(collectExportIssues(createEmptySnapshot('book'))).toEqual([]);
  });

  it('reports a chart that points at a missing sheet as a loss', () => {
    const snapshot = createEmptySnapshot('book');
    snapshot.syntoolsCharts = [{ ...chart, sheetId: 'does-not-exist' }];
    const issues = collectExportIssues(snapshot);
    const loss = issues.find((issue) => issue.code === 'sheet.charts');
    expect(loss).toMatchObject({ severity: 'loss', count: 1 });
  });

  it('reports preserved conditional formatting and data validation as info', () => {
    const snapshot = createEmptySnapshot('book');
    const sheetName = snapshot.sheets[snapshot.sheetOrder[0]].name;
    snapshot.syntoolsExtras = {
      version: 1,
      sheets: {
        [sheetName]: {
          conditionalFormattings: [{} as ConditionalFormattingOptions],
          dataValidations: { A1: {} as DataValidation, A2: {} as DataValidation },
        },
      },
    };
    const issues = collectExportIssues(snapshot);
    expect(issues.find((issue) => issue.code === 'sheet.cfKept')).toMatchObject({
      severity: 'info',
      count: 1,
      messageKey: 'tools.sheet.keptConditionalFormats',
    });
    expect(issues.find((issue) => issue.code === 'sheet.dvKept')).toMatchObject({
      severity: 'info',
      count: 2,
      messageKey: 'tools.sheet.keptDataValidations',
    });
  });

  it('warns about comment threads that stay in the document', () => {
    const snapshot = createEmptySnapshot('book');
    const sheetId = snapshot.sheetOrder[0];
    snapshot.syntoolsComments = {
      [sheetId]: [
        {
          id: 't1',
          anchor: { kind: 'cell', sheetId, row: 0, col: 0 },
          resolved: false,
          comments: [{ id: 'c1', author: '甲', createdAt: 1, body: '批注' }],
        },
      ],
    };
    expect(
      collectExportIssues(snapshot).find((issue) => issue.code === 'sheet.comments'),
    ).toMatchObject({ severity: 'warning', count: 1, messageKey: 'tools.sheet.lossComments' });
  });
});

describe('collectExportIssues: pivot', () => {
  it('warns when a pivot has to fall back to a static value sheet', () => {
    const snapshot = {
      ...createEmptySnapshot('book'),
      syntoolsPivots: [
        {
          id: 'pivot-1',
          name: '透视表',
          sheetId: snapshotSheetId(),
          range: { startRow: 0, startColumn: 0, endRow: 3, endColumn: 2 },
          rows: [0],
          cols: [1],
          values: [{ column: 2, aggregation: 'sum' as const }],
          filters: {},
          hasHeader: true,
        },
      ],
    };
    expect(
      collectExportIssues(snapshot).find((issue) => issue.code === 'sheet.pivotSnapshot'),
    ).toMatchObject({
      severity: 'warning',
      count: 1,
      messageKey: 'tools.sheet.pivotSnapshot',
    });
  });

  it('stays quiet when the pivot goes out as a native, refreshable part', () => {
    const base = createEmptySnapshot('book');
    const sheetId = base.sheetOrder[0];
    [
      ['区域', '季度', '金额'],
      ['华东', 'Q1', 100],
      ['华南', 'Q1', 30],
    ].forEach((row, rowIndex) => {
      base.sheets[sheetId].cellData[String(rowIndex)] = {};
      row.forEach((value, column) => {
        base.sheets[sheetId].cellData[String(rowIndex)][String(column)] = {
          v: value as string | number,
        };
      });
    });
    const config = {
      id: 'pivot-1',
      name: '透视表',
      sheetId,
      range: { startRow: 0, startColumn: 0, endRow: 2, endColumn: 2 },
      rows: [0],
      cols: [1],
      values: [{ column: 2, aggregation: 'sum' as const }],
      filters: {},
      hasHeader: true,
    };
    const snapshot = appendPivotSheets({ ...base, syntoolsPivots: [config] }, [config], '(空白)');
    expect(buildPivotXlsxPlan(snapshot).items).toHaveLength(1);
    expect(
      collectExportIssues(snapshot).some((issue) => issue.code === 'sheet.pivotSnapshot'),
    ).toBe(false);
  });
});

/** 快照里第一张工作表的 id（透视表配置必须指向存在的表） */
function snapshotSheetId(): string {
  return createEmptySnapshot('book').sheetOrder[0];
}
