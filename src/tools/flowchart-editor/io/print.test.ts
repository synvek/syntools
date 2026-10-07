import { describe, expect, it } from 'vitest';
import { DEFAULT_PRINT_OPTIONS, PAPER_OPTIONS, exportPrintPdfSet, printGrid } from './print';

describe('分页打印网格', () => {
  it('A4 纵向：按内容尺寸计算行列', () => {
    const grid = printGrid({ width: 1000, height: 2000 }, { ...DEFAULT_PRINT_OPTIONS, margin: 24 });
    // 内容区 746 × 1075
    expect(grid.cols).toBe(2);
    expect(grid.rows).toBe(2);
    expect(grid.pageWidth).toBe(794);
    expect(grid.pageHeight).toBe(1123);
  });

  it('A4 横向：宽高互换', () => {
    const grid = printGrid(
      { width: 1000, height: 2000 },
      { ...DEFAULT_PRINT_OPTIONS, landscape: true, margin: 24 },
    );
    expect(grid.pageWidth).toBe(1123);
    expect(grid.pageHeight).toBe(794);
    expect(grid.cols).toBe(1);
    expect(grid.rows).toBe(3);
  });

  it('A3 纸张更大，页数更少', () => {
    const a4 = printGrid({ width: 2000, height: 2000 }, { ...DEFAULT_PRINT_OPTIONS, margin: 0 });
    const a3 = printGrid(
      { width: 2000, height: 2000 },
      { ...DEFAULT_PRINT_OPTIONS, paper: 'a3', margin: 0 },
    );
    expect(a3.cols * a3.rows).toBeLessThan(a4.cols * a4.rows);
  });

  it('内容小于一页时只输出一页', () => {
    const grid = printGrid({ width: 100, height: 100 }, DEFAULT_PRINT_OPTIONS);
    expect(grid.cols).toBe(1);
    expect(grid.rows).toBe(1);
  });

  it('支持的纸张枚举', () => {
    expect(PAPER_OPTIONS).toEqual(['a4', 'a3']);
  });

  it('多页打印：无可用页面时返回 EMPTY', async () => {
    await expect(exportPrintPdfSet([], DEFAULT_PRINT_OPTIONS, 'chart')).resolves.toEqual({
      ok: false,
      error: 'EMPTY',
    });
  });
});
