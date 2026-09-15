import { describe, expect, it } from 'vitest';
import {
  MAX_IMPORT_BYTES,
  argbToHex,
  buildExportFilename,
  checkImportFile,
  columnIndexToName,
  columnNameToIndex,
  columnWidthToPx,
  excelStyleToUniver,
  hexToArgb,
  parseCellRef,
  parseMergeRange,
  pxToColumnWidth,
  pxToRowHeight,
  resolveImportKind,
  rowHeightToPx,
  sanitizeFilename,
  summarizeWorkbook,
  univerStyleToExcel,
} from './core';

describe('列名与坐标', () => {
  it('列序号转列名', () => {
    expect(columnIndexToName(0)).toBe('A');
    expect(columnIndexToName(25)).toBe('Z');
    expect(columnIndexToName(26)).toBe('AA');
    expect(columnIndexToName(701)).toBe('ZZ');
  });

  it('非法序号回落到 A', () => {
    expect(columnIndexToName(-1)).toBe('A');
    expect(columnIndexToName(1.5)).toBe('A');
  });

  it('列名转列序号', () => {
    expect(columnNameToIndex('A')).toBe(0);
    expect(columnNameToIndex('z')).toBe(25);
    expect(columnNameToIndex('AA')).toBe(26);
    expect(columnNameToIndex('B3')).toBeNull();
  });

  it('解析 A1 坐标', () => {
    expect(parseCellRef('B3')).toEqual({ row: 2, column: 1 });
    expect(parseCellRef('A1')).toEqual({ row: 0, column: 0 });
    expect(parseCellRef('3B')).toBeNull();
  });
});

describe('parseMergeRange', () => {
  it('解析跨行列合并区', () => {
    expect(parseMergeRange('A1:C3')).toEqual({
      ok: true,
      value: { startRow: 0, startColumn: 0, endRow: 2, endColumn: 2 },
    });
  });

  it('起止倒置时自动纠正', () => {
    const result = parseMergeRange('C3:A1');
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.value).toEqual({ startRow: 0, startColumn: 0, endRow: 2, endColumn: 2 });
  });

  it('非法区间返回错误', () => {
    expect(parseMergeRange('???').ok).toBe(false);
  });
});

describe('颜色转换', () => {
  it('ARGB 转 #RRGGBB', () => {
    expect(argbToHex('FFFF0000')).toBe('#FF0000');
    expect(argbToHex('#00FF00')).toBe('#00FF00');
    expect(argbToHex('xyz')).toBeUndefined();
    expect(argbToHex(undefined)).toBeUndefined();
  });

  it('#RRGGBB 转 ARGB', () => {
    expect(hexToArgb('#FF0000')).toBe('FFFF0000');
    expect(hexToArgb('FF0000')).toBe('FFFF0000');
    expect(hexToArgb(undefined)).toBeUndefined();
  });
});

describe('导入校验', () => {
  it('识别 xlsx / xlsm', () => {
    expect(resolveImportKind('报表.XLSX')).toBe('xlsx');
    expect(resolveImportKind('macro.xlsm')).toBe('xlsx');
  });

  it('旧版 xls / csv 归类为 legacy-xls', () => {
    expect(resolveImportKind('old.xls')).toBe('legacy-xls');
    expect(resolveImportKind('data.csv')).toBe('legacy-xls');
  });

  it('其它扩展名不支持', () => {
    expect(resolveImportKind('a.pdf')).toBe('unsupported');
  });

  it('checkImportFile 的错误分支', () => {
    expect(checkImportFile({ name: 'a.xlsx', size: 1024 })).toEqual({ ok: true, value: 'xlsx' });
    expect(checkImportFile({ name: 'a.xls', size: 1024 })).toEqual({
      ok: false,
      error: 'UNSUPPORTED_LEGACY_XLS',
    });
    expect(checkImportFile({ name: 'a.txt', size: 1024 })).toEqual({
      ok: false,
      error: 'NOT_XLSX',
    });
    const oversized = checkImportFile({ name: 'a.xlsx', size: MAX_IMPORT_BYTES + 1 });
    expect(oversized.ok).toBe(false);
    if (!oversized.ok) expect(oversized.error).toBe('TOO_LARGE');
  });
});

describe('样式双向映射', () => {
  it('ExcelJS 样式转 Univer 样式', () => {
    const style = excelStyleToUniver({
      font: {
        name: 'Arial',
        size: 12,
        bold: true,
        italic: true,
        underline: true,
        color: { argb: 'FFFF0000' },
      },
      fill: { type: 'pattern', fgColor: { argb: 'FF00FF00' } },
      alignment: { horizontal: 'center', vertical: 'middle', wrapText: true },
      numFmt: '0.00',
      border: { top: { style: 'thin', color: { argb: 'FF000000' } } },
    });
    expect(style).toEqual({
      ff: 'Arial',
      fs: 12,
      bl: 1,
      it: 1,
      ul: { s: 1 },
      cl: { rgb: '#FF0000' },
      bg: { rgb: '#00FF00' },
      ht: 2,
      vt: 2,
      tb: 3,
      n: { pattern: '0.00' },
      bd: { t: { s: 1, cl: { rgb: '#000000' } } },
    });
  });

  it('Univer 样式转回 ExcelJS 样式后字段一致', () => {
    const univer = excelStyleToUniver({
      font: { bold: true, size: 14, color: { argb: 'FF123456' } },
      fill: { type: 'pattern', fgColor: { argb: 'FFABCDEF' } },
      alignment: { horizontal: 'right', vertical: 'bottom' },
      numFmt: '#,##0',
    });
    const back = univerStyleToExcel(univer);
    expect(back.font?.bold).toBe(true);
    expect(back.font?.size).toBe(14);
    expect(back.font?.color?.argb).toBe('FF123456');
    expect(back.fill?.fgColor?.argb).toBe('FFABCDEF');
    expect(back.alignment?.horizontal).toBe('right');
    expect(back.alignment?.vertical).toBe('bottom');
    expect(back.numFmt).toBe('#,##0');
  });

  it('空样式不产生多余字段', () => {
    expect(excelStyleToUniver({})).toEqual({});
    expect(univerStyleToExcel({})).toEqual({});
  });

  it('边框线型映射', () => {
    const style = excelStyleToUniver({
      border: { left: { style: 'medium' }, right: { style: 'thick' } },
    });
    expect(style.bd?.l?.s).toBe(8);
    expect(style.bd?.r?.s).toBe(13);
    const back = univerStyleToExcel(style);
    expect(back.border?.left?.style).toBe('medium');
    expect(back.border?.right?.style).toBe('thick');
  });
});

describe('工作簿统计', () => {
  it('统计工作表、行列、单元格与公式', () => {
    const summary = summarizeWorkbook({
      sheetOrder: ['s1', 's2'],
      sheets: {
        s1: {
          cellData: {
            '0': { '0': { v: '姓名' }, '1': { v: '分数' } },
            '1': { '0': { v: '张三' }, '1': { v: 90 } },
          },
        },
        s2: { cellData: { '4': { '2': { f: '=SUM(A1:A3)', v: 6 } } } },
      },
    });
    expect(summary).toEqual({ sheets: 2, rows: 5, columns: 3, cells: 5, formulas: 1 });
  });

  it('空工作簿统计为零', () => {
    expect(summarizeWorkbook({})).toEqual({
      sheets: 0,
      rows: 0,
      columns: 0,
      cells: 0,
      formulas: 0,
    });
  });
});

describe('文件名与单位换算', () => {
  it('清洗文件名', () => {
    expect(sanitizeFilename('2024/报表:Q1?')).toBe('2024报表Q1');
    expect(sanitizeFilename('')).toBe('workbook');
    expect(buildExportFilename('季度报表', 'xlsx')).toBe('季度报表.xlsx');
    expect(buildExportFilename('', 'xlsx')).toBe('workbook.xlsx');
  });

  it('列宽与行高单位换算可往返', () => {
    expect(pxToColumnWidth(70)).toBeCloseTo(10, 1);
    expect(columnWidthToPx(10)).toBe(70);
    expect(pxToRowHeight(20)).toBeCloseTo(15, 1);
    expect(rowHeightToPx(15)).toBe(20);
    expect(pxToColumnWidth(0)).toBeUndefined();
    expect(pxToRowHeight(undefined)).toBeUndefined();
  });
});
