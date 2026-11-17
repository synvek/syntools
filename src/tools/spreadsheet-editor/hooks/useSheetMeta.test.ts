import { act, renderHook } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { NamedRange } from '../namedRanges';
import type { SheetProtectionPassword, SheetProtectionState } from '../sheetProtection';
import type { SheetTable } from '../sheetTables';
import type { WorkbookSnapshot } from '../xlsx-io';
import { useSheetMeta, type MetaEngine, type UseSheetMetaOptions } from './useSheetMeta';

const deps = vi.hoisted(() => ({
  createTableFromSelection: vi.fn(),
  takenNames: vi.fn(() => []),
  tablesInRange: vi.fn(),
  createPasswordHash: vi.fn(),
}));

vi.mock('../sheetTables', () => ({
  createTableFromSelection: deps.createTableFromSelection,
  takenNames: deps.takenNames,
  tablesInRange: deps.tablesInRange,
}));

vi.mock('../sheetProtection', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../sheetProtection')>();
  return { ...actual, createPasswordHash: deps.createPasswordHash };
});

const SNAPSHOT = {
  sheetOrder: ['s1'],
  sheets: {
    s1: {
      id: 's1',
      name: '表',
      cellData: {
        '0': { '0': { v: '姓名' }, '1': { v: '数字' } },
        '1': { '0': { v: '张三' }, '1': { v: 1 } },
      },
    },
  },
} as unknown as WorkbookSnapshot;

function fakeEngine(overrides: Partial<MetaEngine> = {}): MetaEngine {
  return {
    getActiveSheetId: () => 's1',
    getActiveRange: () => ({ startRow: 0, startColumn: 0, endRow: 1, endColumn: 1 }),
    getSnapshot: () => SNAPSHOT,
    ...overrides,
  };
}

function setup(overrides: Partial<UseSheetMetaOptions> = {}) {
  const onCommit = vi.fn();
  const options: UseSheetMetaOptions = {
    handleRef: { current: fakeEngine() },
    onCommit,
    messages: { tableNeedsRows: '至少两行', tableNotFound: '选区内没有表格' },
    ...overrides,
  };
  const view = renderHook(() => useSheetMeta(options));
  return { view, onCommit };
}

const RANGE = { startRow: 0, startColumn: 0, endRow: 2, endColumn: 2 };
const NAME: NamedRange = { id: 'n1', name: '税率', ref: 'Sheet1!$A$1', sheetId: 's1' };
const TABLE: SheetTable = {
  id: 't1',
  name: '表1',
  sheetId: 's1',
  range: RANGE,
  columns: ['姓名', '数字'],
  headerRow: true,
  totalsRow: false,
  style: { name: 'TableStyleMedium2', showRowStripes: true },
};
const GUARD: SheetProtectionState = { sheetId: 's1', enabled: true, flags: {} };
/** `createPasswordHash` 的返回形态（exceljs 算出的哈希三件套 + spinCount） */
const HASH: SheetProtectionPassword = {
  algorithmName: 'SHA-512',
  hashValue: 'hash-1',
  saltValue: 'salt-1',
  spinCount: 100000,
};

beforeEach(() => {
  vi.clearAllMocks();
  deps.createTableFromSelection.mockReturnValue(TABLE);
  deps.tablesInRange.mockReturnValue([TABLE]);
  deps.createPasswordHash.mockResolvedValue(HASH);
});

describe('useSheetMeta（名称）', () => {
  it('改名称：ref 与 state 同源，并显式落盘（名称不是 mutation）', () => {
    const { view, onCommit } = setup();
    act(() => view.result.current.updateNames([NAME]));
    expect(view.result.current.namedRanges).toEqual([NAME]);
    expect(view.result.current.namedRangesRef.current).toEqual([NAME]);
    expect(onCommit).toHaveBeenCalledTimes(1);
  });

  it('关面板时清掉半成品名称，并再落一次盘', () => {
    const { view, onCommit } = setup();
    act(() =>
      view.result.current.updateNames([NAME, { id: 'n2', name: '', ref: '', sheetId: 's1' }]),
    );
    act(() => view.result.current.openNames());
    act(() => view.result.current.closeNames());
    expect(view.result.current.namesOpen).toBe(false);
    expect(view.result.current.namedRanges).toHaveLength(1);
    expect(onCommit).toHaveBeenCalledTimes(2);
  });

  it('没有可清理的内容时，关面板不产生额外写盘', () => {
    const { view, onCommit } = setup();
    act(() => view.result.current.updateNames([NAME]));
    act(() => view.result.current.openNames());
    act(() => view.result.current.closeNames());
    expect(onCommit).toHaveBeenCalledTimes(1);
  });

  it('打开面板时记下选区（区域写 A1:B2，单格写 A1）', () => {
    const { view } = setup({
      handleRef: {
        current: fakeEngine({
          getActiveRange: () => ({ startRow: 0, startColumn: 0, endRow: 1, endColumn: 2 }),
        }),
      },
    });
    act(() => view.result.current.openNames());
    expect(view.result.current.selectionLabel).toBe('A1:C2');

    const { view: single } = setup({
      handleRef: {
        current: fakeEngine({
          getActiveRange: () => ({ startRow: 4, startColumn: 2, endRow: 4, endColumn: 2 }),
        }),
      },
    });
    act(() => single.result.current.openNames());
    expect(single.result.current.selectionLabel).toBe('C5');
  });

  it('没有选区时标签为 null（面板里"用选区填入"自然不可用）', () => {
    const { view } = setup({
      handleRef: { current: fakeEngine({ getActiveRange: () => null }) },
    });
    act(() => view.result.current.openNames());
    expect(view.result.current.selectionLabel).toBeNull();
    expect(view.result.current.namesOpen).toBe(true);
  });
});

describe('useSheetMeta（表格）', () => {
  it('插入表格：用当前选区建表并落盘', () => {
    const { view, onCommit } = setup();
    act(() => view.result.current.insertTable());
    expect(deps.createTableFromSelection).toHaveBeenCalled();
    expect(view.result.current.tables).toEqual([TABLE]);
    expect(onCommit).toHaveBeenCalledTimes(1);
  });

  it('选区太窄时退回已用区域；整张表都没有内容就什么都不做', () => {
    const { view } = setup({
      handleRef: {
        current: fakeEngine({
          getActiveRange: () => ({ startRow: 0, startColumn: 0, endRow: 0, endColumn: 0 }),
        }),
      },
    });
    act(() => view.result.current.insertTable());
    // 已用区域有两行，仍然能建表
    expect(view.result.current.tables).toHaveLength(1);

    const empty = {
      sheetOrder: ['s1'],
      sheets: { s1: { id: 's1', name: '空', cellData: {} } },
    } as unknown as WorkbookSnapshot;
    const { view: blank, onCommit } = setup({
      handleRef: {
        current: fakeEngine({
          getActiveRange: () => null,
          getSnapshot: () => empty,
        }),
      },
    });
    act(() => blank.result.current.insertTable());
    expect(blank.result.current.tables).toHaveLength(0);
    expect(onCommit).not.toHaveBeenCalled();
  });

  it('建不出来（没有可用的表头）：给提示，不落盘', () => {
    deps.createTableFromSelection.mockReturnValue(null);
    const { view, onCommit } = setup();
    act(() => view.result.current.insertTable());
    expect(view.result.current.tableNotice).toBe('至少两行');
    expect(onCommit).not.toHaveBeenCalled();
  });

  it('插入 / 删除都跳过受保护的表（保护 = 不能改结构）', () => {
    const { view, onCommit } = setup();
    act(() => view.result.current.adoptOnce({ namedRanges: [], protection: [GUARD], tables: [] }));

    act(() => view.result.current.insertTable());
    expect(view.result.current.tables).toHaveLength(0);

    act(() =>
      view.result.current.adoptOnce({ namedRanges: [], protection: [GUARD], tables: [TABLE] }),
    );
    act(() => view.result.current.deleteTable());
    expect(view.result.current.tables).toHaveLength(0);
    expect(onCommit).not.toHaveBeenCalled();
  });

  it('删除：选区内没有表格时给提示，不落盘', () => {
    deps.tablesInRange.mockReturnValue([]);
    const { view, onCommit } = setup();
    act(() => view.result.current.deleteTable());
    expect(view.result.current.tableNotice).toBe('选区内没有表格');
    expect(onCommit).not.toHaveBeenCalled();
  });

  it('删除：整块移除相交的表格', () => {
    const { view, onCommit } = setup();
    act(() => view.result.current.adoptOnce({ namedRanges: [], protection: [], tables: [TABLE] }));
    act(() => view.result.current.deleteTable());
    expect(view.result.current.tables).toHaveLength(0);
    expect(onCommit).toHaveBeenCalledTimes(1);
  });
});

describe('useSheetMeta（保护）', () => {
  it('开启：算一次哈希、写进保护状态、关面板', async () => {
    const { view, onCommit } = setup();
    act(() => view.result.current.openProtect());
    await act(() =>
      view.result.current.applyProtection({
        enabled: true,
        flags: { selectLockedCells: true },
        password: 'pw',
      }),
    );
    expect(deps.createPasswordHash).toHaveBeenCalledWith('pw');
    expect(view.result.current.protection[0]).toMatchObject({
      sheetId: 's1',
      enabled: true,
      password: HASH,
    });
    expect(view.result.current.protectOpen).toBe(false);
    expect(view.result.current.protectBusy).toBe(false);
    expect(onCommit).toHaveBeenCalledTimes(1);
  });

  it('只改"允许的操作"时保留已有密码（不因为哈希失败把密码丢掉）', async () => {
    deps.createPasswordHash.mockResolvedValue(null);
    const oldHash: SheetProtectionPassword = { ...HASH, hashValue: 'old' };
    const { view } = setup();
    act(() =>
      view.result.current.adoptOnce({
        namedRanges: [],
        protection: [{ sheetId: 's1', enabled: true, flags: {}, password: oldHash }],
        tables: [],
      }),
    );
    await act(() =>
      view.result.current.applyProtection({ enabled: true, flags: { sort: true }, password: '' }),
    );
    expect(view.result.current.protection[0].password).toEqual(oldHash);
    expect(view.result.current.protection[0].flags).toEqual({ sort: true });
  });

  it('关闭：移除该表的保护并落盘', async () => {
    const { view, onCommit } = setup();
    act(() => view.result.current.adoptOnce({ namedRanges: [], protection: [GUARD], tables: [] }));
    await act(() =>
      view.result.current.applyProtection({ enabled: false, flags: {}, password: '' }),
    );
    expect(view.result.current.protection).toEqual([]);
    expect(onCommit).toHaveBeenCalledTimes(1);
  });

  it('没有活动工作表时是空操作（连忙状态都不点亮）', async () => {
    const { view, onCommit } = setup({
      handleRef: { current: fakeEngine({ getActiveSheetId: () => null }) },
    });
    await act(() =>
      view.result.current.applyProtection({ enabled: true, flags: {}, password: 'pw' }),
    );
    expect(deps.createPasswordHash).not.toHaveBeenCalled();
    expect(onCommit).not.toHaveBeenCalled();
    expect(view.result.current.protectBusy).toBe(false);
  });
});

describe('useSheetMeta（采纳与清理）', () => {
  it('删表清理只移除挂在该表上的条目，其它表的原样保留', () => {
    const { view } = setup();
    const other: NamedRange = { ...NAME, id: 'n2', sheetId: 's2' };
    act(() =>
      view.result.current.adoptOnce({
        namedRanges: [NAME, other],
        protection: [GUARD, { ...GUARD, sheetId: 's2' }],
        tables: [TABLE, { ...TABLE, id: 't2', sheetId: 's2' }],
      }),
    );
    act(() => view.result.current.pruneSheet('s1'));
    expect(view.result.current.namedRanges.map((item) => item.id)).toEqual(['n2']);
    expect(view.result.current.protection.map((item) => item.sheetId)).toEqual(['s2']);
    expect(view.result.current.tables.map((item) => item.id)).toEqual(['t2']);
  });

  it('adoptOnce 只生效一次：实例重建不会覆盖用户刚改的名称', () => {
    const { view } = setup();
    act(() => view.result.current.updateNames([NAME]));
    let adopted = true;
    act(() => {
      adopted = view.result.current.adoptOnce({ namedRanges: [], protection: [], tables: [] });
    });
    expect(adopted).toBe(false);
    expect(view.result.current.namedRanges).toEqual([NAME]);
  });

  it('换文档重置一切并清掉旧提示', () => {
    deps.createTableFromSelection.mockReturnValue(null);
    const { view } = setup();
    act(() => view.result.current.insertTable());
    expect(view.result.current.tableNotice).toBe('至少两行');

    act(() => view.result.current.reset({ namedRanges: [NAME], protection: [], tables: [TABLE] }));
    expect(view.result.current.namedRanges).toEqual([NAME]);
    expect(view.result.current.tables).toEqual([TABLE]);
    expect(view.result.current.tableNotice).toBeNull();
  });
});
