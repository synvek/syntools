import { act, renderHook } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { DEFAULT_COLUMN_WIDTH, DEFAULT_ROW_HEIGHT } from '../shapes';
import { useSheetLayout } from './useSheetLayout';

/**
 * 技术债 #7 的验收：布局重算必须由**显式时机**驱动，而且渲染期不能读引擎。
 * 每个用例都在数 `read` 被调了几次——这正是"隐式 memo 依赖"永远说不清的那件事。
 */
function source(widths: Record<string, number>) {
  return () => ({
    defaultColumnWidth: DEFAULT_COLUMN_WIDTH,
    defaultRowHeight: DEFAULT_ROW_HEIGHT,
    columnWidths: { ...widths },
    rowHeights: {},
  });
}

describe('useSheetLayout', () => {
  it('首帧给默认布局，不等引擎就绪', () => {
    const read = vi.fn(source({}));
    const { result } = renderHook(() => useSheetLayout(read, 's1'));

    expect(result.current.layout.defaultColumnWidth).toBe(DEFAULT_COLUMN_WIDTH);
    // 挂载后补读一次（引擎可能已经就绪），但渲染期里一次都没读
    expect(read).toHaveBeenCalledTimes(1);
  });

  it('refresh() 重新读来源并换掉布局（列宽变了形状要跟着走）', () => {
    let widths: Record<string, number> = {};
    const read = vi.fn(() => source(widths)());
    const { result } = renderHook(() => useSheetLayout(read, 's1'));

    widths = { '0': 180 };
    act(() => result.current.refresh());

    expect(result.current.layout.columnWidths['0']).toBe(180);
  });

  it('换工作表自动重读一次（不让调用方逐个记得写）', () => {
    const read = vi.fn(source({}));
    const { rerender } = renderHook(({ id }) => useSheetLayout(read, id), {
      initialProps: { id: 's1' },
    });
    const before = read.mock.calls.length;

    rerender({ id: 's2' });
    expect(read.mock.calls.length).toBe(before + 1);
  });

  it('同一张表重渲染不重读（布局是外部源的缓存，不是每次渲染的派生值）', () => {
    const read = vi.fn(source({ '0': 93 }));
    const { rerender } = renderHook(() => useSheetLayout(read, 's1'));
    const before = read.mock.calls.length;

    rerender();
    rerender();
    expect(read.mock.calls.length).toBe(before);
  });

  it('读函数每次渲染换新闭包也不重订阅：refresh 的引用保持稳定', () => {
    const { result, rerender } = renderHook(({ id }) => useSheetLayout(() => source({})(), id), {
      initialProps: { id: 's1' },
    });
    const first = result.current.refresh;

    rerender({ id: 's1' });
    expect(result.current.refresh).toBe(first);
  });
});
