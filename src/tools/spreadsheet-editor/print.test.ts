import { describe, expect, it } from 'vitest';
import {
  buildSheetPrintHtml,
  buildSheetPrintModel,
  DEFAULT_SHEET_PRINT_OPTIONS,
  formatSheetValue,
  paginateSheet,
  resolvePrintRange,
  resolvePrintScale,
  resolveUsedRange,
  type SheetPrintOptions,
} from './print';
import { createEmptySnapshot, type SheetSnapshot, type WorkbookSnapshot } from './xlsx-io';

/** Spreadsheet print layout is pure geometry, so pagination / merges / formatting are asserted directly */

const options = (patch: Partial<SheetPrintOptions> = {}): SheetPrintOptions => ({
  ...DEFAULT_SHEET_PRINT_OPTIONS,
  ...patch,
});

function makeWorkbook(patch: (sheet: SheetSnapshot) => void): {
  snapshot: WorkbookSnapshot;
  id: string;
} {
  const snapshot = createEmptySnapshot('book');
  const id = snapshot.sheetOrder[0];
  const sheet = snapshot.sheets[id];
  patch(sheet);
  return { snapshot, id };
}

describe('resolveUsedRange', () => {
  it('returns null for an empty sheet', () => {
    const { snapshot, id } = makeWorkbook(() => undefined);
    expect(resolveUsedRange(snapshot.sheets[id])).toBeNull();
  });

  it('covers the furthest non-empty cell', () => {
    const { snapshot, id } = makeWorkbook((sheet) => {
      sheet.cellData = { 0: { 0: { v: 'A' } }, 2: { 3: { v: 1 } } };
    });
    expect(resolveUsedRange(snapshot.sheets[id])).toEqual({
      startRow: 0,
      startColumn: 0,
      endRow: 2,
      endColumn: 3,
    });
  });
});

describe('resolvePrintRange', () => {
  it('clamps a selection to the used range', () => {
    const { snapshot, id } = makeWorkbook((sheet) => {
      sheet.cellData = { 0: { 0: { v: 'A' } }, 4: { 2: { v: 'B' } } };
    });
    const range = resolvePrintRange(snapshot.sheets[id], 'selection', {
      startRow: 2,
      startColumn: 1,
      endRow: 99,
      endColumn: 99,
    });
    expect(range).toEqual({ startRow: 2, startColumn: 1, endRow: 4, endColumn: 2 });
  });

  it('falls back to the used range when nothing is selected', () => {
    const { snapshot, id } = makeWorkbook((sheet) => {
      sheet.cellData = { 0: { 0: { v: 'A' } } };
    });
    expect(resolvePrintRange(snapshot.sheets[id], 'selection', null)).toEqual({
      startRow: 0,
      startColumn: 0,
      endRow: 0,
      endColumn: 0,
    });
  });
});

describe('formatSheetValue', () => {
  it('keeps raw values when no number format is set', () => {
    expect(formatSheetValue(1234.5)).toBe('1234.5');
    expect(formatSheetValue('text')).toBe('text');
    expect(formatSheetValue(true)).toBe('TRUE');
    expect(formatSheetValue(null)).toBe('');
  });

  it('applies percent, thousands and date patterns', () => {
    expect(formatSheetValue(0.256, '0.0%')).toBe('25.6%');
    expect(formatSheetValue(1234.5, '#,##0.00')).toBe('1,234.50');
    expect(formatSheetValue(42, '0.00')).toBe('42.00');
    expect(formatSheetValue(45000, 'yyyy-mm-dd')).toBe('2023-03-15');
  });
});

describe('buildSheetPrintModel', () => {
  it('converts column widths and row heights from px to points', () => {
    const { snapshot, id } = makeWorkbook((sheet) => {
      sheet.cellData = { 0: { 0: { v: 'A' } } };
      sheet.columnData = { 0: { w: 100 } };
      sheet.rowData = { 0: { h: 40 } };
    });
    const model = buildSheetPrintModel(snapshot, id, null);
    expect(model?.columns[0].width).toBeCloseTo(75, 5);
    expect(model?.rows[0].height).toBeCloseTo(30, 5);
    expect(model?.width).toBeCloseTo(75, 5);
  });

  it('marks merged anchors with spans and skips covered cells', () => {
    const { snapshot, id } = makeWorkbook((sheet) => {
      sheet.cellData = { 0: { 0: { v: 'M' }, 1: { v: 'covered' } }, 1: { 0: { v: 'x' } } };
      sheet.mergeData = [{ startRow: 0, startColumn: 0, endRow: 1, endColumn: 1 }];
    });
    const model = buildSheetPrintModel(snapshot, id, null);
    const anchor = model?.cells.find((cell) => cell.row === 0 && cell.col === 0);
    expect(anchor?.rowSpan).toBe(2);
    expect(anchor?.colSpan).toBe(2);
    expect(model?.cells.some((cell) => cell.row === 0 && cell.col === 1)).toBe(false);
  });

  it('carries cell style into the print cell', () => {
    const { snapshot, id } = makeWorkbook((sheet) => {
      sheet.cellData = {
        0: { 0: { v: 'S', s: { bl: 1, bg: { rgb: '#FF0000' }, ht: 2, fs: 14 } } },
      };
    });
    const cell = buildSheetPrintModel(snapshot, id, null)?.cells[0];
    expect(cell).toMatchObject({
      text: 'S',
      bold: true,
      background: '#FF0000',
      align: 'center',
      fontSize: 14,
    });
  });

  it('returns null for a workbook with no content', () => {
    const { snapshot, id } = makeWorkbook(() => undefined);
    expect(buildSheetPrintModel(snapshot, id, null)).toBeNull();
  });
});

describe('paginateSheet', () => {
  it('fits everything on one page in fit mode', () => {
    const { snapshot, id } = makeWorkbook((sheet) => {
      const row: Record<string, { v: string }> = {};
      for (let col = 0; col < 12; col += 1) row[String(col)] = { v: `c${col}` };
      sheet.cellData = { 0: row };
    });
    const model = buildSheetPrintModel(snapshot, id, null);
    expect(model).not.toBeNull();
    const pages = paginateSheet(model!, options({ scale: 'fit' }));
    expect(pages).toHaveLength(1);
    expect(pages[0].columns).toHaveLength(12);
  });

  it('splits columns instead of shrinking past the 50% floor', () => {
    const { snapshot, id } = makeWorkbook((sheet) => {
      const row: Record<string, { v: string }> = {};
      for (let col = 0; col < 40; col += 1) row[String(col)] = { v: `c${col}` };
      sheet.cellData = { 0: row };
    });
    const model = buildSheetPrintModel(snapshot, id, null)!;
    // 40 × 48pt 缩到一页要 27%，字会糊成灰条：这里只能缩到 50%，其余靠分列
    expect(resolvePrintScale(model, options({ scale: 'fit' }))).toBeCloseTo(0.5, 5);
    const pages = paginateSheet(model, options({ scale: 'fit' }));
    expect(pages.length).toBeGreaterThan(1);
    expect(new Set(pages.flatMap((page) => page.columns)).size).toBe(40);
  });

  it('splits columns into bands at actual size', () => {
    const { snapshot, id } = makeWorkbook((sheet) => {
      const row: Record<string, { v: string }> = {};
      for (let col = 0; col < 20; col += 1) row[String(col)] = { v: `c${col}` };
      sheet.cellData = { 0: row };
    });
    const model = buildSheetPrintModel(snapshot, id, null);
    const pages = paginateSheet(model!, options({ scale: 'actual' }));
    expect(pages.length).toBeGreaterThan(1);
    // Every column appears exactly once across the bands of the first row band
    const firstBand = pages.filter((page) => !page.repeatedHeader).flatMap((page) => page.columns);
    expect(new Set(firstBand).size).toBe(20);
  });

  it('repeats the header row on every following page', () => {
    const { snapshot, id } = makeWorkbook((sheet) => {
      const cellData: Record<string, Record<string, { v: string }>> = {};
      for (let row = 0; row < 90; row += 1) cellData[String(row)] = { 0: { v: `r${row}` } };
      sheet.cellData = cellData;
    });
    const model = buildSheetPrintModel(snapshot, id, null);
    const pages = paginateSheet(model!, options({ scale: 'actual', repeatHeaderRow: true }));
    expect(pages.length).toBeGreaterThan(1);
    expect(pages[1].repeatedHeader).toBe(true);
    expect(pages[1].rows[0]).toBe(0);
    // No row is printed twice except the repeated header
    const body = pages.flatMap((page) => (page.repeatedHeader ? page.rows.slice(1) : page.rows));
    expect(new Set(body).size).toBe(body.length);
  });

  it('does not repeat the header when the option is off', () => {
    const { snapshot, id } = makeWorkbook((sheet) => {
      const cellData: Record<string, Record<string, { v: string }>> = {};
      for (let row = 0; row < 90; row += 1) cellData[String(row)] = { 0: { v: `r${row}` } };
      sheet.cellData = cellData;
    });
    const model = buildSheetPrintModel(snapshot, id, null);
    const pages = paginateSheet(model!, options({ scale: 'actual', repeatHeaderRow: false }));
    expect(pages.every((page) => !page.repeatedHeader)).toBe(true);
  });
});

describe('buildSheetPrintHtml', () => {
  it('emits one section and one table per page', () => {
    const { snapshot, id } = makeWorkbook((sheet) => {
      sheet.cellData = { 0: { 0: { v: 'A' }, 1: { v: 'B' } } };
    });
    const model = buildSheetPrintModel(snapshot, id, null)!;
    const pages = paginateSheet(model, options());
    const html = buildSheetPrintHtml(model, pages, options(), 'report');
    expect(html.match(/class="print-page"/g)).toHaveLength(pages.length);
    expect(html.match(/<table/g)).toHaveLength(pages.length);
    expect(html).toContain('report');
    expect(html).toContain('@page');
  });

  it('sizes every page table from its own column band', () => {
    const { snapshot, id } = makeWorkbook((sheet) => {
      const row: Record<string, { v: string }> = {};
      for (let col = 0; col < 40; col += 1) row[String(col)] = { v: `c${col}` };
      sheet.cellData = { 0: row };
    });
    const model = buildSheetPrintModel(snapshot, id, null)!;
    const opts = options({ scale: 'fit' });
    const html = buildSheetPrintHtml(model, paginateSheet(model, opts), opts);
    const widths = [...html.matchAll(/<table class="sheet-table" style="width:([\d.]+)pt/g)].map(
      (match) => Number(match[1]),
    );
    // 每页一张自己的表：宽度按带算，且都不超过版心（否则右边的列会被 overflow 裁掉）
    const contentWidth = 595.28 - opts.margin * 2;
    expect(widths.length).toBeGreaterThan(1);
    for (const width of widths) expect(width).toBeLessThanOrEqual(contentWidth + 0.01);
    // 40 列全部出现在某一页里，没有列被丢掉
    expect(html.match(/<col style/g)).toHaveLength(40);
  });

  it('escapes cell text', () => {
    const { snapshot, id } = makeWorkbook((sheet) => {
      sheet.cellData = { 0: { 0: { v: '<script>' } } };
    });
    const model = buildSheetPrintModel(snapshot, id, null)!;
    const html = buildSheetPrintHtml(model, paginateSheet(model, options()), options());
    expect(html).toContain('&lt;script&gt;');
    expect(html).not.toContain('<script>');
  });
});
