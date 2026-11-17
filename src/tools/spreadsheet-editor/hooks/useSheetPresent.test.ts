import { act, renderHook } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { PresentGrid } from '../core';
import type { WorkbookSnapshot } from '../xlsx-io';
import {
  useSheetPresent,
  type PresentEngine,
  type UseSheetPresentOptions,
} from './useSheetPresent';

const BASE = { sheetOrder: ['s1'], sheets: {} } as unknown as WorkbookSnapshot;
const MERGED = { ...BASE, syntoolsImages: [] } as unknown as WorkbookSnapshot;
const GRID = { rows: [['x']], columns: [1] } as unknown as PresentGrid;

function fakeEngine(overrides: Partial<PresentEngine> = {}): PresentEngine {
  return {
    getSnapshot: () => BASE,
    getActiveSheetId: () => 's1',
    ...overrides,
  };
}

function setup(overrides: Partial<UseSheetPresentOptions> = {}) {
  const withDocOwnedContent = vi.fn(() => MERGED);
  const buildGrid = vi.fn(() => GRID);
  const options: UseSheetPresentOptions = {
    handleRef: { current: fakeEngine() },
    withDocOwnedContent,
    buildGrid,
    ...overrides,
  };
  const view = renderHook(() => useSheetPresent(options));
  return { view, withDocOwnedContent, buildGrid };
}

beforeEach(() => {
  vi.clearAllMocks();
});

describe('useSheetPresent', () => {
  it('打开：先合成对象层快照再投影，带上活动工作表', () => {
    const { view, withDocOwnedContent, buildGrid } = setup();
    act(() => view.result.current.open());

    expect(withDocOwnedContent).toHaveBeenCalledWith(BASE);
    expect(buildGrid).toHaveBeenCalledWith(MERGED, 's1');
    expect(view.result.current.presenting).toBe(true);
    expect(view.result.current.grid).toBe(GRID);
    expect(view.result.current.failed).toBe(false);
  });

  it('没有引擎：进面板但标记失败（不调用投影）', () => {
    const { view, buildGrid } = setup({ handleRef: { current: null } });
    act(() => view.result.current.open());

    expect(buildGrid).not.toHaveBeenCalled();
    expect(view.result.current.presenting).toBe(true);
    expect(view.result.current.grid).toBeNull();
    expect(view.result.current.failed).toBe(true);
  });

  it('投影抛错：收进 failed，不把异常抛到渲染里', () => {
    const { view } = setup({
      buildGrid: () => {
        throw new Error('bad snapshot');
      },
    });
    act(() => view.result.current.open());
    expect(view.result.current.failed).toBe(true);
    expect(view.result.current.presenting).toBe(true);
  });

  it('投影返回 null（空工作簿）：同样标记失败', () => {
    const { view } = setup({ buildGrid: () => null });
    act(() => view.result.current.open());
    expect(view.result.current.failed).toBe(true);
    expect(view.result.current.grid).toBeNull();
  });

  it('重新打开：先清掉上一次的网格与失败标记', () => {
    const { view } = setup();
    act(() => view.result.current.open());
    expect(view.result.current.grid).toBe(GRID);

    // 第二次读到坏数据：不能还留着上一份网格
    const { view: failing } = setup({ buildGrid: () => null });
    act(() => failing.result.current.open());
    expect(failing.result.current.grid).toBeNull();
    expect(failing.result.current.failed).toBe(true);
  });

  it('close 关掉面板但保留网格（下次打开会先清）', () => {
    const { view } = setup();
    act(() => view.result.current.open());
    act(() => view.result.current.close());
    expect(view.result.current.presenting).toBe(false);
    expect(view.result.current.grid).toBe(GRID);
  });
});
