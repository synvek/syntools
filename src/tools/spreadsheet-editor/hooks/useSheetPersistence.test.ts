import { act, renderHook } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { summarizeWorkbook } from '../core';
import type { WorkbookSnapshot } from '../xlsx-io';
import {
  useSheetPersistence,
  type PersistenceEngine,
  type UseSheetPersistenceOptions,
} from './useSheetPersistence';

const deps = vi.hoisted(() => ({
  writeDraftSafe: vi.fn(),
  createDocId: vi.fn(() => 'doc-1'),
  saveDocument: vi.fn(async () => true),
  setCurrentDocId: vi.fn(),
}));

vi.mock('../draft', () => ({ writeDraftSafe: deps.writeDraftSafe }));
vi.mock('../docStore', () => ({
  createDocId: deps.createDocId,
  saveDocument: deps.saveDocument,
  setCurrentDocId: deps.setCurrentDocId,
}));

const BASE = {
  sheetOrder: ['s1'],
  sheets: { s1: { id: 's1', name: '表', cellData: { '0': { '0': { v: 'x' } } } } },
} as unknown as WorkbookSnapshot;
const MERGED = { ...BASE, syntoolsNamedRanges: [] } as unknown as WorkbookSnapshot;

function fakeEngine(overrides: Partial<PersistenceEngine> = {}): PersistenceEngine {
  return {
    getSnapshot: () => BASE,
    getActiveSheetId: () => 's1',
    ...overrides,
  };
}

function setup(overrides: Partial<UseSheetPersistenceOptions> = {}) {
  const withDocOwnedContent = vi.fn(() => MERGED);
  const syncChartData = vi.fn();
  const getTitle = vi.fn(() => '标题');
  const onSummary = vi.fn();
  const onDocSaved = vi.fn();
  const options: UseSheetPersistenceOptions = {
    handleRef: { current: fakeEngine() },
    withDocOwnedContent,
    syncChartData,
    getTitle,
    onSummary,
    onDocSaved,
    ...overrides,
  };
  const view = renderHook(() => useSheetPersistence(options));
  return { view, withDocOwnedContent, syncChartData, getTitle, onSummary, onDocSaved };
}

beforeEach(() => {
  vi.clearAllMocks();
  vi.useFakeTimers();
  deps.writeDraftSafe.mockReturnValue({ ok: true, degraded: false });
  deps.saveDocument.mockResolvedValue(true);
  deps.createDocId.mockReturnValue('doc-1');
});

afterEach(() => {
  vi.useRealTimers();
});

describe('useSheetPersistence（草稿）', () => {
  it('立即落盘：合成快照后写草稿，并顺带刷新汇总与内存统计', () => {
    const { view, withDocOwnedContent, syncChartData, onSummary } = setup();
    act(() => view.result.current.persistNow());

    expect(syncChartData).toHaveBeenCalledWith(BASE, 's1');
    expect(withDocOwnedContent).toHaveBeenCalledWith(BASE);
    expect(deps.writeDraftSafe).toHaveBeenCalledWith(MERGED);
    expect(deps.writeDraftSafe).toHaveBeenCalledTimes(1);
    expect(onSummary).toHaveBeenCalledWith(summarizeWorkbook(BASE));
    expect(view.result.current.draftSaved).toBe(true);
    expect(view.result.current.draftNotice).toBeNull();
    expect(view.result.current.memoryBytes).toBeGreaterThan(0);
  });

  it('草稿写不了要能区分原因：localStorage 不可用（degraded）与超体积（failed）', () => {
    const { view } = setup();
    deps.writeDraftSafe.mockReturnValue({ ok: false, degraded: true });
    act(() => view.result.current.persistNow());
    expect(view.result.current.draftSaved).toBe(false);
    expect(view.result.current.draftNotice).toBe('degraded');

    deps.writeDraftSafe.mockReturnValue({ ok: false, degraded: false });
    act(() => view.result.current.persistNow());
    expect(view.result.current.draftNotice).toBe('failed');

    deps.writeDraftSafe.mockReturnValue({ ok: true, degraded: false });
    act(() => view.result.current.persistNow());
    expect(view.result.current.draftNotice).toBeNull();
  });

  it('没有引擎时是空操作（不写草稿、不分配文档 id）', () => {
    const { view } = setup({ handleRef: { current: null } });
    act(() => view.result.current.persistNow());
    expect(deps.writeDraftSafe).not.toHaveBeenCalled();
    expect(deps.createDocId).not.toHaveBeenCalled();
    expect(view.result.current.docId).toBeNull();
  });

  it('文档 id 懒分配：首次保存才建，之后复用', () => {
    const { view } = setup();
    act(() => view.result.current.persistNow());
    act(() => view.result.current.persistNow());
    expect(deps.createDocId).toHaveBeenCalledTimes(1);
    expect(deps.setCurrentDocId).toHaveBeenCalledWith('doc-1');
    expect(view.result.current.docId).toBe('doc-1');
    // 两次保存只排队一份快照：10s 后写库一次
    vi.advanceTimersByTime(10_000);
    expect(deps.saveDocument).toHaveBeenCalledTimes(1);
  });

  it('打开文档时采纳已有 id，不再新建', () => {
    const { view } = setup();
    act(() => view.result.current.adoptDocId('doc-9'));
    act(() => view.result.current.persistNow('改名'));
    expect(deps.createDocId).not.toHaveBeenCalled();
    vi.advanceTimersByTime(10_000);
    expect(deps.saveDocument).toHaveBeenCalledWith('doc-9', '改名', MERGED);
  });

  it('resetDraftState 清掉"已保存"与失败提示', () => {
    const { view } = setup();
    deps.writeDraftSafe.mockReturnValue({ ok: false, degraded: true });
    act(() => view.result.current.persistNow());
    expect(view.result.current.draftNotice).toBe('degraded');
    act(() => view.result.current.resetDraftState());
    expect(view.result.current.draftSaved).toBe(false);
    expect(view.result.current.draftNotice).toBeNull();
  });
});

describe('useSheetPersistence（去抖）', () => {
  it('编辑事件去抖：600ms 内多次触发只落一次盘', () => {
    const { view } = setup();
    act(() => {
      view.result.current.scheduleSave();
      view.result.current.scheduleSave();
      view.result.current.scheduleSave();
    });
    expect(deps.writeDraftSafe).not.toHaveBeenCalled();

    act(() => {
      vi.advanceTimersByTime(700);
    });
    expect(deps.writeDraftSafe).toHaveBeenCalledTimes(1);
  });

  it('文档库是慢通道：10s 后只写最后一份', async () => {
    const { view } = setup();
    act(() => view.result.current.persistNow('第一版'));
    act(() => view.result.current.persistNow('第二版'));
    expect(deps.saveDocument).not.toHaveBeenCalled();

    await act(async () => {
      await vi.advanceTimersByTimeAsync(10_000);
    });
    expect(deps.saveDocument).toHaveBeenCalledTimes(1);
    expect(deps.saveDocument).toHaveBeenCalledWith('doc-1', '第二版', MERGED);
  });

  it('没有标题参数时用当前标题', () => {
    const { view, getTitle } = setup();
    act(() => view.result.current.persistNow());
    vi.advanceTimersByTime(10_000);
    expect(getTitle).toHaveBeenCalled();
    expect(deps.saveDocument).toHaveBeenCalledWith('doc-1', '标题', MERGED);
  });
});

describe('useSheetPersistence（兜底）', () => {
  it('flushDocSave：立刻写库，并在成功后刷新文档列表', async () => {
    const { view, onDocSaved } = setup();
    act(() => view.result.current.persistNow());
    await act(async () => {
      view.result.current.flushDocSave();
    });
    expect(deps.saveDocument).toHaveBeenCalledTimes(1);
    expect(onDocSaved).toHaveBeenCalledTimes(1);
  });

  it('没有待写内容时 flush 不写库，也不通知', () => {
    const { view, onDocSaved } = setup();
    act(() => view.result.current.flushDocSave());
    expect(deps.saveDocument).not.toHaveBeenCalled();
    expect(onDocSaved).not.toHaveBeenCalled();
  });

  it('pagehide：把待写的那一份推出去', () => {
    const { view } = setup();
    act(() => view.result.current.persistNow());
    act(() => {
      window.dispatchEvent(new Event('pagehide'));
    });
    expect(deps.saveDocument).toHaveBeenCalledTimes(1);
  });

  it('切到后台（hidden）：草稿立即落一份，库也刷一次', () => {
    const { view } = setup();
    act(() => view.result.current.persistNow());
    expect(deps.writeDraftSafe).toHaveBeenCalledTimes(1);

    Object.defineProperty(document, 'visibilityState', { value: 'hidden', configurable: true });
    act(() => {
      document.dispatchEvent(new Event('visibilitychange'));
    });
    expect(deps.writeDraftSafe).toHaveBeenCalledTimes(2);
    expect(deps.saveDocument).toHaveBeenCalledTimes(1);
  });

  it('卸载时把排队中的库写入推出去', () => {
    const { view } = setup();
    act(() => view.result.current.persistNow());
    view.unmount();
    expect(deps.saveDocument).toHaveBeenCalledTimes(1);
  });
});
