import { useCallback, useEffect, useRef, useState } from 'react';
import {
  clearVersions,
  createDocId,
  deleteDocument,
  deleteVersion,
  duplicateDocument,
  estimateStorage,
  getDocStoreStatus,
  initDocStore,
  listDocuments,
  listVersions,
  loadDocument,
  retryDocStore,
  setCurrentDocId,
  subscribeDocStoreStatus,
  type DocMeta,
  type DocStorageEstimate,
  type DocStoreStatus,
  type StoredVersion,
} from '../docStore';
import type { WorkbookSnapshot } from '../xlsx-io';

/**
 * 文档库编排（P2-4 第 2 片）。
 *
 * 从 `SpreadsheetTool.tsx` 里搬出来的是一整块"库的状态 + 库的 I/O"：列表 / 版本 / 面板开合 /
 * 降级状态 / 占用估算，以及打开、复制、删除、恢复、腾地方这些动作。
 *
 * 组件只保留两件它才知道的事，以回调形式注入：
 *
 * - `onOpenSnapshot`：把快照灌进编辑器（要写 Univer 实例、refs、派生状态）；
 * - `onResetWorkbook`：当前文档被删掉之后清空画布。
 *
 * 翻译文案也由调用方传入（`messages`），这样 hook 里没有任何中文硬编码，测试可以直接断言
 * "确认框里写的是哪份标题"。
 */

export interface DocLibraryMessages {
  untitled: string;
  copySuffix: string;
  deleteConfirm: (title: string) => string;
  restoreConfirm: string;
  clearVersionsConfirm: string;
}

export interface UseDocLibraryOptions {
  /** 当前文档 id 的 ref：库里的动作要读到"最新的"那一个，不能吃渲染时的闭包 */
  docIdRef: { current: string | null };
  /** 采纳一个文档 id（新建 / 打开 / 删除当前文档），由组件同步到 state */
  onAdoptDocId: (id: string | null) => void;
  /** 把快照灌进编辑器（打开文档 / 恢复版本共用） */
  onOpenSnapshot: (snapshot: WorkbookSnapshot, title: string) => void;
  /** 当前文档被删掉后清空编辑器 */
  onResetWorkbook?: () => void;
  /** 显式动作立刻进库（不等 10s 防抖） */
  onPersist?: (title?: string) => void;
  onFlush?: () => void;
  messages: DocLibraryMessages;
  /** 测试注入；默认 `window.confirm` */
  confirm?: (message: string) => boolean;
}

export interface DocLibraryApi {
  docs: DocMeta[];
  versions: StoredVersion[];
  libraryOpen: boolean;
  versionsOpen: boolean;
  storeStatus: DocStoreStatus;
  storageUsage: DocStorageEstimate | null;
  /** 启动：恢复上次打开的文档指针 + 刷新列表 */
  init: () => Promise<void>;
  refreshDocs: () => void;
  /** 新建：占一个新 id 并写回指针（内容清空由调用方决定） */
  adoptNewDoc: () => string;
  openLibrary: () => void;
  closeLibrary: () => void;
  openVersions: () => void;
  closeVersions: () => void;
  retryStore: () => void;
  deleteVersionById: (version: StoredVersion) => void;
  clearAllVersions: () => void;
  openDoc: (id: string) => void;
  duplicateDoc: (id: string) => void;
  removeDoc: (id: string) => void;
  restoreVersion: (version: StoredVersion) => void;
}

/** 默认确认：没有 window（SSR / node 测试）时按"用户点了确定"处理，避免动作静默消失 */
function defaultConfirm(message: string): boolean {
  if (typeof window === 'undefined') return true;
  return window.confirm(message);
}

export function useSheetDocLibrary(options: UseDocLibraryOptions): DocLibraryApi {
  const [docs, setDocs] = useState<DocMeta[]>([]);
  const [versions, setVersions] = useState<StoredVersion[]>([]);
  const [libraryOpen, setLibraryOpen] = useState(false);
  const [versionsOpen, setVersionsOpen] = useState(false);
  const [storeStatus, setStoreStatus] = useState<DocStoreStatus>(getDocStoreStatus);
  const [storageUsage, setStorageUsage] = useState<DocStorageEstimate | null>(null);

  /**
   * 回调一律走 ref 取最新值：它们里面既有 state setter，也有每次渲染重建的闭包。
   * 直接进依赖会让每个动作的引用在每次渲染时变化，命令表 / 菜单每次都重新构建。
   */
  const latest = useRef(options);
  latest.current = options;
  const docsRef = useRef<DocMeta[]>([]);
  docsRef.current = docs;

  // P2-3：降级状态是"全局"的（库不可用 / 配额满），横幅与面板都要跟着变
  useEffect(() => subscribeDocStoreStatus(setStoreStatus), []);

  const refreshDocs = useCallback(() => {
    void listDocuments().then(setDocs);
  }, []);

  /** 版本列表只跟"当前文档"有关：没有 id 就清空，别让上一份文档的版本留在面板里 */
  const refreshVersions = useCallback(() => {
    const id = latest.current.docIdRef.current;
    if (!id) {
      setVersions([]);
      return;
    }
    void listVersions(id).then(setVersions);
  }, []);

  const ask = useCallback((message: string): boolean => {
    const confirm = latest.current.confirm ?? defaultConfirm;
    return confirm(message);
  }, []);

  const init = useCallback(async () => {
    const store = await initDocStore();
    // 列表要在 init 之后读：init 会顺手把 v1 草稿迁进库里，先读就少一条
    refreshDocs();
    if (!store) return;
    latest.current.docIdRef.current = store.docId;
    latest.current.onAdoptDocId(store.docId);
  }, [refreshDocs]);

  const adoptNewDoc = useCallback(() => {
    const id = createDocId();
    latest.current.docIdRef.current = id;
    setCurrentDocId(id);
    latest.current.onAdoptDocId(id);
    refreshDocs();
    return id;
  }, [refreshDocs]);

  const openLibrary = useCallback(() => {
    setVersionsOpen(false);
    setLibraryOpen(true);
    refreshDocs();
    // 占用取不到（浏览器不支持）就保持 null，面板里那一行自然不出现
    void estimateStorage().then(setStorageUsage);
  }, [refreshDocs]);

  const closeLibrary = useCallback(() => setLibraryOpen(false), []);

  const openVersions = useCallback(() => {
    setLibraryOpen(false);
    setVersionsOpen(true);
    refreshVersions();
  }, [refreshVersions]);

  const closeVersions = useCallback(() => setVersionsOpen(false), []);

  /** P2-3：横幅上的"重试"——重开一次库；成功才刷新列表 */
  const retryStore = useCallback(() => {
    void retryDocStore().then((next) => {
      setStoreStatus(next);
      if (next.ok) refreshDocs();
    });
  }, [refreshDocs]);

  /** P2-3：空间不足时的"腾地方"——删单个版本 */
  const deleteVersionById = useCallback(
    (version: StoredVersion) => {
      void deleteVersion(version.id).then(refreshVersions);
    },
    [refreshVersions],
  );

  /** P2-3：清空本文档的历史版本 */
  const clearAllVersions = useCallback(() => {
    const id = latest.current.docIdRef.current;
    if (!id) return;
    if (!ask(latest.current.messages.clearVersionsConfirm)) return;
    void clearVersions(id).then(refreshVersions);
  }, [ask, refreshVersions]);

  const openDoc = useCallback((id: string) => {
    void loadDocument(id).then((doc) => {
      if (!doc) return;
      latest.current.docIdRef.current = id;
      setCurrentDocId(id);
      latest.current.onAdoptDocId(id);
      latest.current.onOpenSnapshot(doc.snapshot, doc.title);
      setLibraryOpen(false);
    });
  }, []);

  const duplicateDoc = useCallback(
    (id: string) => {
      const { untitled, copySuffix } = latest.current.messages;
      void duplicateDocument(id, { untitled, suffix: copySuffix }).then(refreshDocs);
    },
    [refreshDocs],
  );

  const removeDoc = useCallback(
    (id: string) => {
      const target = docsRef.current.find((doc) => doc.id === id);
      const label = target?.title || latest.current.messages.untitled;
      if (!ask(latest.current.messages.deleteConfirm(label))) return;
      void deleteDocument(id).then(() => {
        refreshDocs();
        // 删掉的正是当前文档：指针一起清掉，画布不能留着一份"已经不存在"的内容
        if (id !== latest.current.docIdRef.current) return;
        latest.current.docIdRef.current = null;
        latest.current.onAdoptDocId(null);
        latest.current.onResetWorkbook?.();
      });
    },
    [ask, refreshDocs],
  );

  const restoreVersion = useCallback(
    (version: StoredVersion) => {
      if (!ask(latest.current.messages.restoreConfirm)) return;
      latest.current.onOpenSnapshot(version.snapshot, version.title);
      setVersionsOpen(false);
      latest.current.onPersist?.(version.title);
      // 显式动作绕过 10s 的库防抖：列表必须马上是用户刚要求的样子
      latest.current.onFlush?.();
    },
    [ask],
  );

  return {
    docs,
    versions,
    libraryOpen,
    versionsOpen,
    storeStatus,
    storageUsage,
    init,
    refreshDocs,
    adoptNewDoc,
    openLibrary,
    closeLibrary,
    openVersions,
    closeVersions,
    retryStore,
    deleteVersionById,
    clearAllVersions,
    openDoc,
    duplicateDoc,
    removeDoc,
    restoreVersion,
  };
}
