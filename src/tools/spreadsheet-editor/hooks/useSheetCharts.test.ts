import { act, renderHook } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { ChartConfig } from '../charts';
import type { RawChartParts } from '../rawChartParts';
import type { WorkbookSnapshotLite } from '../core';
import { useSheetCharts, type ChartEngine, type UseSheetChartsOptions } from './useSheetCharts';

const deps = vi.hoisted(() => ({
  buildChartData: vi.fn(),
  chartDataSheetId: vi.fn((config: { dataSheetId?: string }, sheetId: string | null) => {
    return config.dataSheetId ?? sheetId;
  }),
  summarizeImport: vi.fn((charts: unknown[], parts?: unknown[]) => ({
    editable: { total: charts.length, byType: {} },
    kept: { total: parts?.length ?? 0, byType: {} },
  })),
}));

vi.mock('../charts', () => ({
  buildChartData: deps.buildChartData,
  chartDataSheetId: deps.chartDataSheetId,
}));
vi.mock('../chartImport', () => ({ summarizeImport: deps.summarizeImport }));

const SNAPSHOT = { sheetOrder: ['s1'], sheets: { s1: {} } } as unknown as WorkbookSnapshotLite;
const DATA = { categories: ['A', 'B'], series: [{ name: 's', values: [1, 2] }] } as never;

function fakeEngine(overrides: Partial<ChartEngine> = {}): ChartEngine {
  return {
    getSnapshot: () => SNAPSHOT,
    getActiveSheetId: () => 's1',
    getActiveRange: () => ({ startRow: 0, startColumn: 0, endRow: 2, endColumn: 1 }),
    ...overrides,
  };
}

function setup(overrides: Partial<UseSheetChartsOptions> = {}) {
  const handleRef = { current: fakeEngine() as ChartEngine | null };
  const onCommit = vi.fn();
  const options: UseSheetChartsOptions = {
    handleRef,
    bounds: { width: 900, height: 600 },
    onCommit,
    ...overrides,
  };
  const view = renderHook(() => useSheetCharts(options));
  return { view, handleRef, onCommit };
}

function chartFixture(id: string, extra: Partial<ChartConfig> = {}): ChartConfig {
  return {
    id,
    type: 'bar',
    range: { startRow: 0, startColumn: 0, endRow: 2, endColumn: 1 },
    x: 24,
    y: 24,
    width: 320,
    height: 220,
    ...extra,
  };
}

beforeEach(() => {
  vi.clearAllMocks();
  deps.buildChartData.mockReturnValue({ ok: true, value: DATA });
});

describe('useSheetCharts', () => {
  it('插入：取选区数据、按已有数量错开、记下派生数据并落盘', () => {
    const { view, onCommit } = setup();
    act(() => view.result.current.insert());

    expect(view.result.current.charts).toHaveLength(1);
    const chart = view.result.current.charts[0];
    expect(chart.range).toEqual({ startRow: 0, startColumn: 0, endRow: 2, endColumn: 1 });
    expect(chart.sheetId).toBe('s1');
    expect(chart.width).toBeLessThanOrEqual(420);
    expect(view.result.current.selectedId).toBe(chart.id);
    expect(view.result.current.dataMap[chart.id]).toEqual(DATA);
    expect(onCommit).toHaveBeenCalledTimes(1);
  });

  it('没有选区：只给提示，不建图不落盘', () => {
    const { view, onCommit } = setup({
      handleRef: { current: fakeEngine({ getActiveRange: () => null }) },
    });
    act(() => view.result.current.insert());
    expect(view.result.current.notice).toBe(true);
    expect(view.result.current.charts).toHaveLength(0);
    expect(onCommit).not.toHaveBeenCalled();
  });

  it('选区里没有可用数据（如全是文本）：同样只给提示', () => {
    deps.buildChartData.mockReturnValue({ ok: false, error: 'EMPTY' });
    const { view } = setup();
    act(() => view.result.current.insert());
    expect(view.result.current.notice).toBe(true);
    expect(view.result.current.charts).toHaveLength(0);
  });

  it('引擎还没建好：插入是空操作', () => {
    const { view, onCommit } = setup({ handleRef: { current: null } });
    act(() => view.result.current.insert());
    expect(view.result.current.charts).toHaveLength(0);
    expect(onCommit).not.toHaveBeenCalled();
  });

  it('改配置：不带 range 时不重算数据（只是挪位置不该扫一遍表）', () => {
    const { view } = setup();
    act(() => view.result.current.insert());
    deps.buildChartData.mockClear();

    const id = view.result.current.charts[0].id;
    act(() => view.result.current.update(id, { x: 100 }));
    expect(view.result.current.charts[0].x).toBe(100);
    expect(deps.buildChartData).not.toHaveBeenCalled();
  });

  it('改数据区域：立刻重算派生数据', () => {
    const { view } = setup();
    act(() => view.result.current.insert());
    deps.buildChartData.mockClear();

    const id = view.result.current.charts[0].id;
    act(() =>
      view.result.current.update(id, {
        range: { startRow: 5, startColumn: 0, endRow: 9, endColumn: 2 },
      }),
    );
    expect(deps.buildChartData).toHaveBeenCalledTimes(1);
    expect(view.result.current.dataMap[id]).toEqual(DATA);
  });

  it('删除：列表、选中态、派生数据一起清掉', () => {
    const { view, onCommit } = setup();
    act(() => view.result.current.insert());
    const id = view.result.current.charts[0].id;

    act(() => view.result.current.remove(id));
    expect(view.result.current.charts).toHaveLength(0);
    expect(view.result.current.selectedId).toBeNull();
    expect(view.result.current.dataMap[id]).toBeUndefined();
    expect(onCommit).toHaveBeenCalledTimes(2);
  });

  it('删除的不是当前选中项时，选中态保持不动', () => {
    const { view } = setup();
    act(() => view.result.current.insert());
    const first = view.result.current.charts[0].id;
    act(() => view.result.current.insert());
    const second = view.result.current.charts[1].id;
    expect(view.result.current.selectedId).toBe(second);

    act(() => view.result.current.remove(first));
    expect(view.result.current.selectedId).toBe(second);
  });

  it('重新指向选区：更新 range 与所在表；没有选区时只提示', () => {
    const { view } = setup();
    act(() => view.result.current.insert());
    const id = view.result.current.charts[0].id;

    act(() => view.result.current.pickRange(id));
    expect(view.result.current.charts[0].sheetId).toBe('s1');
    expect(view.result.current.notice).toBe(false);

    const { view: noSelection } = setup({
      handleRef: { current: fakeEngine({ getActiveRange: () => null }) },
    });
    act(() => noSelection.result.current.insert());
    act(() => noSelection.result.current.pickRange('x'));
    expect(noSelection.result.current.notice).toBe(true);
  });

  it('applyData：没有图表时清空映射；算不出来的那份给 null', () => {
    const { view } = setup();
    act(() => view.result.current.applyData(SNAPSHOT, 's1'));
    expect(view.result.current.dataMap).toEqual({});

    act(() => view.result.current.adoptIfEmpty([chartFixture('c1'), chartFixture('c2')]));
    deps.buildChartData
      .mockReturnValueOnce({ ok: true, value: DATA })
      .mockReturnValueOnce({ ok: false, error: 'EMPTY' });
    act(() => view.result.current.applyData(SNAPSHOT, 's1'));
    expect(view.result.current.dataMap).toEqual({ c1: DATA, c2: null });
  });

  it('adoptIfEmpty：已有图表（来自草稿）时不覆盖，空列表才采纳', () => {
    const { view } = setup();
    act(() => view.result.current.insert());
    const inserted = view.result.current.charts[0].id;

    let first = false;
    act(() => {
      first = view.result.current.adoptIfEmpty([chartFixture('from-snapshot')]);
    });
    expect(first).toBe(false);
    expect(view.result.current.charts[0].id).toBe(inserted);

    const { view: fresh } = setup();
    act(() => fresh.result.current.adoptIfEmpty([chartFixture('from-snapshot')]));
    expect(fresh.result.current.charts[0].id).toBe('from-snapshot');
    expect(fresh.result.current.selectedId).toBe('from-snapshot');
  });

  it('reset 无条件替换并清掉旧提示：换文档时上一份的图表不能留下', () => {
    const { view } = setup({
      handleRef: { current: fakeEngine({ getActiveRange: () => null }) },
    });
    act(() => view.result.current.insert());
    expect(view.result.current.notice).toBe(true);

    act(() => view.result.current.reset([chartFixture('next')]));
    expect(view.result.current.charts[0].id).toBe('next');
    expect(view.result.current.notice).toBe(false);
  });

  it('采纳时统计"可编辑 / 原样保留"的图表（保留份数来自 rawParts）', () => {
    const rawParts = { parts: [{ kind: 'chart' }] } as unknown as RawChartParts;
    const { view } = setup();
    act(() => view.result.current.adoptIfEmpty([chartFixture('c1')], rawParts));
    expect(deps.summarizeImport).toHaveBeenCalledWith(
      [expect.objectContaining({ id: 'c1' })],
      [{ kind: 'chart' }],
    );
    expect(view.result.current.importReport).toEqual({
      editable: { total: 1, byType: {} },
      kept: { total: 1, byType: {} },
    });
  });
});
