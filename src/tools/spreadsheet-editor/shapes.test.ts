import { describe, expect, it } from 'vitest';
import {
  DEFAULT_COLUMN_WIDTH,
  DEFAULT_ROW_HEIGHT,
  DEFAULT_SHEET_VIEWPORT,
  SHEET_SHAPE_PRESETS,
  anchorToPx,
  buildSheetLayout,
  columnLeftPx,
  contentVisibleBox,
  createSheetShape,
  pxToAnchor,
  rowTopPx,
  screenDeltaToContent,
  shapeLayerClip,
  shapePath,
  shapeRect,
  shapeScreenRect,
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

describe('视口投影（P4-SH6）', () => {
  const layout = buildSheetLayout({ defaultColumnWidth: 100, defaultRowHeight: 25 });
  const shape = createSheetShape({
    prst: 'rect',
    from: { col: 2, row: 4, colOff: 10, rowOff: 5 },
    width: 120,
    height: 80,
  });
  it('未滚动、无缩放时只平移网格原点', () => {
    const box = shapeScreenRect(shape, layout, DEFAULT_SHEET_VIEWPORT);
    // 第 2 列 200 + 偏移 10，第 4 行 100 + 偏移 5
    expect({ left: box.left, top: box.top }).toEqual({ left: 210, top: 105 });
    expect({ width: box.width, height: box.height }).toEqual({ width: 120, height: 80 });
  });

  it('滚动量按内容像素扣除（形状跟随单元格移动）', () => {
    const box = shapeScreenRect(shape, layout, {
      ...DEFAULT_SHEET_VIEWPORT,
      originX: 46,
      originY: 120,
      scrollX: 100,
      scrollY: 50,
    });
    expect({ left: box.left, top: box.top }).toEqual({ left: 156, top: 175 });
  });

  it('缩放同时作用于位置与尺寸', () => {
    const box = shapeScreenRect(shape, layout, {
      ...DEFAULT_SHEET_VIEWPORT,
      originX: 46,
      originY: 20,
      scrollX: 100,
      zoom: 1.5,
    });
    // originX + (210 - 100) * 1.5
    expect(box.left).toBe(211);
    expect(box.top).toBe(177.5);
    expect(box.width).toBe(180);
    expect(box.height).toBe(120);
  });

  it('指针位移换算回内容坐标（缩放后拖拽不放大位移）', () => {
    const viewport = { ...DEFAULT_SHEET_VIEWPORT, zoom: 2 };
    expect(screenDeltaToContent(40, -10, viewport)).toEqual({ x: 20, y: -5 });
    // 坏缩放值退化为 1，避免形状被压到原点
    expect(screenDeltaToContent(40, -10, { ...viewport, zoom: 0 })).toEqual({ x: 40, y: -10 });
  });

  it('形状层裁到网格区域，滚出网格的形状不会画到工具栏上', () => {
    const viewport = {
      originX: 46,
      originY: 125,
      scrollX: 0,
      scrollY: 0,
      zoom: 1,
      width: 800,
      height: 500,
    };
    expect(shapeLayerClip(viewport, { width: 900, height: 640 })).toBe(
      'inset(125px 54px 15px 46px)',
    );
    // 网格尺寸未测到时不裁剪：空 clip 会把所有形状藏起来
    expect(shapeLayerClip(DEFAULT_SHEET_VIEWPORT, { width: 900, height: 640 })).toBeNull();
    // 滚动不改变裁剪区域（裁剪只跟着网格原点与尺寸）
    expect(
      shapeLayerClip({ ...viewport, scrollX: 300, scrollY: 200 }, { width: 900, height: 640 }),
    ).toBe('inset(125px 54px 15px 46px)');
  });

  it('可见内容区四角正好投影到容器四角', () => {
    const bounds = { width: 400, height: 300 };
    const viewport = {
      originX: 46,
      originY: 120,
      scrollX: 100,
      scrollY: 50,
      zoom: 1,
      ...bounds,
    };
    const box = contentVisibleBox(viewport, bounds);
    expect(box).toEqual({ minX: 54, minY: -70, maxX: 454, maxY: 230 });
    expect(viewport.originX + (box.minX - viewport.scrollX) * viewport.zoom).toBe(0);
    expect(viewport.originY + (box.minY - viewport.scrollY) * viewport.zoom).toBe(0);
    expect(viewport.originX + (box.maxX - viewport.scrollX) * viewport.zoom).toBe(bounds.width);
    expect(viewport.originY + (box.maxY - viewport.scrollY) * viewport.zoom).toBe(bounds.height);
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
