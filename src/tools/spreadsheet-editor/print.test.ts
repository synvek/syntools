import { describe, expect, it } from 'vitest';
import {
  buildSheetPrintHtml,
  buildSheetPrintModel,
  DEFAULT_SHEET_PRINT_OPTIONS,
  formatSheetValue,
  paginateSheet,
  resolvePageRect,
  resolvePrintModelOptions,
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

/**
 * P1-6 打印含对象：图片 / 图表 / 形状要跟着纸面走。
 *
 * 这里的坐标全部按"pt、原点 = 打印范围左上角"断言，因为对象一旦错位，
 * 用户看到的是"图跑到别的页上去了"，而不是一条可以忽略的告警。
 */
describe('浮动对象（P1-6）', () => {
  // 默认列宽 93px、行高 27px、行头 46px、列头 20px，px → pt 系数 0.75
  const COL_PX = 93;
  const ROW_PX = 27;
  const PX_TO_PT = 0.75;
  const ROW_HEADER = 46;
  const COL_HEADER = 20;

  function makeBook(
    patch: (book: WorkbookSnapshot) => void,
    cellRows = [0],
  ): { snapshot: WorkbookSnapshot; id: string } {
    const snapshot = createEmptySnapshot('book');
    const id = snapshot.sheetOrder[0];
    snapshot.sheets[id].cellData = {};
    for (const row of cellRows) snapshot.sheets[id].cellData[String(row)] = { 0: { v: 'x' } };
    patch(snapshot);
    return { snapshot, id };
  }

  const image = (sheetId: string) => ({
    id: 'img-1',
    sheetId,
    from: { col: 1, row: 1, colOff: 0, rowOff: 0 },
    width: 100,
    height: 80,
    src: 'data:image/png;base64,AAA',
    name: 'logo.png',
    z: 1,
  });

  const chart = (sheetId: string) => ({
    id: 'chart-1',
    type: 'bar' as const,
    sheetId,
    range: { startRow: 0, startColumn: 0, endRow: 2, endColumn: 1 },
    // 图表坐标以工作表左上角（含行头 / 列头）为原点，与导出侧 computeAnchor 一致
    x: ROW_HEADER + COL_PX,
    y: COL_HEADER + ROW_PX,
    width: 320,
    height: 200,
  });

  it('图片按列宽行高换算成 pt', () => {
    const { snapshot, id } = makeBook((book) => {
      book.syntoolsImages = [image(book.sheetOrder[0])];
    });
    const model = buildSheetPrintModel(snapshot, id, null)!;
    expect(model.objects).toHaveLength(1);
    expect(model.objects[0]).toMatchObject({
      kind: 'image',
      x: COL_PX * PX_TO_PT,
      y: ROW_PX * PX_TO_PT,
      width: 100 * PX_TO_PT,
      height: 80 * PX_TO_PT,
      src: 'data:image/png;base64,AAA',
    });
  });

  it('形状保留外观（形状不转位图，缩放后仍然清晰）', () => {
    const { snapshot, id } = makeBook((book) => {
      book.syntoolsShapes = [
        {
          id: 'shape-1',
          prst: 'rect',
          sheetId: book.sheetOrder[0],
          from: { col: 2, row: 2, colOff: 0, rowOff: 0 },
          width: 120,
          height: 60,
          fill: '#FFD966',
          stroke: '#BF9000',
          strokeWidth: 2,
          text: '标题',
          z: 1,
        },
      ];
    });
    const model = buildSheetPrintModel(snapshot, id, null)!;
    expect(model.objects[0]).toMatchObject({
      kind: 'shape',
      x: COL_PX * 2 * PX_TO_PT,
      y: ROW_PX * 2 * PX_TO_PT,
      fill: '#FFD966',
      stroke: '#BF9000',
      strokeWidth: 2,
      text: '标题',
    });
  });

  it('图表坐标要减掉行列头（导出侧口径一致）', () => {
    const { snapshot, id } = makeBook((book) => {
      book.syntoolsCharts = [chart(book.sheetOrder[0])];
    });
    const model = buildSheetPrintModel(snapshot, id, null, {
      chartImages: { 'chart-1': 'data:image/png;base64,CHART' },
    })!;
    expect(model.objects[0]).toMatchObject({
      kind: 'chart',
      x: COL_PX * PX_TO_PT,
      y: ROW_PX * PX_TO_PT,
      width: 320 * PX_TO_PT,
      height: 200 * PX_TO_PT,
      src: 'data:image/png;base64,CHART',
    });
  });

  it('没有位图的图表整块跳过（不画一个空框）', () => {
    const { snapshot, id } = makeBook((book) => {
      book.syntoolsCharts = [chart(book.sheetOrder[0])];
    });
    expect(buildSheetPrintModel(snapshot, id, null)!.objects).toEqual([]);
  });

  it('别的表上的对象不会出现在这张表的打印件里', () => {
    const { snapshot, id } = makeBook((book) => {
      book.syntoolsImages = [image('other-sheet')];
    });
    expect(buildSheetPrintModel(snapshot, id, null)!.objects).toEqual([]);
  });

  it('打印选区时对象跟着范围平移', () => {
    const { snapshot, id } = makeBook(
      (book) => {
        book.syntoolsImages = [image(book.sheetOrder[0])];
      },
      [0, 1, 2],
    );
    const model = buildSheetPrintModel(snapshot, id, {
      startRow: 1,
      startColumn: 1,
      endRow: 2,
      endColumn: 3,
    })!;
    // 图片锚在 B2，正好是选区左上角 → 打印件里应当从 0,0 开始
    expect(model.objects[0]).toMatchObject({ x: 0, y: 0 });
  });

  it('includeObjects: false 时模型里没有对象（留给"不打印对象"的开关）', () => {
    const { snapshot, id } = makeBook((book) => {
      book.syntoolsImages = [image(book.sheetOrder[0])];
    });
    expect(buildSheetPrintModel(snapshot, id, null, { includeObjects: false })!.objects).toEqual(
      [],
    );
  });

  it('页面矩形：重复表头的那一页从正文第一行开始', () => {
    const rows = Array.from({ length: 40 }, (_, index) => index);
    const { snapshot, id } = makeBook((book) => {
      const sheet = book.sheets[book.sheetOrder[0]];
      sheet.rowData = {};
      for (const row of rows) sheet.rowData[String(row)] = { h: 30 };
    }, rows);
    const model = buildSheetPrintModel(snapshot, id, null)!;
    const pages = paginateSheet(model, options({ scale: 'actual', repeatHeaderRow: true }));
    expect(pages.length).toBe(2);
    const first = resolvePageRect(model, pages[0])!;
    expect(first).toMatchObject({ x: 0, y: 0 });
    const second = resolvePageRect(model, pages[1])!;
    // 30px 行 × 0.75 = 22.5pt；A4 版心 769.89pt 放得下 34 行 → 第二页从第 35 行（索引 34）开始
    expect(pages[1].repeatedHeader).toBe(true);
    expect(second.y).toBe(34 * 22.5);
    expect(second.height).toBe(6 * 22.5);
  });

  it('HTML：对象层按页裁切，只出现在相交的那一页', () => {
    const rows = Array.from({ length: 40 }, (_, index) => index);
    const { snapshot, id } = makeBook((book) => {
      const sheet = book.sheets[book.sheetOrder[0]];
      sheet.rowData = {};
      for (const row of rows) sheet.rowData[String(row)] = { h: 30 };
      // 锚在第 36 行：第一页只到第 34 行，所以第一页不该出现
      book.syntoolsImages = [
        { ...image(book.sheetOrder[0]), from: { col: 0, row: 35, colOff: 0, rowOff: 0 } },
      ];
    }, rows);
    const model = buildSheetPrintModel(snapshot, id, null)!;
    const opts = options({ scale: 'actual', repeatHeaderRow: true });
    const pages = paginateSheet(model, opts);
    const html = buildSheetPrintHtml(model, pages, opts);
    const sections = html.split('<section class="print-page">');
    expect(sections).toHaveLength(3);
    expect(sections[1]).not.toContain('print-objects');
    expect(sections[2]).toContain('print-objects');
    expect(sections[2]).toContain('class="print-image"');
    // 对象层与表格同原点：left/top 都用页边距
    expect(sections[2]).toContain(`left:${opts.margin}pt`);
    expect(html).toContain('.print-objects { position: absolute; overflow: hidden }');
  });

  it('HTML：形状画成带边框的 div，文本转义', () => {
    const { snapshot, id } = makeBook((book) => {
      book.syntoolsShapes = [
        {
          id: 'shape-9',
          prst: 'rect',
          sheetId: book.sheetOrder[0],
          from: { col: 0, row: 0, colOff: 0, rowOff: 0 },
          width: 100,
          height: 50,
          fill: '#FFF2CC',
          stroke: '#000000',
          strokeWidth: 1,
          text: '<b>注</b>',
          z: 1,
        },
      ];
    });
    const model = buildSheetPrintModel(snapshot, id, null)!;
    const opts = options();
    const html = buildSheetPrintHtml(model, paginateSheet(model, opts), opts);
    expect(html).toContain('class="print-shape"');
    expect(html).toContain('background:#FFF2CC');
    expect(html).toContain('border:0.75pt solid #000000');
    expect(html).toContain('&lt;b&gt;注&lt;/b&gt;');
  });
});

describe('打印对象的开关（P1-6）', () => {
  it('面板上的"打印对象"决定模型里有没有对象，调用方显式指定时以调用方为准', () => {
    expect(resolvePrintModelOptions(DEFAULT_SHEET_PRINT_OPTIONS).includeObjects).toBe(true);
    const off = resolvePrintModelOptions({
      ...DEFAULT_SHEET_PRINT_OPTIONS,
      printObjects: false,
    });
    expect(off.includeObjects).toBe(false);
    expect(
      resolvePrintModelOptions(
        { ...DEFAULT_SHEET_PRINT_OPTIONS, printObjects: false },
        { includeObjects: true },
      ).includeObjects,
    ).toBe(true);
  });
});
