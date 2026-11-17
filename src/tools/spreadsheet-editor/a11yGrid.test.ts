import { describe, expect, it } from 'vitest';
import {
  ARIA_GRID_MAX_CELLS,
  ariaCellId,
  buildAriaGrid,
  planAriaRange,
  type AriaRangePlan,
} from './a11yGrid';

describe('planAriaRange（几何与截断）', () => {
  it('没有选区就不投影（canvas 还没拿到焦点）', () => {
    expect(planAriaRange(null)).toBeNull();
  });

  it('单格选区：一个格子', () => {
    expect(planAriaRange({ startRow: 1, startColumn: 1, endRow: 1, endColumn: 1 })).toEqual({
      startRow: 1,
      startColumn: 1,
      rowCount: 1,
      columnCount: 1,
      truncated: false,
    });
  });

  it('反向选区（右下往左上拖）归一化成正向，id 不会出现负数', () => {
    expect(planAriaRange({ startRow: 2, startColumn: 1, endRow: 1, endColumn: 0 })).toEqual({
      startRow: 1,
      startColumn: 0,
      rowCount: 2,
      columnCount: 2,
      truncated: false,
    });
  });

  it('整表选区超过上限时截断：先保列宽，再截行', () => {
    const plan = planAriaRange({ startRow: 0, startColumn: 0, endRow: 999, endColumn: 99 });
    expect(plan).toMatchObject({ truncated: true, rowCount: 6, columnCount: 100 });
    expect(plan!.rowCount * plan!.columnCount).toBe(ARIA_GRID_MAX_CELLS);
  });

  it('上限比列数还小时，列数也会被压下来（但至少留一格）', () => {
    const plan = planAriaRange({ startRow: 0, startColumn: 0, endRow: 999, endColumn: 99 }, 60);
    expect(plan).toMatchObject({ truncated: true, rowCount: 1, columnCount: 60 });
  });

  it('没有超过上限时不标记截断', () => {
    const plan = planAriaRange({ startRow: 0, startColumn: 0, endRow: 9, endColumn: 9 }, 600);
    expect(plan).toMatchObject({ rowCount: 10, columnCount: 10, truncated: false });
  });
});

describe('buildAriaGrid（布局）', () => {
  const PLAN: AriaRangePlan = {
    startRow: 1,
    startColumn: 0,
    rowCount: 2,
    columnCount: 2,
    truncated: false,
  };

  it('按行铺开，行列号保持原表位置，只有左上角是活动格', () => {
    const model = buildAriaGrid({
      ...PLAN,
      sheetId: 's1',
      values: [
        ['华东', '1200'],
        ['华北', '=SUM(B2:B2)'],
      ],
    });
    expect(model.rows[0].map((cell) => cell.text)).toEqual(['华东', '1200']);
    expect(model.rows[1].map((cell) => cell.text)).toEqual(['华北', '=SUM(B2:B2)']);
    expect(model.rows[0][0]).toMatchObject({ row: 1, column: 0, active: true });
    expect(model.rows[1][1]).toMatchObject({
      row: 2,
      column: 1,
      active: false,
      id: ariaCellId('s1', 2, 1),
    });
    expect(model.activeId).toBe(ariaCellId('s1', 1, 0));
  });

  it('矩阵缺失的格子当空字符串（读屏文案由界面补"空白"）', () => {
    const model = buildAriaGrid({ ...PLAN, sheetId: 's1', values: [['华东']] });
    expect(model.rows[0][1].text).toBe('');
    expect(model.rows[1][0].text).toBe('');
  });

  it('工作表还没读出来（矩阵为空）也照样投影：结构稳定，焦点不会丢', () => {
    const model = buildAriaGrid({ ...PLAN, sheetId: 's1', values: [] });
    expect(model.rows).toHaveLength(2);
    expect(model.rows[0]).toHaveLength(2);
    expect(model.activeId).toBe(ariaCellId('s1', 1, 0));
  });

  it('截断标记原样带到模型上', () => {
    const model = buildAriaGrid({ ...PLAN, sheetId: 's1', values: [], truncated: true });
    expect(model.truncated).toBe(true);
  });
});
