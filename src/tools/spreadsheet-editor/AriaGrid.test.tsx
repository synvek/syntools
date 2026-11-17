import { render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { buildAriaGrid, emptyAriaGrid, planAriaRange, type AriaRange } from './a11yGrid';
import { AriaGrid } from './AriaGrid';

const deps = vi.hoisted(() => ({
  strings: {
    'tools.sheet.a11yGridLabel': '表格编辑区',
    'tools.sheet.a11yGridCell': '第 {{row}} 行 第 {{column}} 列，{{value}}',
    'tools.sheet.a11yGridBlank': '空白',
  } as Record<string, string>,
}));

vi.mock('react-i18next', () => ({
  useTranslation: () => ({
    t: (key: string, params: Record<string, unknown> = {}) =>
      (deps.strings[key] ?? key).replace(/\{\{(\w+)\}\}/g, (_, name: string) =>
        String(params[name] ?? ''),
      ),
  }),
}));

/** 与组件接线一致：先规划几何，再拿矩阵布局 */
function renderGrid(
  range: AriaRange | null,
  values: string[][] = [
    ['区域', '金额'],
    ['华东', '1200'],
  ],
  maxCells = 600,
) {
  const plan = planAriaRange(range, maxCells);
  return render(
    <AriaGrid model={plan ? buildAriaGrid({ ...plan, sheetId: 's1', values }) : emptyAriaGrid()} />,
  );
}

describe('AriaGrid（P2-9）', () => {
  it('没有选区时不渲染任何节点（不占无障碍树）', () => {
    renderGrid(null);
    expect(screen.queryByTestId('sheet-a11y-grid')).toBeNull();
  });

  it('投影成 role=grid / row / gridcell，并带行列总数与活动格', () => {
    renderGrid({ startRow: 1, startColumn: 0, endRow: 2, endColumn: 1 });
    const grid = screen.getByRole('grid', { name: '表格编辑区' });
    // 固定 id：画布用 aria-owns 引它，`aria-activedescendant` 才指向合法后代
    expect(grid).toHaveAttribute('id', 'sheet-a11y-grid');
    expect(grid).toHaveAttribute('aria-rowcount', '2');
    expect(grid).toHaveAttribute('aria-colcount', '2');
    expect(grid).toHaveAttribute('aria-activedescendant', 'sheet-a11y-s1-r1-c0');
    expect(screen.getAllByRole('row')).toHaveLength(2);
    expect(screen.getAllByRole('gridcell')).toHaveLength(4);
  });

  it('每个格子的可读文案是"第 r 行 第 c 列，值"（行列从 1 开始）', () => {
    renderGrid({ startRow: 1, startColumn: 1, endRow: 1, endColumn: 1 }, [['1200']]);
    expect(screen.getByRole('gridcell')).toHaveAttribute('aria-label', '第 2 行 第 2 列，1200');
  });

  it('空单元格读"空白"，不是空字符串', () => {
    renderGrid({ startRow: 9, startColumn: 9, endRow: 9, endColumn: 9 }, []);
    expect(screen.getByRole('gridcell')).toHaveAttribute('aria-label', '第 10 行 第 10 列，空白');
  });

  it('活动格标 aria-selected，其余是显式 false', () => {
    renderGrid({ startRow: 0, startColumn: 0, endRow: 0, endColumn: 1 }, [['区域', '金额']]);
    const [first, second] = screen.getAllByRole('gridcell');
    expect(first).toHaveAttribute('aria-selected', 'true');
    // React 把 aria-* 的布尔值渲染成字符串
    expect(second).toHaveAttribute('aria-selected', 'false');
  });

  it('选区被截断时如实标记（界面/测试可据此说明"只投影了前 N 格"）', () => {
    renderGrid({ startRow: 0, startColumn: 0, endRow: 999, endColumn: 99 }, [], 60);
    expect(screen.getByTestId('sheet-a11y-grid')).toHaveAttribute('data-truncated', 'true');
    expect(screen.getAllByRole('gridcell')).toHaveLength(60);
  });
});
