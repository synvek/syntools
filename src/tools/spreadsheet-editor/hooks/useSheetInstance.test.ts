import { renderHook } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { UniverHandle } from '../univer';
import type { WorkbookSnapshot } from '../xlsx-io';
import { useSheetInstance, type UseSheetInstanceOptions } from './useSheetInstance';

const deps = vi.hoisted(() => ({ readDraft: vi.fn() }));
vi.mock('../draft', () => ({ readDraft: deps.readDraft }));

const SNAPSHOT = { sheetOrder: ['s1'], sheets: {} } as unknown as WorkbookSnapshot;
const DRAFT = { sheetOrder: ['s1'], sheets: { s1: {} } } as unknown as WorkbookSnapshot;
const PENDING = {
  sheetOrder: ['s1'],
  sheets: { s1: { name: '待重建' } },
} as unknown as WorkbookSnapshot;

function fakeHandle() {
  const unsubscribeMutation = vi.fn();
  const unsubscribeViewport = vi.fn();
  let onMutation: (() => void) | null = null;
  let onViewport: (() => void) | null = null;
  const handle = {
    loadSnapshot: vi.fn(),
    onMutation: vi.fn((callback: () => void) => {
      onMutation = callback;
      return unsubscribeMutation;
    }),
    onViewportChange: vi.fn((callback: () => void) => {
      onViewport = callback;
      return unsubscribeViewport;
    }),
    getSnapshot: vi.fn(() => SNAPSHOT),
    dispose: vi.fn(),
  } as unknown as UniverHandle;
  return {
    handle,
    unsubscribeMutation,
    unsubscribeViewport,
    fireMutation: () => onMutation?.(),
    fireViewport: () => onViewport?.(),
  };
}

function setup(options: Partial<UseSheetInstanceOptions> = {}) {
  const container = document.createElement('div');
  const handleRef = { current: null as UniverHandle | null };
  const pendingRef = { current: null as WorkbookSnapshot | null };
  const subscriptionRef = { current: null as (() => void) | null };
  const created: ReturnType<typeof fakeHandle>[] = [];
  const create = vi.fn(() => {
    const fake = fakeHandle();
    created.push(fake);
    return fake.handle;
  });
  const callbacks = {
    adopt: vi.fn(),
    onHostChange: vi.fn(),
    onReady: vi.fn(),
    onMutation: vi.fn(),
    onViewport: vi.fn(),
    onFailure: vi.fn(),
    create,
  };
  const props: UseSheetInstanceOptions = {
    containerRef: { current: container },
    handleRef,
    pendingRef,
    subscriptionRef,
    engineOptions: { locale: 'zhCN', dark: false },
    ...callbacks,
    ...options,
  };
  const view = renderHook((next: UseSheetInstanceOptions) => useSheetInstance(next), {
    initialProps: props,
  });
  return { view, props, handleRef, pendingRef, subscriptionRef, created, ...callbacks };
}

beforeEach(() => {
  vi.clearAllMocks();
  vi.useFakeTimers();
  deps.readDraft.mockReturnValue(null);
  vi.spyOn(window, 'requestAnimationFrame').mockImplementation(() => 1);
});

afterEach(() => {
  vi.useRealTimers();
  vi.restoreAllMocks();
});

describe('useSheetInstance（创建）', () => {
  it('一个 tick 之后才实例化（StrictMode 双挂载的前提）', () => {
    const { create } = setup();
    expect(create).not.toHaveBeenCalled();
    vi.advanceTimersByTime(1);
    expect(create).toHaveBeenCalledWith(expect.any(HTMLDivElement), {
      locale: 'zhCN',
      dark: false,
    });
  });

  it('还在等待的那个 tick 被卸载取消：不会建出野实例', () => {
    const { create, view } = setup();
    view.unmount();
    vi.advanceTimersByTime(1);
    expect(create).not.toHaveBeenCalled();
  });

  it('建不起来时交给组件报运行时报错，不留下半截实例', () => {
    const { handleRef, onFailure, onHostChange, onReady } = setup({
      create: () => {
        throw new Error('WebGL unavailable');
      },
    });
    vi.advanceTimersByTime(1);
    expect(onFailure).toHaveBeenCalledTimes(1);
    expect(onHostChange).not.toHaveBeenCalled();
    expect(onReady).not.toHaveBeenCalled();
    expect(handleRef.current).toBeNull();
  });
});

describe('useSheetInstance（恢复）', () => {
  it('优先用重建前抓到的快照，而不是草稿', () => {
    const { pendingRef, created, adopt } = setup();
    pendingRef.current = PENDING;
    vi.advanceTimersByTime(1);
    expect(created[0].handle.loadSnapshot).toHaveBeenCalledWith(PENDING);
    expect(adopt).toHaveBeenCalledWith(PENDING);
    expect(deps.readDraft).not.toHaveBeenCalled();
  });

  it('没有待重建快照时读草稿', () => {
    const { created, adopt } = setup();
    deps.readDraft.mockReturnValue(DRAFT);
    vi.advanceTimersByTime(1);
    expect(created[0].handle.loadSnapshot).toHaveBeenCalledWith(DRAFT);
    expect(adopt).toHaveBeenCalledWith(DRAFT);
  });

  it('既没有快照也没有草稿：不 loadSnapshot，也不采纳', () => {
    const { created, adopt } = setup();
    vi.advanceTimersByTime(1);
    expect(created[0].handle.loadSnapshot).not.toHaveBeenCalled();
    expect(adopt).not.toHaveBeenCalled();
  });
});

describe('useSheetInstance（订阅与销毁）', () => {
  it('就绪后接管实例、订阅 mutation / viewport，并同步一次视口', () => {
    const { created, handleRef, onHostChange, onReady, onViewport, subscriptionRef } = setup();
    vi.advanceTimersByTime(1);
    const { handle, unsubscribeMutation } = created[0];
    expect(handleRef.current).toBe(handle);
    expect(onHostChange).toHaveBeenCalledWith(handle);
    expect(onReady).toHaveBeenCalledWith(handle);
    expect(subscriptionRef.current).toBe(unsubscribeMutation);
    expect(onViewport).toHaveBeenCalledWith(handle);
  });

  it('mutation 回调转发给组件（落盘 / 重算透视 / 形状重投影）', () => {
    const { created, onMutation } = setup();
    vi.advanceTimersByTime(1);
    created[0].fireMutation();
    expect(onMutation).toHaveBeenCalledTimes(1);
  });

  it('视口变化转发给组件', () => {
    const { created, onViewport } = setup();
    vi.advanceTimersByTime(1);
    onViewport.mockClear();
    created[0].fireViewport();
    expect(onViewport).toHaveBeenCalledWith(created[0].handle);
  });

  it('卸载：先抓快照再 dispose，退订两路，并清掉宿主', () => {
    const { view, created, handleRef, pendingRef, onHostChange } = setup();
    vi.advanceTimersByTime(1);
    const { handle, unsubscribeMutation, unsubscribeViewport } = created[0];
    view.unmount();
    expect(pendingRef.current).toBe(SNAPSHOT);
    expect(handle.dispose).toHaveBeenCalledTimes(1);
    expect(handleRef.current).toBeNull();
    expect(unsubscribeMutation).toHaveBeenCalledTimes(1);
    expect(unsubscribeViewport).toHaveBeenCalledTimes(1);
    expect(onHostChange).toHaveBeenLastCalledWith(null);
  });

  it('卸载后旧实例的视口回调不再生效（cancelled 保护）', () => {
    const { view, created, onViewport } = setup();
    vi.advanceTimersByTime(1);
    onViewport.mockClear();
    view.unmount();
    created[0].fireViewport();
    expect(onViewport).not.toHaveBeenCalled();
  });

  it('换主题 = 重建：旧实例先销毁，新实例复用抓到的快照', () => {
    const { view, props, create, created, pendingRef, adopt } = setup();
    vi.advanceTimersByTime(1);
    const first = created[0];

    view.rerender({ ...props, engineOptions: { locale: 'zhCN', dark: true } });
    // 清理先跑：旧实例抓快照 → dispose → 退订
    expect(first.handle.dispose).toHaveBeenCalledTimes(1);
    expect(pendingRef.current).toBe(SNAPSHOT);
    expect(first.unsubscribeMutation).toHaveBeenCalledTimes(1);

    vi.advanceTimersByTime(1);
    expect(create).toHaveBeenCalledTimes(2);
    expect(create).toHaveBeenLastCalledWith(expect.any(HTMLDivElement), {
      locale: 'zhCN',
      dark: true,
    });
    expect(adopt).toHaveBeenLastCalledWith(SNAPSHOT);
  });
});
