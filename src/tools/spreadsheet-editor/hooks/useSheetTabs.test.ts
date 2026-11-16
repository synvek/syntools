import { act, renderHook } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { useSheetTabs, type SheetTabsEngine } from './useSheetTabs';

/** P2-4：标签栏编排从组件里搬出来后，成功路径与**失败路径**都能在这里断言 */

interface FakeEngine extends SheetTabsEngine {
  calls: string[];
  sheets: { id: string; name: string; hidden: boolean }[];
  active: string | null;
  /** 让 setSheetHidden 拒绝，模拟"最后一张可见表" */
  rejectHide?: boolean;
}

function fakeEngine(): FakeEngine {
  const engine: FakeEngine = {
    calls: [],
    sheets: [
      { id: 'a', name: 'Data', hidden: false },
      { id: 'b', name: 'Notes', hidden: false },
    ],
    active: 'a',
    getSheets: () => engine.sheets.map((sheet) => ({ ...sheet })),
    getActiveSheetId: () => engine.active,
    addSheet: () => {
      engine.calls.push('add');
      engine.sheets.push({ id: `s${engine.sheets.length + 1}`, name: 'Sheet', hidden: false });
    },
    setActiveSheet: (id) => {
      engine.calls.push(`select:${id}`);
      engine.active = id;
    },
    renameSheet: (id, name) => {
      engine.calls.push(`rename:${id}=${name}`);
      engine.sheets = engine.sheets.map((sheet) => (sheet.id === id ? { ...sheet, name } : sheet));
    },
    deleteSheet: (id) => {
      engine.calls.push(`delete:${id}`);
      engine.sheets = engine.sheets.filter((sheet) => sheet.id !== id);
    },
    duplicateSheet: (id) => {
      engine.calls.push(`duplicate:${id}`);
    },
    setSheetHidden: (id, hidden) => {
      engine.calls.push(`hidden:${id}=${hidden}`);
      if (engine.rejectHide) return false;
      engine.sheets = engine.sheets.map((sheet) =>
        sheet.id === id ? { ...sheet, hidden } : sheet,
      );
      return true;
    },
  };
  return engine;
}

function setup(engine: FakeEngine | null = fakeEngine()) {
  const handleRef = { current: engine };
  const onRemoved = vi.fn();
  const onCommit = vi.fn();
  const onError = vi.fn();
  const view = renderHook(() =>
    useSheetTabs({
      handleRef,
      onRemoved,
      onCommit,
      onError,
      lastVisibleMessage: '至少保留一张可见工作表',
    }),
  );
  return { engine, handleRef, onRemoved, onCommit, onError, view };
}

describe('useSheetTabs', () => {
  it('refresh 读引擎的列表与当前表', () => {
    const { view } = setup();
    act(() => view.result.current.refresh());
    expect(view.result.current.sheets.map((sheet) => sheet.id)).toEqual(['a', 'b']);
    expect(view.result.current.activeSheetId).toBe('a');
  });

  it('新增 / 重命名 / 复制后列表跟着刷新', () => {
    const { view, engine } = setup();
    act(() => view.result.current.add());
    expect(engine?.calls).toContain('add');
    expect(view.result.current.sheets).toHaveLength(3);

    act(() => view.result.current.rename('a', 'Renamed'));
    expect(view.result.current.sheets[0].name).toBe('Renamed');

    act(() => view.result.current.duplicate('a'));
    expect(engine?.calls).toContain('duplicate:a');
  });

  it('删表会触发清理回调与显式落盘（对象残留会写进别的表）', () => {
    const { view, onRemoved, onCommit } = setup();
    act(() => view.result.current.remove('b'));
    expect(onRemoved).toHaveBeenCalledWith('b');
    expect(onCommit).toHaveBeenCalledTimes(1);
    expect(view.result.current.sheets.map((sheet) => sheet.id)).toEqual(['a']);
  });

  it('隐藏成功：刷新 + 落盘（可见性不进脏标记）', () => {
    const { view, onCommit, onError } = setup();
    let changed = false;
    act(() => {
      changed = view.result.current.setHidden('b', true);
    });
    expect(changed).toBe(true);
    expect(onCommit).toHaveBeenCalledTimes(1);
    expect(onError).not.toHaveBeenCalled();
  });

  it('引擎拒绝隐藏（最后一张可见表）：给出文案、不落盘、返回 false', () => {
    const { view, engine, onCommit, onError } = setup();
    if (engine) engine.rejectHide = true;
    let changed = true;
    act(() => {
      changed = view.result.current.setHidden('a', true);
    });
    expect(changed).toBe(false);
    expect(onError).toHaveBeenCalledWith('至少保留一张可见工作表');
    expect(onCommit).not.toHaveBeenCalled();
  });

  it('引擎还没建好时所有动作都是空操作，不清空已有列表', () => {
    const { view, handleRef } = setup();
    act(() => view.result.current.refresh());
    expect(view.result.current.sheets).toHaveLength(2);

    handleRef.current = null;
    act(() => {
      view.result.current.add();
      view.result.current.select('b');
      view.result.current.setHidden('a', true);
    });
    // 列表保持上一次的快照，不会因为"引擎暂时为空"闪成空表
    expect(view.result.current.sheets).toHaveLength(2);
    expect(view.result.current.setHidden('a', true)).toBe(false);
  });
});
