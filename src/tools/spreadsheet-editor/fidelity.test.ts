import type { ConditionalFormattingOptions, DataValidation } from 'exceljs';
import { describe, expect, it } from 'vitest';
import { collectExportIssues } from './fidelity';
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
