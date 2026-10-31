import { describe, expect, it } from 'vitest';
import {
  DEFAULT_COLUMN_WIDTH,
  DEFAULT_ROW_HEIGHT,
  SHEET_SHAPE_PRESETS,
  anchorToPx,
  buildSheetLayout,
  columnLeftPx,
  createSheetShape,
  pxToAnchor,
  rowTopPx,
  shapePath,
  shapeRect,
} from './shapes';

/**
 * Cell anchoring (P4-SH0).
 *
 * A shape is stored as "cell + pixel offset" and painted from the sheet's **real** column widths and
 * row heights. Both directions are pinned here: divide-by-default-width (what the chart layer does)
 * drifts as soon as a column is resized, and that drift would end up in the exported file.
 */

describe('buildSheetLayout', () => {
  it('缺失时回落到默认行列尺寸', () => {
    const layout = buildSheetLayout(undefined);
    expect(layout.defaultColumnWidth).toBe(DEFAULT_COLUMN_WIDTH);
    expect(layout.defaultRowHeight).toBe(DEFAULT_ROW_HEIGHT);
    expect(layout.columnWidths).toEqual({});
    expect(layout.rowHeights).toEqual({});
  });

  it('只接受正数尺寸（0/负值是坏数据，不能参与累加）', () => {
    const layout = buildSheetLayout({
      defaultColumnWidth: 80,
      defaultRowHeight: 20,
      columnData: { '0': { w: 120 }, '1': { w: 0 }, '2': { w: -5 } },
      rowData: { '0': { h: 40 }, '1': { h: 0 } },
    });
    expect(layout.columnWidths).toEqual({ '0': 120 });
    expect(layout.rowHeights).toEqual({ '0': 40 });
  });
});

describe('行列累加', () => {
  const layout = buildSheetLayout({
    defaultColumnWidth: 100,
    defaultRowHeight: 25,
    columnData: { '1': { w: 40 } },
    rowData: { '0': { h: 60 } },
  });

  it('列左边界按真实宽度累加', () => {
    expect(columnLeftPx(layout, 0)).toBe(0);
    expect(columnLeftPx(layout, 1)).toBe(100);
    // 第 1 列被改成 40px，第 2 列的左边界因此是 140 而不是 200
    expect(columnLeftPx(layout, 2)).toBe(140);
  });

  it('行上边界按真实高度累加', () => {
    expect(rowTopPx(layout, 0)).toBe(0);
    expect(rowTopPx(layout, 1)).toBe(60);
    expect(rowTopPx(layout, 2)).toBe(85);
  });
});

describe('锚点 ↔ 像素', () => {
  const layout = buildSheetLayout({
    defaultColumnWidth: 100,
    defaultRowHeight: 25,
    columnData: { '1': { w: 40 } },
    rowData: { '0': { h: 60 } },
  });

  it('锚点换算成内容坐标', () => {
    expect(anchorToPx({ col: 2, row: 2, colOff: 10, rowOff: 5 }, layout)).toEqual({
      x: 150,
      y: 90,
    });
  });

  it('像素回推锚点落在跨过变宽列之后的正确单元格', () => {
    // x=150 已经越过 0..1 列（100 + 40），第 2 列从 140 开始
    expect(pxToAnchor(150, 90, layout)).toEqual({ col: 2, row: 2, colOff: 10, rowOff: 5 });
  });

  it('往返不丢精度', () => {
    const from = { col: 3, row: 5, colOff: 17, rowOff: 9 };
    const px = anchorToPx(from, layout);
    expect(pxToAnchor(px.x, px.y, layout)).toEqual(from);
  });

  it('负坐标被夹到 0', () => {
    expect(pxToAnchor(-50, -20, layout)).toEqual({ col: 0, row: 0, colOff: 0, rowOff: 0 });
  });
});

describe('shapeRect / shapePath', () => {
  const layout = buildSheetLayout({ defaultColumnWidth: 100, defaultRowHeight: 25 });

  it('矩形区域来自锚点与尺寸', () => {
    const shape = createSheetShape({
      prst: 'rect',
      from: { col: 1, row: 1, colOff: 4, rowOff: 6 },
      width: 120,
      height: 80,
    });
    expect(shapeRect(shape, layout)).toEqual({ x: 104, y: 31, width: 120, height: 80 });
  });

  it('每个预设都能画出非空路径', () => {
    for (const group of SHEET_SHAPE_PRESETS) {
      for (const preset of group) {
        const path = shapePath({ prst: preset.prst, width: 100, height: 60 });
        expect(path.startsWith('M '), preset.prst).toBe(true);
      }
    }
  });

  it('不同预设产生不同路径（避免自定义几何被静默退化成矩形）', () => {
    const rect = shapePath({ prst: 'rect', width: 100, height: 60 });
    const ellipse = shapePath({ prst: 'ellipse', width: 100, height: 60 });
    const star = shapePath({ prst: 'star6', width: 100, height: 60 });
    expect(new Set([rect, ellipse, star]).size).toBe(3);
  });

  it('调整值会改变路径', () => {
    const plain = shapePath({ prst: 'roundRect', width: 100, height: 60 });
    const rounded = shapePath({ prst: 'roundRect', adj: { adj1: 0.4 }, width: 100, height: 60 });
    expect(rounded).not.toBe(plain);
  });
});

describe('预设清单与工厂', () => {
  it('至少 20 个预设且不重复', () => {
    const presets = SHEET_SHAPE_PRESETS.flat();
    expect(presets.length).toBeGreaterThanOrEqual(20);
    expect(new Set(presets.map((item) => item.prst)).size).toBe(presets.length);
    expect(new Set(presets.map((item) => item.labelKey)).size).toBe(presets.length);
  });

  it('新形状带默认尺寸、配色与 z 序', () => {
    const shape = createSheetShape({
      prst: 'ellipse',
      from: { col: 0, row: 0, colOff: 0, rowOff: 0 },
    });
    expect(shape.width).toBeGreaterThan(0);
    expect(shape.height).toBeGreaterThan(0);
    expect(shape.fill).toMatch(/^#[0-9A-F]{6}$/i);
    expect(shape.strokeWidth).toBe(1);
    expect(shape.id).toMatch(/^shape-/);
  });

  it('尺寸下限被强制（0 尺寸的形状无法选中，也就无法删除）', () => {
    const shape = createSheetShape({
      prst: 'rect',
      from: { col: 0, row: 0, colOff: 0, rowOff: 0 },
      width: 0,
      height: -10,
    });
    expect(shape.width).toBeGreaterThanOrEqual(8);
    expect(shape.height).toBeGreaterThanOrEqual(8);
  });
});
