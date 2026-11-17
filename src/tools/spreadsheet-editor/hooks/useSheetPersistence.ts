import { useCallback, useEffect, useRef, useState } from 'react';
import { estimateJsonBytes } from '@/core/components/editorChrome';
import { summarizeWorkbook, type WorkbookSummary } from '../core';
import { createDocId, saveDocument, setCurrentDocId } from '../docStore';
import { writeDraftSafe } from '../draft';
import type { WorkbookSnapshot } from '../xlsx-io';

/**
 * 两级持久化（P2-4 第九片）。
 *
 * 两条通道节奏完全不同，混在一个回调里写不出可测的单元：
 *
 * 1. **草稿**（localStorage，同步、当作崩溃兜底）：编辑后 600ms 去抖，再等一次空闲回调——
 *    `getSnapshot()` + `JSON.stringify` 是整份工作簿里最贵的两次调用，放进定时器会让"打字一停"
 *    变成主线程卡顿。
 * 2. **文档库**（IndexedDB，结构化克隆整份快照）：10s 单槽覆盖。同一时间只留最新一份待写，
 *    这样连打 50 个字不会排出 50 次写库。
 *
 * 另外三处兜底：`pagehide` / `visibilitychange(hidden)` / 卸载时立即落盘，否则最后几秒的编辑
 * 会随着页面离开一起丢。
 *
 * hook 只负责"什么时候写、写失败算什么"；**快照怎么合成**（工具自有内容）与**写入后刷新什么**
 * （文档列表 / 摘要 / 内存统计）由组件注入——那两件事各自属于别的域。
 */

/** 本 hook 真正会调的引擎能力 */
export interface PersistenceEngine {
  getSnapshot(): WorkbookSnapshot;
  getActiveSheetId(): string | null;
}

export interface UseSheetPersistenceOptions {
  handleRef: { current: PersistenceEngine | null };
  /** 把工具自有内容（图表 / 形状 / 名称 / 保护 / 透视…）合进快照 */
  withDocOwnedContent: (base: WorkbookSnapshot) => WorkbookSnapshot;
  /** 图表数据跟随单元格内容：落盘前先重算一次 */
  syncChartData: (base: WorkbookSnapshot, sheetId: string | null) => void;
  /** 当前标题（写成文档名）；用取值函数而不是值，避免每次改名都重建回调 */
  getTitle: () => string;
  /** 每次保存顺带刷新汇总（状态栏与命令表都读它） */
  onSummary: (summary: WorkbookSummary) => void;
  /** IndexedDB 写入成功后刷新文档列表 */
  onDocSaved: () => void;
}

export interface SheetPersistenceApi {
  /** 当前文档 id：首次保存时才分配（只有进库的文档才需要它） */
  docId: string | null;
  docIdRef: { current: string | null };
  /** 打开 / 恢复文档时采纳已有 id */
  adoptDocId: (id: string | null) => void;
  draftSaved: boolean;
  /** `degraded` = localStorage 不可用；`failed` = 超过单份体积上限 */
  draftNotice: 'degraded' | 'failed' | null;
  /** 状态栏显示的体量（每次保存后算一次，不在渲染期取快照） */
  memoryBytes: number;
  /** 立即落一份：导入 / 恢复版本 / 关闭前等显式动作 */
  persistNow: (nextTitle?: string) => void;
  /** 编辑事件 → 去抖 + 空闲落盘 */
  scheduleSave: () => void;
  /** 给声明更早的调用方（其它 hook 的 `onCommit`）用的稳定句柄 */
  scheduleSaveRef: { current: () => void };
  /** 立刻把待写的那一份推进 IndexedDB */
  flushDocSave: () => void;
  flushDocSaveRef: { current: () => void };
  /** 新建 / 换文档：清掉"已保存"标记与上次的失败提示 */
  resetDraftState: () => void;
}

/** 编辑 → 落盘的去抖 */
const SAVE_DEBOUNCE_MS = 600;
/** 文档库是第二级、慢得多的通道（整份快照结构化克隆进 IndexedDB） */
const DOC_SAVE_DEBOUNCE_MS = 10_000;

/**
 * 把"重但可延后"的活儿放到空闲时做，并给一个硬上限：
 * 页面一直忙也不能永远不保存。
 */
function runWhenIdle(task: () => void): void {
  const idle = (
    window as Window & {
      requestIdleCallback?: (callback: () => void, options?: { timeout: number }) => number;
    }
  ).requestIdleCallback;
  if (typeof idle === 'function') {
    idle(task, { timeout: 1500 });
    return;
  }
  window.setTimeout(task, 0);
}

export function useSheetPersistence({
  handleRef,
  withDocOwnedContent,
  syncChartData,
  getTitle,
  onSummary,
  onDocSaved,
}: UseSheetPersistenceOptions): SheetPersistenceApi {
  const [docId, setDocId] = useState<string | null>(null);
  const docIdRef = useRef<string | null>(null);
  const [draftSaved, setDraftSaved] = useState(false);
  const [draftNotice, setDraftNotice] = useState<'degraded' | 'failed' | null>(null);
  const [memoryBytes, setMemoryBytes] = useState(0);

  const saveTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const docSaveTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  /** 等着进 IndexedDB 的最新一份（后写的覆盖先写的） */
  const pendingDocRef = useRef<{
    id: string;
    title: string;
    snapshot: WorkbookSnapshot;
  } | null>(null);

  const latest = useRef({ withDocOwnedContent, syncChartData, getTitle, onSummary, onDocSaved });
  latest.current = { withDocOwnedContent, syncChartData, getTitle, onSummary, onDocSaved };

  const adoptDocId = useCallback((id: string | null) => {
    docIdRef.current = id;
    setDocId(id);
  }, []);

  const flushDocSave = useCallback((): void => {
    if (docSaveTimerRef.current) {
      clearTimeout(docSaveTimerRef.current);
      docSaveTimerRef.current = null;
    }
    const pending = pendingDocRef.current;
    pendingDocRef.current = null;
    if (!pending) return;
    void saveDocument(pending.id, pending.title, pending.snapshot).then(() => {
      latest.current.onDocSaved();
    });
  }, []);
  const flushDocSaveRef = useRef<() => void>(() => {});
  // 定时器与卸载清理都走 ref，永远看到同一个闭包
  flushDocSaveRef.current = flushDocSave;

  /**
   * IndexedDB 的单槽队列：只留最新一份，10s 后写。
   * 不排队意味着"连打 50 个字"不会变成 50 次结构化克隆。
   */
  const queueDocSave = useCallback(
    (id: string, title: string, snapshot: WorkbookSnapshot): void => {
      pendingDocRef.current = { id, title, snapshot };
      if (docSaveTimerRef.current) clearTimeout(docSaveTimerRef.current);
      docSaveTimerRef.current = setTimeout(() => {
        docSaveTimerRef.current = null;
        flushDocSaveRef.current();
      }, DOC_SAVE_DEBOUNCE_MS);
    },
    [],
  );

  const persistNow = useCallback(
    (nextTitle?: string): void => {
      const handle = handleRef.current;
      if (!handle) return;
      const base = handle.getSnapshot();
      // 图表数据跟随单元格内容
      latest.current.syncChartData(base, handle.getActiveSheetId());
      const snapshot = latest.current.withDocOwnedContent(base);
      const result = writeDraftSafe(snapshot);
      setDraftSaved(result.ok);
      setDraftNotice(result.ok ? null : result.degraded ? 'degraded' : 'failed');
      const summary = summarizeWorkbook(base);
      latest.current.onSummary(summary);
      setMemoryBytes(estimateJsonBytes({ summary, snapshot }));
      // 文档 id 懒分配：只有真正进库的文档才需要一个 id
      let id = docIdRef.current;
      if (!id) {
        id = createDocId();
        docIdRef.current = id;
        setDocId(id);
        setCurrentDocId(id);
      }
      queueDocSave(id, nextTitle ?? latest.current.getTitle(), snapshot);
    },
    [handleRef, queueDocSave],
  );

  const scheduleSave = useCallback((): void => {
    if (saveTimerRef.current) clearTimeout(saveTimerRef.current);
    saveTimerRef.current = setTimeout(() => {
      saveTimerRef.current = null;
      runWhenIdle(persistNow);
    }, SAVE_DEBOUNCE_MS);
  }, [persistNow]);

  const scheduleSaveRef = useRef<() => void>(() => {});
  scheduleSaveRef.current = scheduleSave;

  /** 关标签页 / 切后台：草稿与库都还有待写的，页面走了就没了 */
  useEffect(() => {
    const flush = () => flushDocSaveRef.current();
    const onHidden = () => {
      if (document.visibilityState !== 'hidden') return;
      persistNow();
      flushDocSaveRef.current();
    };
    window.addEventListener('pagehide', flush);
    document.addEventListener('visibilitychange', onHidden);
    return () => {
      window.removeEventListener('pagehide', flush);
      document.removeEventListener('visibilitychange', onHidden);
    };
  }, [persistNow]);

  /** 排队中的库写入不能因为工具卸载（路由切换）而丢掉 */
  useEffect(() => () => flushDocSaveRef.current(), []);

  /** 卸载 / 重建前把编辑定时器也清掉（避免卸载后又跑一次全量快照） */
  useEffect(
    () => () => {
      if (saveTimerRef.current) clearTimeout(saveTimerRef.current);
      saveTimerRef.current = null;
    },
    [],
  );

  const resetDraftState = useCallback(() => {
    setDraftSaved(false);
    setDraftNotice(null);
  }, []);

  return {
    docId,
    docIdRef,
    adoptDocId,
    draftSaved,
    draftNotice,
    memoryBytes,
    persistNow,
    scheduleSave,
    scheduleSaveRef,
    flushDocSave,
    flushDocSaveRef,
    resetDraftState,
  };
}
