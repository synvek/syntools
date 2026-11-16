import { act, renderHook, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { DocMeta, DocStoreStatus, StoredVersion } from '../docStore';
import type { WorkbookSnapshot } from '../xlsx-io';
import { useSheetDocLibrary, type UseDocLibraryOptions } from './useSheetDocLibrary';

const store = vi.hoisted(() => ({
  listDocuments: vi.fn(),
  loadDocument: vi.fn(),
  listVersions: vi.fn(),
  deleteVersion: vi.fn(),
  clearVersions: vi.fn(),
  deleteDocument: vi.fn(),
  duplicateDocument: vi.fn(),
  initDocStore: vi.fn(),
  retryDocStore: vi.fn(),
  estimateStorage: vi.fn(),
  setCurrentDocId: vi.fn(),
  createDocId: vi.fn(),
  getDocStoreStatus: vi.fn((): DocStoreStatus => ({ ok: true })),
  subscribeDocStoreStatus: vi.fn(() => () => {}),
}));

vi.mock('../docStore', () => ({
  listDocuments: store.listDocuments,
  loadDocument: store.loadDocument,
  listVersions: store.listVersions,
  deleteVersion: store.deleteVersion,
  clearVersions: store.clearVersions,
  deleteDocument: store.deleteDocument,
  duplicateDocument: store.duplicateDocument,
  initDocStore: store.initDocStore,
  retryDocStore: store.retryDocStore,
  estimateStorage: store.estimateStorage,
  setCurrentDocId: store.setCurrentDocId,
  createDocId: store.createDocId,
  getDocStoreStatus: store.getDocStoreStatus,
  subscribeDocStoreStatus: store.subscribeDocStoreStatus,
}));

const SNAPSHOT = { sheetOrder: ['s1'] } as unknown as WorkbookSnapshot;
const DOCS: DocMeta[] = [
  { id: 'a', title: '预算', updatedAt: 1 },
  { id: 'b', title: '', updatedAt: 1 },
];
const VERSION: StoredVersion = {
  id: 'v1',
  docId: 'a',
  title: '旧版',
  savedAt: 1,
  snapshot: SNAPSHOT,
};

function setup(overrides: Partial<UseDocLibraryOptions> = {}) {
  const docIdRef = { current: 'a' as string | null };
  const onAdoptDocId = vi.fn();
  const onOpenSnapshot = vi.fn();
  const onResetWorkbook = vi.fn();
  const onPersist = vi.fn();
  const onFlush = vi.fn();
  const confirm = overrides.confirm ?? vi.fn(() => true);
  const options: UseDocLibraryOptions = {
    docIdRef,
    onAdoptDocId,
    onOpenSnapshot,
    onResetWorkbook,
    onPersist,
    onFlush,
    messages: {
      untitled: '未命名',
      copySuffix: ' 副本',
      deleteConfirm: (title) => `删除 ${title}？`,
      restoreConfirm: '恢复这个版本？',
      clearVersionsConfirm: '清空版本？',
    },
    ...overrides,
    confirm,
  };
  const view = renderHook(() => useSheetDocLibrary(options));
  return {
    view,
    docIdRef,
    onAdoptDocId,
    onOpenSnapshot,
    onResetWorkbook,
    onPersist,
    onFlush,
    confirm,
  };
}

beforeEach(() => {
  vi.clearAllMocks();
  store.getDocStoreStatus.mockReturnValue({ ok: true });
  store.listDocuments.mockResolvedValue(DOCS);
  store.listVersions.mockResolvedValue([VERSION]);
  store.createDocId.mockReturnValue('doc-new');
  store.initDocStore.mockResolvedValue({ docId: 'a', doc: null });
  store.retryDocStore.mockResolvedValue({ ok: true });
  store.estimateStorage.mockResolvedValue({ used: 10, quota: 100 });
  store.deleteVersion.mockResolvedValue(undefined);
  store.clearVersions.mockResolvedValue(1);
  store.deleteDocument.mockResolvedValue(undefined);
  store.duplicateDocument.mockResolvedValue('doc-copy');
  store.loadDocument.mockResolvedValue({ title: '预算', snapshot: SNAPSHOT });
});

describe('useSheetDocLibrary', () => {
  it('init 采纳上次打开的文档指针，并刷新列表', async () => {
    const { view, onAdoptDocId } = setup();
    await act(() => view.result.current.init());
    await waitFor(() => expect(view.result.current.docs).toHaveLength(2));
    expect(onAdoptDocId).toHaveBeenCalledWith('a');
  });

  it('库里没有可用文档时 init 不认领 id（不覆盖当前内容）', async () => {
    store.initDocStore.mockResolvedValue(null);
    const { view, onAdoptDocId } = setup();
    await act(() => view.result.current.init());
    expect(onAdoptDocId).not.toHaveBeenCalled();
    expect(store.listDocuments).toHaveBeenCalled();
  });

  it('新建：分配新 id、写指针、刷新列表', () => {
    const { view, docIdRef, onAdoptDocId } = setup();
    let id = '';
    act(() => {
      id = view.result.current.adoptNewDoc();
    });
    expect(id).toBe('doc-new');
    expect(docIdRef.current).toBe('doc-new');
    expect(store.setCurrentDocId).toHaveBeenCalledWith('doc-new');
    expect(onAdoptDocId).toHaveBeenCalledWith('doc-new');
    expect(store.listDocuments).toHaveBeenCalled();
  });

  it('打开文档：读快照 → 认领 id → 关面板', async () => {
    const { view, onOpenSnapshot, onAdoptDocId } = setup();
    act(() => view.result.current.openLibrary());
    expect(view.result.current.libraryOpen).toBe(true);

    act(() => view.result.current.openDoc('a'));
    await waitFor(() => expect(onOpenSnapshot).toHaveBeenCalledWith(SNAPSHOT, '预算'));
    expect(onAdoptDocId).toHaveBeenCalledWith('a');
    expect(view.result.current.libraryOpen).toBe(false);
  });

  it('打不开文档（已被删 / 读失败）时不动当前内容', async () => {
    store.loadDocument.mockResolvedValue(null);
    const { view, onOpenSnapshot, onAdoptDocId } = setup();
    act(() => view.result.current.openDoc('gone'));
    await act(async () => {});
    expect(onOpenSnapshot).not.toHaveBeenCalled();
    expect(onAdoptDocId).not.toHaveBeenCalled();
  });

  it('打开库时取一次占用，拿不到就保持 null（面板不显示 0）', async () => {
    store.estimateStorage.mockResolvedValue(null);
    const { view } = setup();
    await act(async () => {
      view.result.current.openLibrary();
    });
    expect(view.result.current.storageUsage).toBeNull();

    store.estimateStorage.mockResolvedValue({ used: 10, quota: 100 });
    await act(async () => {
      view.result.current.openLibrary();
    });
    expect(view.result.current.storageUsage).toEqual({ used: 10, quota: 100 });
  });

  it('删文档：确认文案用库里的标题，空标题回落"未命名"', async () => {
    const { view, confirm } = setup();
    act(() => view.result.current.removeDoc('b'));
    await waitFor(() => expect(store.deleteDocument).toHaveBeenCalledWith('b'));
    expect(confirm).toHaveBeenCalledWith('删除 未命名？');
  });

  it('删文档被取消：一个字节都不动', () => {
    const deny = vi.fn(() => false);
    const { view } = setup({ confirm: deny });
    act(() => view.result.current.removeDoc('a'));
    expect(deny).toHaveBeenCalled();
    expect(store.deleteDocument).not.toHaveBeenCalled();
  });

  it('删掉当前文档：清指针、清画布，别留着"已经不存在"的内容', async () => {
    const { view, docIdRef, onAdoptDocId, onResetWorkbook } = setup();
    act(() => view.result.current.removeDoc('a'));
    await waitFor(() => expect(onResetWorkbook).toHaveBeenCalled());
    expect(docIdRef.current).toBeNull();
    expect(onAdoptDocId).toHaveBeenCalledWith(null);
  });

  it('删的不是当前文档：指针与画布都不动', async () => {
    const { view, docIdRef, onResetWorkbook } = setup();
    act(() => view.result.current.removeDoc('b'));
    await waitFor(() => expect(store.deleteDocument).toHaveBeenCalledWith('b'));
    expect(docIdRef.current).toBe('a');
    expect(onResetWorkbook).not.toHaveBeenCalled();
  });

  it('恢复版本：确认后灌快照、关面板、显式落盘', () => {
    const { view, onOpenSnapshot, onPersist, onFlush } = setup();
    act(() => view.result.current.openVersions());
    expect(view.result.current.versionsOpen).toBe(true);

    act(() => view.result.current.restoreVersion(VERSION));
    expect(onOpenSnapshot).toHaveBeenCalledWith(SNAPSHOT, '旧版');
    expect(onPersist).toHaveBeenCalledWith('旧版');
    expect(onFlush).toHaveBeenCalled();
    expect(view.result.current.versionsOpen).toBe(false);
  });

  it('恢复版本被取消时不灌快照', () => {
    const { view, onOpenSnapshot, onFlush } = setup({ confirm: vi.fn(() => false) });
    act(() => view.result.current.restoreVersion(VERSION));
    expect(onOpenSnapshot).not.toHaveBeenCalled();
    expect(onFlush).not.toHaveBeenCalled();
  });

  it('清空版本：当前文档不存在时是空操作（连确认都不弹）', () => {
    const { view, confirm } = setup({ docIdRef: { current: null } });
    act(() => view.result.current.clearAllVersions());
    expect(confirm).not.toHaveBeenCalled();
    expect(store.clearVersions).not.toHaveBeenCalled();
  });

  it('清空版本：确认后清库并重读版本列表', async () => {
    const { view } = setup();
    act(() => view.result.current.openVersions());
    await waitFor(() => expect(store.listVersions).toHaveBeenCalledWith('a'));

    act(() => view.result.current.clearAllVersions());
    await waitFor(() => expect(store.clearVersions).toHaveBeenCalledWith('a'));
  });

  it('删单个版本后重读当前文档的版本', async () => {
    const { view } = setup();
    act(() => view.result.current.deleteVersionById(VERSION));
    await waitFor(() => expect(store.deleteVersion).toHaveBeenCalledWith('v1'));
    expect(store.listVersions).toHaveBeenCalledWith('a');
  });

  it('重试成功才刷新列表；失败只更新状态', async () => {
    const { view } = setup();
    store.listDocuments.mockClear();

    store.retryDocStore.mockResolvedValue({ ok: false, code: 'quota' });
    await act(async () => {
      view.result.current.retryStore();
    });
    expect(store.listDocuments).not.toHaveBeenCalled();

    store.retryDocStore.mockResolvedValue({ ok: true, code: null });
    await act(async () => {
      view.result.current.retryStore();
    });
    expect(store.listDocuments).toHaveBeenCalled();
  });

  it('复制文档：文案取自 messages，成功后刷新列表', async () => {
    const { view } = setup();
    act(() => view.result.current.duplicateDoc('a'));
    await waitFor(() =>
      expect(store.duplicateDocument).toHaveBeenCalledWith('a', {
        untitled: '未命名',
        suffix: ' 副本',
      }),
    );
    expect(store.listDocuments).toHaveBeenCalled();
  });
});
