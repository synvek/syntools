import { describe, expect, it } from 'vitest';
import { exportSnapshotToBytes, importXlsxToSnapshot } from './xlsx-io';
import {
  applySheetExtras,
  collectSheetExtras,
  countExtras,
  readWorkbookExtras,
  withWorkbookExtras,
  type WorksheetExtrasLike,
} from './xlsx-extras';

const fakeFile = (buffer: ArrayBuffer, name: string): File =>
  ({ name, size: buffer.byteLength, arrayBuffer: async () => buffer }) as unknown as File;

const toArrayBuffer = (bytes: Uint8Array): ArrayBuffer =>
  bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength) as ArrayBuffer;

describe('xlsx-extras 纯逻辑', () => {
  it('无附加内容时返回 null', () => {
    expect(collectSheetExtras({ name: 'S' })).toBeNull();
    expect(collectSheetExtras({ name: 'S', dataValidations: { model: {} } })).toBeNull();
  });

  it('收集条件格式与数据验证', () => {
    const worksheet: WorksheetExtrasLike = {
      name: 'S',
      conditionalFormattings: [{ ref: 'A1:A2', rules: [] }],
      dataValidations: { model: { B1: { type: 'list', formulae: ['"x"'] } } },
    };
    expect(collectSheetExtras(worksheet)).toEqual({
      conditionalFormattings: [{ ref: 'A1:A2', rules: [] }],
      dataValidations: { B1: { type: 'list', formulae: ['"x"'] } },
    });
  });

  it('写回 exceljs 工作表', () => {
    const added: unknown[] = [];
    const assigned: Record<string, unknown> = {};
    const worksheet = {
      name: 'S',
      addConditionalFormatting: (cf: unknown) => added.push(cf),
      getCell: (address: string) => ({
        set dataValidation(value: unknown) {
          assigned[address] = value;
        },
      }),
    };
    applySheetExtras(worksheet as never, {
      conditionalFormattings: [{ ref: 'A1', rules: [] }],
      dataValidations: { B2: { type: 'whole', formulae: [1, 5] } },
    });
    expect(added).toHaveLength(1);
    expect(assigned.B2).toEqual({ type: 'whole', formulae: [1, 5] });
  });

  it('快照自有字段读写与损坏兜底', () => {
    const base = { id: 'w' };
    const snapshot = withWorkbookExtras(base, {
      version: 1,
      sheets: { S: { dataValidations: { A1: { type: 'list', formulae: [] } } } },
    });
    expect(readWorkbookExtras(snapshot)?.sheets.S.dataValidations).toBeTruthy();
    // 空内容：移除字段，恢复为原对象形态
    expect(withWorkbookExtras(snapshot, { version: 1, sheets: {} })).toEqual(base);
    // 损坏 / 缺失
    expect(readWorkbookExtras(undefined)).toBeNull();
    expect(readWorkbookExtras({})).toBeNull();
    expect(readWorkbookExtras({ syntoolsExtras: { version: 2, sheets: {} } as never })).toBeNull();
    expect(readWorkbookExtras({ syntoolsExtras: { version: 1 } as never })).toBeNull();
  });

  it('无内容时不新增字段', () => {
    const base = { id: 'w' };
    expect(withWorkbookExtras(base, { version: 1, sheets: {} })).toBe(base);
    expect(withWorkbookExtras(base, null)).toBe(base);
  });

  it('统计规模', () => {
    expect(
      countExtras({
        version: 1,
        sheets: {
          A: {
            conditionalFormattings: [
              { ref: 'A1', rules: [] },
              { ref: 'B1', rules: [] },
            ],
          },
          B: { dataValidations: { C1: { type: 'list', formulae: [] } } },
        },
      }),
    ).toEqual({ conditionalFormattings: 2, dataValidations: 1 });
    expect(countExtras(null)).toEqual({ conditionalFormattings: 0, dataValidations: 0 });
  });
});

describe('条件格式 / 数据验证：xlsx 往返保留', () => {
  it('导入后存于快照自有字段，导出时写回文件', async () => {
    const ExcelJS = (await import('exceljs')).default;
    const workbook = new ExcelJS.Workbook();
    const worksheet = workbook.addWorksheet('Data');
    worksheet.getCell('A1').value = 1;
    worksheet.addConditionalFormatting({
      ref: 'A1:A10',
      rules: [
        {
          type: 'cellIs',
          operator: 'greaterThan',
          formulae: [5],
          priority: 1,
          style: { fill: { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFFF0000' } } },
        },
      ] as never,
    });
    worksheet.getCell('B1').dataValidation = {
      type: 'list',
      allowBlank: true,
      formulae: ['"a,b,c"'],
    } as never;
    const buffer = (await workbook.xlsx.writeBuffer()) as ArrayBuffer;

    const imported = await importXlsxToSnapshot(fakeFile(buffer, 'cf.xlsx'));
    expect(imported.ok).toBe(true);
    if (!imported.ok) return;
    expect(countExtras(readWorkbookExtras(imported.value))).toEqual({
      conditionalFormattings: 1,
      dataValidations: 1,
    });

    const exported = await exportSnapshotToBytes(imported.value);
    expect(exported.ok).toBe(true);
    if (!exported.ok) return;

    const reread = new ExcelJS.Workbook();
    await reread.xlsx.load(toArrayBuffer(exported.value));
    const sheet = reread.worksheets[0] as unknown as WorksheetExtrasLike;
    expect(sheet.conditionalFormattings?.[0].ref).toBe('A1:A10');
    expect(sheet.conditionalFormattings?.[0].rules[0].type).toBe('cellIs');
    expect(sheet.dataValidations?.model?.B1.type).toBe('list');
  });

  it('普通文件不产生 extras 字段', async () => {
    const ExcelJS = (await import('exceljs')).default;
    const workbook = new ExcelJS.Workbook();
    workbook.addWorksheet('Data').getCell('A1').value = 'plain';
    const buffer = (await workbook.xlsx.writeBuffer()) as ArrayBuffer;

    const imported = await importXlsxToSnapshot(fakeFile(buffer, 'plain.xlsx'));
    expect(imported.ok).toBe(true);
    if (!imported.ok) return;
    expect(imported.value.syntoolsExtras).toBeUndefined();
  });
});
