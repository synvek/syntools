import { act, renderHook } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { PivotConfig } from '../pivot';
import type { WorkbookSnapshot } from '../xlsx-io';
import { useSheetPivot, type PivotEngine, type UseSheetPivotOptions } from './useSheetPivot';

/** 区域 / 季度 / 金额，够跑一个 2×1 的小交叉表 */
const SNAPSHOT = {
  sheetOrder: ['s1'],
  sheets: {
    s1: {
      id: 's1',
      name: '表',
      cellData: {
        '0': { '0': { v: '区域' }, '1': { v: '季度' }, '2': { v: '金额' } },
        '1': { '0': { v: '华东' }, '1': { v: 'Q1' }, '2': { v: 100 } },
        '2': { '0': { v: '华南' }, '1': { v: 'Q1' }, '2': { v: 30 } },
      },
    },
    // 已经插入过的透视结果表（旧内容 1 行 2 列，更新前要按这个范围清空）
    s2: { id: 's2', name: '透视表', cellData: { '0': { '0': { v: '旧' }, '1': { v: '值' } } } },
  },
} as unknown as WorkbookSnapshot;

const EMPTY = { sheetOrder: [], sheets: {} } as unknown as WorkbookSnapshot;

const CONFIG: PivotConfig = {
  id: 'pivot-1',
  name: '透视表',
  sheetId: 's1',
  range: { startRow: 0, startColumn: 0, endRow: 2, endColumn: 2 },
  rows: [0],
  cols: [1],
  values: [{ column: 2, aggregation: 'sum' }],
  filters: {},
  hasHeader: true,
};

function fakeEngine(overrides: Partial<PivotEngine> = {}): PivotEngine {
  return {
    getSnapshot: () => SNAPSHOT,
    getActiveSheetId: () => 's1',
    getActiveRange: () => ({ startRow: 0, startColumn: 0, endRow: 2, endColumn: 2 }),
    getSheets: () => [{ id: 's1', name: '表' }],
    setActiveSheet: vi.fn(),
    writeSheetValues: vi.fn(() => true),
    insertSheetWithValues: vi.fn(() => 's2'),
    ...overrides,
  };
}

function setup(
  overrides: Partial<UseSheetPivotOptions> = {},
  engineOverrides: Partial<PivotEngine> = {},
) {
  const onCommit = vi.fn();
  const onSheetsChanged = vi.fn();
  const engine = fakeEngine(engineOverrides);
  const options: UseSheetPivotOptions = {
    handleRef: { current: engine },
    onCommit,
    onSheetsChanged,
    isSheetProtected: () => false,
    valueLabel: () => '金额',
    messages: { title: '透视表', blank: '', values: '值' },
    ...overrides,
  };
  const view = renderHook(() => useSheetPivot(options));
  return { view, engine, onCommit, onSheetsChanged };
}

beforeEach(() => {
  vi.clearAllMocks();
});

describe('useSheetPivot（面板与配置）', () => {
  it('打开面板：没有配置就新建 pivot-1，默认布局取自选区', () => {
    const { view, onCommit } = setup();
    act(() => view.result.current.openPanel());
    const config = view.result.current.config;
    expect(config).toMatchObject({
      id: 'pivot-1',
      name: '透视表',
      sheetId: 's1',
      range: { startRow: 0, startColumn: 0, endRow: 2, endColumn: 2 },
      rows: [0],
      cols: [1],
      values: [{ column: 2, aggregation: 'sum' }],
      hasHeader: true,
    });
    expect(view.result.current.configs).toHaveLength(1);
    expect(view.result.current.open).toBe(true);
    expect(onCommit).toHaveBeenCalledTimes(1);
  });

  it('打开面板：同一张表重开时沿用已有配置，不重复新建', () => {
    const { view, onCommit } = setup();
    act(() => view.result.current.openPanel());
    act(() => view.result.current.closePanel());
    act(() => view.result.current.openPanel());
    expect(view.result.current.configs).toHaveLength(1);
    expect(view.result.current.config?.id).toBe('pivot-1');
    expect(onCommit).toHaveBeenCalledTimes(2);
  });

  it('既没有活动表也没有任何表：不进面板，也不落盘', () => {
    const { view, onCommit } = setup({
      handleRef: {
        current: fakeEngine({ getActiveSheetId: () => null, getSnapshot: () => EMPTY }),
      },
    });
    act(() => view.result.current.openPanel());
    expect(view.result.current.open).toBe(false);
    expect(view.result.current.config).toBeNull();
    expect(onCommit).not.toHaveBeenCalled();
  });

  it('改配置按 id 就地替换，不重置整个列表（多实例不互相覆盖）', () => {
    const { view } = setup();
    act(() => view.result.current.openPanel());
    act(() => view.result.current.create());
    act(() => {
      const current = view.result.current.config;
      if (current) view.result.current.applyConfig({ ...current, name: '改过' });
    });
    expect(view.result.current.configs.map((item) => item.id)).toEqual(['pivot-1', 'pivot-2']);
    expect(view.result.current.configs[1].name).toBe('改过');
    expect(view.result.current.config?.name).toBe('改过');
  });

  it('新建实例：id 递增、名字带序号，并切到新实例', () => {
    const { view } = setup();
    act(() => view.result.current.openPanel());
    act(() => view.result.current.create());
    expect(view.result.current.configs).toHaveLength(2);
    expect(view.result.current.config?.id).toBe('pivot-2');
    expect(view.result.current.config?.name).toBe('透视表 2');
  });

  it('切换实例：源快照从当前文档重读（别的表上的数据可能刚改过）', () => {
    const { view, engine } = setup();
    act(() => view.result.current.openPanel());
    act(() => view.result.current.create());
    const fresh = { ...SNAPSHOT, sheetOrder: ['s1'] } as WorkbookSnapshot;
    engine.getSnapshot = vi.fn(() => fresh);
    act(() => view.result.current.select('pivot-1'));
    expect(view.result.current.config?.id).toBe('pivot-1');
    expect(view.result.current.snapshot).toBe(fresh);
  });

  it('删除实例：只摘配置；删的是当前实例就切到下一个，列表空了就关面板', () => {
    const { view } = setup();
    act(() => view.result.current.openPanel());
    act(() => view.result.current.create());
    act(() => view.result.current.remove('pivot-1'));
    expect(view.result.current.configs.map((item) => item.id)).toEqual(['pivot-2']);
    expect(view.result.current.config?.id).toBe('pivot-2');

    act(() => view.result.current.remove('pivot-2'));
    expect(view.result.current.configs).toEqual([]);
    expect(view.result.current.config).toBeNull();
    expect(view.result.current.open).toBe(false);
  });

  it('用选区重设：字段偏移全部复位，实例 id 保留', () => {
    const { view } = setup();
    act(() => view.result.current.openPanel());
    act(() => {
      const current = view.result.current.config;
      if (current) view.result.current.applyConfig({ ...current, rows: [2], cols: [], values: [] });
    });
    act(() => view.result.current.useSelection());
    expect(view.result.current.config).toMatchObject({
      id: 'pivot-1',
      rows: [0],
      cols: [1],
      values: [{ column: 2, aggregation: 'sum' }],
    });
  });

  it('清除全部配置：配置清空、面板关闭、落一次盘', () => {
    const { view, onCommit } = setup();
    act(() => view.result.current.openPanel());
    act(() => view.result.current.removeAll());
    expect(view.result.current.configs).toEqual([]);
    expect(view.result.current.config).toBeNull();
    expect(view.result.current.open).toBe(false);
    expect(onCommit).toHaveBeenCalledTimes(2);
  });

  it('刷新：重取引擎快照（源数据改动后面板据此重算）', () => {
    const { view, engine } = setup();
    act(() => view.result.current.openPanel());
    const fresh = { ...SNAPSHOT } as WorkbookSnapshot;
    engine.getSnapshot = vi.fn(() => fresh);
    act(() => view.result.current.refresh());
    expect(view.result.current.snapshot).toBe(fresh);
  });
});

describe('useSheetPivot（插入到文档）', () => {
  it('首次插入：新建一张表并记下 outputSheetId，标签栏与落盘各通知一次', () => {
    const { view, engine, onSheetsChanged, onCommit } = setup();
    act(() => view.result.current.openPanel());
    act(() => view.result.current.insert());

    expect(engine.insertSheetWithValues).toHaveBeenCalledTimes(1);
    expect(engine.insertSheetWithValues).toHaveBeenCalledWith('透视表', expect.any(Array));
    expect(engine.setActiveSheet).toHaveBeenCalledWith('s2');
    expect(view.result.current.config?.outputSheetId).toBe('s2');
    expect(onSheetsChanged).toHaveBeenCalledTimes(1);
    expect(onCommit).toHaveBeenCalledTimes(3);
  });

  it('再次插入：覆盖同一张表并带上旧范围，不再新建', () => {
    const { view, engine } = setup(
      {},
      {
        getSheets: () => [
          { id: 's1', name: '表' },
          { id: 's2', name: '透视表' },
        ],
      },
    );
    act(() => view.result.current.adoptIfEmpty([{ ...CONFIG, outputSheetId: 's2' }]));
    act(() => view.result.current.select('pivot-1'));
    act(() => view.result.current.insert());

    expect(engine.insertSheetWithValues).not.toHaveBeenCalled();
    expect(engine.writeSheetValues).toHaveBeenCalledWith('s2', expect.any(Array), {
      rows: 1,
      columns: 2,
    });
  });

  it('目标表受保护：一个字都不写（保护的意义就是拦住写入）', () => {
    const { view, engine, onCommit } = setup(
      { isSheetProtected: () => true },
      {
        getSheets: () => [
          { id: 's1', name: '表' },
          { id: 's2', name: '透视表' },
        ],
      },
    );
    act(() => view.result.current.adoptIfEmpty([{ ...CONFIG, outputSheetId: 's2' }]));
    act(() => view.result.current.select('pivot-1'));
    act(() => view.result.current.insert());

    expect(engine.writeSheetValues).not.toHaveBeenCalled();
    expect(engine.insertSheetWithValues).not.toHaveBeenCalled();
    expect(onCommit).not.toHaveBeenCalled();
  });

  it('源区域没有数据：什么都不做', () => {
    const empty = {
      sheetOrder: ['s1'],
      sheets: { s1: { id: 's1', name: '空', cellData: {} } },
    } as unknown as WorkbookSnapshot;
    const { view, engine, onCommit } = setup({
      handleRef: {
        current: fakeEngine({ getSnapshot: () => empty, getActiveRange: () => null }),
      },
    });
    act(() => view.result.current.openPanel());
    act(() => view.result.current.insert());

    expect(engine.insertSheetWithValues).not.toHaveBeenCalled();
    expect(engine.writeSheetValues).not.toHaveBeenCalled();
    // 打开面板那一次落盘仍在，插入本身不再落盘
    expect(onCommit).toHaveBeenCalledTimes(1);
  });
});

describe('useSheetPivot（采纳与重置）', () => {
  it('adoptIfEmpty：列表为空才采纳，已有内容不被重建快照覆盖', () => {
    const { view } = setup();
    act(() => view.result.current.adoptIfEmpty([CONFIG]));
    expect(view.result.current.configs).toEqual([CONFIG]);

    act(() => view.result.current.adoptIfEmpty([{ ...CONFIG, id: 'pivot-9' }]));
    expect(view.result.current.configs).toEqual([CONFIG]);
  });

  it('reset：换文档替换配置，并清掉活动实例、关掉面板', () => {
    const { view } = setup();
    act(() => view.result.current.openPanel());
    expect(view.result.current.config).not.toBeNull();

    const next = [{ ...CONFIG, id: 'pivot-7', name: '新文档' }];
    act(() => view.result.current.reset(next));
    expect(view.result.current.configs).toEqual(next);
    expect(view.result.current.config).toBeNull();
    expect(view.result.current.open).toBe(false);
  });
});
