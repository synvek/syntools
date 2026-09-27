import { describe, expect, it } from 'vitest';
import type { Worksheet } from 'exceljs';
import {
  createEmptySheet,
  createEmptySnapshot,
  exportSnapshotToBytes,
  importXlsxToSnapshot,
  type WorkbookSnapshot,
} from './xlsx-io';

/** Uint8Array → 独立 ArrayBuffer（exceljs 的 load 需要完整缓冲区） */
const toArrayBuffer = (bytes: Uint8Array): ArrayBuffer =>
  bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength) as ArrayBuffer;

/** 构造一个满足 checkImportFile / arrayBuffer() 契约的 File 替身（jsdom 下无需真实 File） */
const fakeFile = (buffer: ArrayBuffer, name: string): File =>
  ({ name, size: buffer.byteLength, arrayBuffer: async () => buffer }) as unknown as File;

const loadExcel = async (bytes: Uint8Array) => {
  const ExcelJS = (await import('exceljs')).default;
  const workbook = new ExcelJS.Workbook();
  await workbook.xlsx.load(toArrayBuffer(bytes));
  return workbook;
};

describe('xlsx 结构保真：导出', () => {
  it('隐藏表 / 网格线 / RTL / 标签色 / 冻结窗格写入文件', async () => {
    const base = createEmptySnapshot('book');
    const visible = createEmptySheet('a', '明细');
    visible.cellData = { '0': { '0': { v: 'x' } } };
    visible.showGridlines = 0;
    visible.rightToLeft = 1;
    visible.tabColor = '#ff0000';
    visible.freeze = { xSplit: 1, ySplit: 2, startRow: 2, startColumn: 1 };
    const hidden = createEmptySheet('b', '隐藏表');
    hidden.hidden = 1;
    const snapshot: WorkbookSnapshot = {
      ...base,
      sheetOrder: ['a', 'b'],
      sheets: { a: visible, b: hidden },
    };

    const result = await exportSnapshotToBytes(snapshot);
    expect(result.ok).toBe(true);
    if (!result.ok) return;

    const workbook = await loadExcel(result.value);
    const [first, second] = workbook.worksheets;
    expect(first.name).toBe('明细');
    expect(first.state).toBe('visible');
    expect(first.views[0]).toMatchObject({ state: 'frozen', xSplit: 1, ySplit: 2 });
    expect(first.views[0]?.showGridLines).toBe(false);
    expect(first.views[0]?.rightToLeft).toBe(true);
    expect(first.properties.tabColor?.argb).toBe('FFFF0000');
    expect(second.state).toBe('hidden');
  });

  it('全部隐藏时强制保留一张可见工作表（Excel 硬性要求）', async () => {
    const base = createEmptySnapshot('book');
    const a = createEmptySheet('a', 'A');
    a.hidden = 1;
    const b = createEmptySheet('b', 'B');
    b.hidden = 1;
    const snapshot: WorkbookSnapshot = {
      ...base,
      sheetOrder: ['a', 'b'],
      sheets: { a, b },
    };

    const result = await exportSnapshotToBytes(snapshot);
    expect(result.ok).toBe(true);
    if (!result.ok) return;

    const workbook = await loadExcel(result.value);
    expect(workbook.worksheets.map((sheet) => sheet.state)).toEqual(['visible', 'hidden']);
  });

  it('无额外视图设置时不写入 views（避免无谓改动）', async () => {
    const snapshot = createEmptySnapshot('plain');
    const sheet = snapshot.sheets[snapshot.sheetOrder[0]];
    sheet.cellData = { '0': { '0': { v: 1 } } };

    const result = await exportSnapshotToBytes(snapshot);
    expect(result.ok).toBe(true);
    if (!result.ok) return;

    const workbook = await loadExcel(result.value);
    // 未写入 views 时 exceljs 读回 undefined
    expect(workbook.worksheets[0].views ?? []).toHaveLength(0);
    expect(workbook.worksheets[0].state).toBe('visible');
  });
});

describe('xlsx 结构保真：导入', () => {
  it('还原隐藏表 / 网格线 / RTL / 标签色 / 冻结窗格', async () => {
    const ExcelJS = (await import('exceljs')).default;
    const workbook = new ExcelJS.Workbook();
    const data = workbook.addWorksheet('明细');
    data.getCell('A1').value = 'x';
    data.views = [
      { state: 'frozen', xSplit: 1, ySplit: 2, showGridLines: false, rightToLeft: true },
    ];
    data.properties.tabColor = { argb: 'FFFF0000' };
    const hidden = workbook.addWorksheet('隐藏表');
    hidden.state = 'hidden';
    const buffer = (await workbook.xlsx.writeBuffer()) as ArrayBuffer;

    const result = await importXlsxToSnapshot(fakeFile(buffer, 'book.xlsx'));
    expect(result.ok).toBe(true);
    if (!result.ok) return;

    const { sheetOrder, sheets } = result.value;
    expect(sheetOrder).toHaveLength(2);
    const first = sheets[sheetOrder[0]];
    expect(first.name).toBe('明细');
    expect(first.hidden).toBe(0);
    expect(first.showGridlines).toBe(0);
    expect(first.rightToLeft).toBe(1);
    expect(first.tabColor).toBe('#FF0000');
    expect(first.freeze).toMatchObject({ xSplit: 1, ySplit: 2 });
    expect(sheets[sheetOrder[1]].hidden).toBe(1);
  });

  it('veryHidden 也归一为隐藏', async () => {
    const ExcelJS = (await import('exceljs')).default;
    const workbook = new ExcelJS.Workbook();
    workbook.addWorksheet('可见').getCell('A1').value = 1;
    workbook.addWorksheet('深隐藏').state = 'veryHidden';
    const buffer = (await workbook.xlsx.writeBuffer()) as ArrayBuffer;

    const result = await importXlsxToSnapshot(fakeFile(buffer, 'book.xlsx'));
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.value.sheets[result.value.sheetOrder[1]].hidden).toBe(1);
  });
});

describe('xlsx 单元格内容保真：往返', () => {
  /** 用 exceljs 构造含指定单元格的源文件 */
  const buildCellWorkbook = async (fill: (worksheet: Worksheet) => void): Promise<ArrayBuffer> => {
    const ExcelJS = (await import('exceljs')).default;
    const workbook = new ExcelJS.Workbook();
    fill(workbook.addWorksheet('Data'));
    return (await workbook.xlsx.writeBuffer()) as ArrayBuffer;
  };

  /** 导入 → 导出 → 再导入，返回两次导入的 A1 单元格（验证往返不丢内容） */
  const roundTripCell = async (buffer: ArrayBuffer) => {
    const cellOf = (snapshot: WorkbookSnapshot) =>
      snapshot.sheets[snapshot.sheetOrder[0]].cellData['0']?.['0'];

    const first = await importXlsxToSnapshot(fakeFile(buffer, 'book.xlsx'));
    if (!first.ok) throw new Error(`import failed: ${first.error}`);
    const bytes = await exportSnapshotToBytes(first.value);
    if (!bytes.ok) throw new Error(`export failed: ${bytes.error}`);
    const second = await importXlsxToSnapshot(fakeFile(toArrayBuffer(bytes.value), 'book.xlsx'));
    if (!second.ok) throw new Error(`re-import failed: ${second.error}`);

    return { first: cellOf(first.value), second: cellOf(second.value) };
  };

  it('日期：保留序列号与日期格式', async () => {
    const buffer = await buildCellWorkbook((worksheet) => {
      const cell = worksheet.getCell('A1');
      cell.value = new Date(Date.UTC(2024, 0, 15));
      cell.numFmt = 'yyyy-mm-dd';
    });
    const { first, second } = await roundTripCell(buffer);
    // 2024-01-15 → 45306
    expect(Number(first?.v)).toBeCloseTo(45306, 6);
    expect(first?.s?.n?.pattern).toBe('yyyy-mm-dd');
    expect(Number(second?.v)).toBeCloseTo(45306, 6);
    expect(second?.s?.n?.pattern).toBe('yyyy-mm-dd');
  });

  it('错误值：保留文本与错误语义', async () => {
    const buffer = await buildCellWorkbook((worksheet) => {
      worksheet.getCell('A1').value = { error: '#VALUE!' } as never;
    });
    const { first, second } = await roundTripCell(buffer);
    expect(first?.v).toBe('#VALUE!');
    expect(first?.custom?.error).toBe('#VALUE!');
    expect(second?.custom?.error).toBe('#VALUE!');
  });

  it('超链接：保留 URL 与显示文本', async () => {
    const buffer = await buildCellWorkbook((worksheet) => {
      worksheet.getCell('A1').value = {
        text: 'Example',
        hyperlink: 'https://example.com',
      } as never;
    });
    const { first, second } = await roundTripCell(buffer);
    expect(first?.v).toBe('Example');
    expect(first?.custom?.hyperlink).toEqual({ url: 'https://example.com', text: 'Example' });
    expect(second?.custom?.hyperlink?.url).toBe('https://example.com');
  });

  it('批注：保留备注文本', async () => {
    const buffer = await buildCellWorkbook((worksheet) => {
      const cell = worksheet.getCell('A1');
      cell.value = 'x';
      cell.note = '这是一条批注';
    });
    const { first, second } = await roundTripCell(buffer);
    expect(first?.custom?.note).toBe('这是一条批注');
    expect(second?.custom?.note).toBe('这是一条批注');
  });

  it('单元格富文本：保留局部加粗', async () => {
    const buffer = await buildCellWorkbook((worksheet) => {
      worksheet.getCell('A1').value = {
        richText: [{ text: 'Hello', font: { bold: true } }, { text: ' world' }],
      } as never;
    });
    const { first, second } = await roundTripCell(buffer);
    expect(first?.v).toBe('Hello world');
    expect(first?.p?.body.textRuns).toEqual([{ st: 0, ed: 5, ts: { bl: 1 } }]);
    expect(second?.v).toBe('Hello world');
    expect(second?.p?.body.textRuns).toEqual([{ st: 0, ed: 5, ts: { bl: 1 } }]);
  });
});
