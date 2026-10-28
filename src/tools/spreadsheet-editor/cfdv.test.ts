import type { ConditionalFormattingOptions, DataValidation } from 'exceljs';
import { describe, expect, it } from 'vitest';
import { collectEditorValidation, countUnsupportedValidation, rangeToA1 } from './cfdv';
import { collectExportIssues } from './fidelity';
import { createEmptySnapshot, exportSnapshotToBytes, type WorkbookSnapshot } from './xlsx-io';

/** CF/DV created in the editor: snapshot resources → exceljs/OOXML (P1-3) */

const CF_PLUGIN = 'SHEET_CONDITIONAL_FORMATTING_PLUGIN';
const DV_PLUGIN = 'SHEET_DATA_VALIDATION_PLUGIN';

interface WorksheetLike {
  conditionalFormattings?: ConditionalFormattingOptions[];
  dataValidations?: { model?: Record<string, DataValidation> };
}

/** Build an empty workbook whose resources are produced with the real sheet id */
function workbookWith(build: (sheetId: string) => Record<string, unknown>): {
  snapshot: WorkbookSnapshot;
  sheetId: string;
} {
  const snapshot = createEmptySnapshot('book');
  const sheetId = snapshot.sheetOrder[0];
  return { snapshot: { ...snapshot, resources: build(sheetId) }, sheetId };
}

const range = (startRow: number, startColumn: number, endRow: number, endColumn: number) => ({
  startRow,
  startColumn,
  endRow,
  endColumn,
});

const colorScale = {
  cfId: 'cf-1',
  stopIfTrue: false,
  ranges: [range(1, 1, 3, 1)],
  rule: {
    type: 'colorScale',
    config: [
      { index: 0, color: '#FF0000', value: { type: 'min' } },
      { index: 1, color: '#00FF00', value: { type: 'percent', value: 50 } },
      { index: 2, color: '#0000FF', value: { type: 'max' } },
    ],
  },
};

const cellIs = {
  cfId: 'cf-2',
  stopIfTrue: false,
  ranges: [range(0, 0, 9, 0)],
  rule: {
    type: 'highlightCell',
    subType: 'number',
    operator: 'greaterThan',
    value: 5,
    style: { bg: { rgb: '#FFFF00' }, bl: 1 },
  },
};

const dataBar = {
  cfId: 'cf-3',
  stopIfTrue: false,
  ranges: [range(0, 2, 9, 2)],
  rule: {
    type: 'dataBar',
    isShowValue: true,
    config: {
      min: { type: 'min' },
      max: { type: 'max' },
      isGradient: true,
      positiveColor: '#4F81BD',
      nativeColor: '#4F81BD',
    },
  },
};

const uniqueValues = {
  cfId: 'cf-4',
  stopIfTrue: false,
  ranges: [range(0, 3, 9, 3)],
  rule: { type: 'highlightCell', subType: 'uniqueValues', style: { bg: { rgb: '#FFC7CE' } } },
};

function withCf(rules: unknown[]) {
  return workbookWith((sheetId) => ({ [CF_PLUGIN]: { 'unit-1': { [sheetId]: rules } } }));
}

function withDv(rules: unknown[]) {
  return workbookWith((sheetId) => ({ [DV_PLUGIN]: { 'unit-1': { [sheetId]: rules } } }));
}

describe('collectEditorValidation', () => {
  it('converts colorScale / cellIs / dataBar and counts unsupported rules', () => {
    const { snapshot, sheetId } = withCf([colorScale, cellIs, dataBar, uniqueValues]);
    const rules = collectEditorValidation(snapshot, sheetId);

    expect(rules.conditionalFormattings.map((item) => item.ref)).toEqual([
      'B2:B4',
      'A1:A10',
      'C1:C10',
    ]);
    expect(rules.conditionalFormattings[0].rules[0]).toMatchObject({ type: 'colorScale' });
    expect(rules.conditionalFormattings[1].rules[0]).toMatchObject({
      type: 'cellIs',
      operator: 'greaterThan',
      formulae: ['5'],
    });
    expect(rules.conditionalFormattings[2].rules[0]).toMatchObject({ type: 'dataBar' });
    // uniqueValues has no OOXML cfRule equivalent
    expect(rules.unsupportedConditionalFormattings).toBe(1);
  });

  it('converts list and range validations per cell', () => {
    const { snapshot, sheetId } = withDv([
      {
        uid: 'dv-1',
        type: 'list',
        formula1: 'a,b,c',
        allowBlank: true,
        ranges: [range(0, 0, 4, 0)],
      },
      {
        uid: 'dv-2',
        type: 'whole',
        operator: 'between',
        formula1: '1',
        formula2: '10',
        ranges: [range(0, 2, 2, 2)],
      },
      { uid: 'dv-3', type: 'time', ranges: [range(0, 4, 0, 4)] },
    ]);
    const rules = collectEditorValidation(snapshot, sheetId);

    // 5 cells + 3 cells
    expect(Object.keys(rules.dataValidations)).toHaveLength(8);
    expect(rules.dataValidations.A1).toMatchObject({
      type: 'list',
      allowBlank: true,
      formulae: ['"a,b,c"'],
    });
    expect(rules.dataValidations.C1).toMatchObject({
      type: 'whole',
      operator: 'between',
      formulae: ['1', '10'],
    });
    // 'time' has no exceljs/OOXML equivalent here
    expect(rules.unsupportedDataValidations).toBe(1);
  });

  it('reads the flat resources layout as well', () => {
    const { snapshot, sheetId } = workbookWith((id) => ({ [CF_PLUGIN]: { [id]: [cellIs] } }));
    expect(collectEditorValidation(snapshot, sheetId).conditionalFormattings).toHaveLength(1);
  });

  it('returns nothing for an unknown sheet or missing resources', () => {
    const { snapshot, sheetId } = workbookWith(() => ({}));
    expect(collectEditorValidation(snapshot, 'nope').conditionalFormattings).toEqual([]);
    expect(collectEditorValidation(snapshot, sheetId).conditionalFormattings).toEqual([]);
  });
});

describe('rangeToA1', () => {
  it('formats single cells and rectangular ranges', () => {
    expect(rangeToA1(range(0, 0, 0, 0))).toBe('A1');
    expect(rangeToA1(range(1, 1, 3, 2))).toBe('B2:C4');
    expect(rangeToA1(range(0, 26, 0, 27))).toBe('AA1:AB1');
  });
});

describe('export integration', () => {
  it('writes editor CF/DV into the xlsx', async () => {
    const ExcelJS = (await import('exceljs')).default;
    const { snapshot, sheetId } = workbookWith((id) => ({
      [CF_PLUGIN]: { 'unit-1': { [id]: [cellIs] } },
      [DV_PLUGIN]: {
        'unit-1': {
          [id]: [{ uid: 'dv-1', type: 'list', formula1: '"a,b,c"', ranges: [range(0, 1, 0, 1)] }],
        },
      },
    }));

    const exported = await exportSnapshotToBytes(snapshot);
    expect(exported.ok).toBe(true);
    if (!exported.ok) return;

    const buffer = exported.value.buffer.slice(
      exported.value.byteOffset,
      exported.value.byteOffset + exported.value.byteLength,
    ) as ArrayBuffer;
    const reread = new ExcelJS.Workbook();
    await reread.xlsx.load(buffer);
    const sheet = reread.worksheets[0] as unknown as WorksheetLike;

    const formatting = sheet.conditionalFormattings?.find((item) => item.ref === 'A1:A10');
    expect(formatting?.rules[0]).toMatchObject({ type: 'cellIs', operator: 'greaterThan' });
    expect(sheet.dataValidations?.model?.B1).toMatchObject({ type: 'list' });
    expect(sheetId).toBeTruthy();
  });

  it('reports unsupported rules instead of dropping them silently', () => {
    const { snapshot } = workbookWith((id) => ({
      [CF_PLUGIN]: { 'unit-1': { [id]: [uniqueValues] } },
      [DV_PLUGIN]: {
        'unit-1': { [id]: [{ uid: 'dv-3', type: 'time', ranges: [range(0, 0, 0, 0)] }] },
      },
    }));

    expect(countUnsupportedValidation(snapshot)).toEqual({
      conditionalFormattings: 1,
      dataValidations: 1,
    });
    const issues = collectExportIssues(snapshot);
    expect(issues.find((issue) => issue.code === 'sheet.cfUnsupported')).toMatchObject({
      severity: 'warning',
      count: 1,
    });
    expect(issues.find((issue) => issue.code === 'sheet.dvUnsupported')).toMatchObject({
      severity: 'warning',
      count: 1,
    });
  });
});
