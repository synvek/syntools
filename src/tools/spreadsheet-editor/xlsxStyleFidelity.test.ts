import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import {
  exportSnapshotToBytes,
  importXlsxToSnapshot,
  type CellSnapshot,
  type SheetSnapshot,
  type WorkbookSnapshot,
} from './xlsx-io';
import { applyTint, parseThemePalette, resolveThemeColor } from './xlsx-theme';
import { estimateTextWidth, shrinkFontSize } from './textMeasure';

/**
 * 字体 / 对齐保真：samples/xlsx-feature-sample-excel-cn.xlsx 的"字体对照区"就是验收表，每一格都写着
 * 它要验证的特性。这些行以前会静默丢样式（主题色变默认色、上标下标变普通字、旋转不转、双下划线退化成
 * 单线），所以直接按单元格断言，比断言中间结构更贴近用户看到的东西。
 */

const SAMPLE = join(process.cwd(), 'samples/xlsx-feature-sample-excel-cn.xlsx');

function fakeFile(bytes: Uint8Array, name: string): File {
  const buffer = bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength);
  return { name, size: bytes.byteLength, arrayBuffer: async () => buffer } as unknown as File;
}

async function importSample(): Promise<WorkbookSnapshot> {
  const imported = await importXlsxToSnapshot(
    fakeFile(new Uint8Array(readFileSync(SAMPLE)), 'sample.xlsx'),
  );
  if (!imported.ok) throw new Error(imported.error);
  return imported.value;
}

function sheetByName(snapshot: WorkbookSnapshot, name: string): SheetSnapshot {
  const sheet = Object.values(snapshot.sheets).find((item) => item.name === name);
  if (!sheet) throw new Error(`missing sheet ${name}`);
  return sheet;
}

function cellAt(sheet: SheetSnapshot, ref: string): CellSnapshot | undefined {
  const column = String(ref.charCodeAt(0) - 65);
  const row = String(Number(ref.slice(1)) - 1);
  return sheet.cellData[row]?.[column];
}

async function loadExcel(bytes: Uint8Array) {
  const ExcelJS = (await import('exceljs')).default;
  const workbook = new ExcelJS.Workbook();
  await workbook.xlsx.load(bytes.buffer.slice(0) as ArrayBuffer);
  return workbook;
}

describe('主题色板', () => {
  it('按 OOXML 顺序解析 clrScheme，系统色取 lastClr', () => {
    const palette = parseThemePalette(`<?xml version="1.0"?>
      <a:theme xmlns:a="http://schemas.openxmlformats.org/drawingml/2006/main">
        <a:themeElements><a:clrScheme name="Office">
          <a:dk1><a:sysClr val="windowText" lastClr="000000"/></a:dk1>
          <a:lt1><a:sysClr val="window" lastClr="FFFFFF"/></a:lt1>
          <a:dk2><a:srgbClr val="44546A"/></a:dk2>
          <a:lt2><a:srgbClr val="E7E6E6"/></a:lt2>
          <a:accent1><a:srgbClr val="156082"/></a:accent1>
          <a:accent2><a:srgbClr val="E97132"/></a:accent2>
          <a:accent3><a:srgbClr val="196B24"/></a:accent3>
          <a:accent4><a:srgbClr val="0F9ED5"/></a:accent4>
          <a:accent5><a:srgbClr val="A02B93"/></a:accent5>
          <a:accent6><a:srgbClr val="4EA72E"/></a:accent6>
          <a:hlink><a:srgbClr val="467886"/></a:hlink>
          <a:folHlink><a:srgbClr val="96607D"/></a:folHlink>
        </a:clrScheme></a:themeElements>
      </a:theme>`);
    expect(palette?.[0]).toBe('#000000');
    expect(palette?.[1]).toBe('#FFFFFF');
    expect(palette?.[4]).toBe('#156082');
    expect(resolveThemeColor(palette, 4)).toBe('#156082');
  });

  it('无法解析时不返回调色板，而不是返回半张表', () => {
    expect(parseThemePalette('<a:theme/>')).toBeUndefined();
    expect(resolveThemeColor(undefined, 4)).toBeUndefined();
  });

  it('tint 按 Excel 语义向黑 / 向白混合', () => {
    expect(applyTint('#FFFFFF', -1)).toBe('#000000');
    expect(applyTint('#000000', 0.5)).toBe('#808080');
    expect(applyTint('#156082', undefined)).toBe('#156082');
    // 真实文件里的常见写法：accent1 加深 25%
    expect(applyTint('#156082', -0.249977111117893)).toBe('#104862');
  });
});

describe('缩小字体填充的测量', () => {
  it('放得下就不缩，放不下按比例缩到刚好', () => {
    const measure = (text: string, fontPt: number) => estimateTextWidth(text, fontPt);
    expect(shrinkFontSize('短', 11, undefined, 200, measure)).toBeNull();
    const shrunk = shrinkFontSize('很长很长的一段文字', 12, undefined, 40, measure);
    expect(shrunk).not.toBeNull();
    expect(shrunk as number).toBeLessThan(12);
    expect(shrunk as number).toBeGreaterThan(0);
  });

  it('空文本 / 非法尺寸返回 null', () => {
    const measure = () => 100;
    expect(shrinkFontSize('', 12, undefined, 40, measure)).toBeNull();
    expect(shrinkFontSize('x', 0, undefined, 40, measure)).toBeNull();
    expect(shrinkFontSize('x', 12, undefined, 0, measure)).toBeNull();
  });
});

describe('样例文件样式导入', () => {
  it('自定义字体色 / 主题色 / 上标下标 / 旋转 / 竖排 / 双下划线 / 缩小填充', async () => {
    const snapshot = await importSample();
    const sheet = sheetByName(snapshot, '字体对照区');

    expect(cellAt(sheet, 'A3')?.s?.cl).toEqual({ rgb: '#C00000' });
    expect(cellAt(sheet, 'B3')?.s?.cl).toEqual({ rgb: '#156082' });
    expect(cellAt(sheet, 'D3')?.s?.va).toBe(3);
    expect(cellAt(sheet, 'E3')?.s?.va).toBe(2);
    expect(cellAt(sheet, 'A6')?.s?.tr).toEqual({ a: -45 });
    expect(cellAt(sheet, 'B6')?.s?.tr).toEqual({ a: -90 });
    expect(cellAt(sheet, 'C6')?.s?.tr).toEqual({ a: 0, v: 1 });
    expect(cellAt(sheet, 'F2')?.s?.ul).toEqual({ s: 1, t: 10 });

    const shrink = cellAt(sheet, 'D6');
    expect(shrink?.custom?.shrinkToFit?.fs).toBe(12);
    expect(shrink?.s?.tb).toBe(2);
    expect(shrink?.s?.fs).toBeLessThan(12);
  }, 120_000);

  it('导出把字号 / 上标下标 / 旋转 / 双下划线 / 缩小填充写回文件', async () => {
    const snapshot = await importSample();
    const exported = await exportSnapshotToBytes(snapshot);
    expect(exported.ok).toBe(true);
    if (!exported.ok) return;

    const workbook = await loadExcel(exported.value);
    const sheet = workbook.getWorksheet('字体对照区');
    expect(sheet).toBeTruthy();

    expect(sheet?.getCell('A3').font.color?.argb).toBe('FFC00000');
    expect(sheet?.getCell('B3').font.color?.argb).toBe('FF156082');
    expect(sheet?.getCell('D3').font.vertAlign).toBe('superscript');
    expect(sheet?.getCell('E3').font.vertAlign).toBe('subscript');
    expect(sheet?.getCell('A6').alignment?.textRotation).toBe(45);
    expect(sheet?.getCell('B6').alignment?.textRotation).toBe(90);
    expect(sheet?.getCell('C6').alignment?.textRotation).toBe('vertical');
    expect(sheet?.getCell('F2').font.underline).toBe('double');

    // 缩小填充：字号写回原值 + shrinkToFit 标记，由 Excel 自己缩
    const shrink = sheet?.getCell('D6');
    expect(shrink?.alignment?.shrinkToFit).toBe(true);
    expect(shrink?.font.size).toBe(12);
  }, 120_000);
});
