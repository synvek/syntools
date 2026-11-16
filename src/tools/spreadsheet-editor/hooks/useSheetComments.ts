import { useCallback, useRef, useState } from 'react';
import {
  addReply,
  createThread,
  setThreadResolved,
  type CommentThread,
} from '../../../core/comments/model';
import { setSheetThreads, threadsForSheet, type SheetCommentMap } from '../comments';

/**
 * 单元格批注（P2-4 第 4 片）。
 *
 * 批注是**工具自有数据**：不在 Univer 的单元格里，脏标记看不到它，所以每次真实改动都要显式
 * 请求落盘（`onCommit`）。这一片把"面板状态 + 四个动作 + 首次采纳规则"一起搬出组件：
 *
 * - `adoptOnce`：只采纳第一次从快照里读到的批注。StrictMode 的第二次挂载、主题/语言切换
 *   重建实例时，快照是一份没有 `syntoolsComments` 的原始 Univer 快照——无条件覆盖会把用户
 *   刚写的批注抹掉。
 * - `reset`：换文档时**必须**无条件替换，否则上一份文档的批注会挂在新文档上。
 *
 * 这两条以前分散在组件的三处（`commentsLoadedRef` + 两个调用点），现在只有一种写法。
 */

/** 本 hook 真正会调的引擎能力：面板锚点要"当前选区左上角" */
export interface CommentEngine {
  getActiveSheetId(): string | null;
  getActiveRange(): { startRow: number; startColumn: number } | null;
}

export interface UseSheetCommentsOptions {
  handleRef: { current: CommentEngine | null };
  /**
   * 引擎还没建好时的回落。给的是**取值函数**而不是字符串：标签栏的 `activeSheetId`
   * 在组件里比这里声明得晚，直接传值会踩 TDZ，而函数体只在真正需要时求值。
   */
  fallbackSheetId?: () => string | null;
  /** 批注不是 Univer mutation：改动后显式落盘 */
  onCommit: () => void;
  /** 匿名作者文案，由调用方从 i18n 取 */
  anonymousAuthor: string;
}

export interface SheetCommentsApi {
  comments: SheetCommentMap;
  /** 快照合成（`sheetObjects.ts`）读的那一份，与 state 同源 */
  commentsRef: { current: SheetCommentMap };
  panelOpen: boolean;
  /** 面板打开时锚定的单元格 */
  cell: { row: number; col: number } | null;
  author: string;
  setAuthor: (value: string) => void;
  openPanel: () => void;
  closePanel: () => void;
  /** 把锚点挪到当前选区（面板里的"用当前单元格"） */
  useCurrentCell: () => void;
  /** 首次采纳快照里的批注；已经采纳过就返回 false 且不改任何东西 */
  adoptOnce: (next: SheetCommentMap) => boolean;
  /** 换文档：无条件替换 */
  reset: (next: SheetCommentMap) => void;
  add: (body: string) => void;
  reply: (threadId: string, body: string) => void;
  toggleResolved: (threadId: string, resolved: boolean) => void;
  remove: (threadId: string) => void;
}

export function useSheetComments({
  handleRef,
  fallbackSheetId,
  onCommit,
  anonymousAuthor,
}: UseSheetCommentsOptions): SheetCommentsApi {
  const [comments, setComments] = useState<SheetCommentMap>({});
  const commentsRef = useRef<SheetCommentMap>({});
  const [panelOpen, setPanelOpen] = useState(false);
  const [cell, setCell] = useState<{ row: number; col: number } | null>(null);
  const [author, setAuthor] = useState('');
  const authorRef = useRef('');
  authorRef.current = author;
  /** 已经采纳过一次快照：之后的实例重建不再覆盖 */
  const adoptedRef = useRef(false);

  const latest = useRef({ onCommit, anonymousAuthor, fallbackSheetId });
  latest.current = { onCommit, anonymousAuthor, fallbackSheetId };

  /** 所有真实改动走这里：ref、state、落盘三件事永远一起发生 */
  const commitMap = useCallback((next: SheetCommentMap) => {
    commentsRef.current = next;
    setComments(next);
    latest.current.onCommit();
  }, []);

  const anchorOfActiveCell = useCallback((): { row: number; col: number } | null => {
    const range = handleRef.current?.getActiveRange();
    return range ? { row: range.startRow, col: range.startColumn } : null;
  }, [handleRef]);

  const sheetIdOf = useCallback(
    () => handleRef.current?.getActiveSheetId() ?? latest.current.fallbackSheetId?.() ?? null,
    [handleRef],
  );

  const openPanel = useCallback(() => {
    setCell(anchorOfActiveCell());
    setPanelOpen(true);
  }, [anchorOfActiveCell]);

  const closePanel = useCallback(() => setPanelOpen(false), []);

  const useCurrentCell = useCallback(() => setCell(anchorOfActiveCell()), [anchorOfActiveCell]);

  const adoptOnce = useCallback((next: SheetCommentMap): boolean => {
    if (adoptedRef.current) return false;
    adoptedRef.current = true;
    commentsRef.current = next;
    setComments(next);
    return true;
  }, []);

  const reset = useCallback((next: SheetCommentMap) => {
    adoptedRef.current = true;
    commentsRef.current = next;
    setComments(next);
  }, []);

  const resolveAuthor = () => authorRef.current.trim() || latest.current.anonymousAuthor;

  /** 就地更新一条线程；updater 返回原对象（无变化）时既不写 state 也不落盘 */
  const updateThread = useCallback(
    (threadId: string, updater: (thread: CommentThread) => CommentThread) => {
      const sheetId = sheetIdOf();
      if (!sheetId) return;
      const threads = threadsForSheet(commentsRef.current, sheetId);
      let changed = false;
      const next = threads.map((thread) => {
        if (thread.id !== threadId) return thread;
        const updated = updater(thread);
        if (updated !== thread) changed = true;
        return updated;
      });
      if (changed) commitMap(setSheetThreads(commentsRef.current, sheetId, next));
    },
    [commitMap, sheetIdOf],
  );

  const add = useCallback(
    (body: string) => {
      const sheetId = sheetIdOf();
      // 没有活动表或没有锚点：宁可不建，也不建一条"不知道挂在哪"的线程
      if (!sheetId || !cell) return;
      const thread = createThread(
        { kind: 'cell', sheetId, row: cell.row, col: cell.col },
        { author: resolveAuthor(), body },
      );
      const threads = [...threadsForSheet(commentsRef.current, sheetId), thread];
      commitMap(setSheetThreads(commentsRef.current, sheetId, threads));
    },
    [cell, commitMap, sheetIdOf],
  );

  const reply = useCallback(
    (threadId: string, body: string) =>
      updateThread(threadId, (thread) => addReply(thread, { author: resolveAuthor(), body })),
    [updateThread],
  );

  const toggleResolved = useCallback(
    (threadId: string, resolved: boolean) =>
      updateThread(threadId, (thread) => setThreadResolved(thread, resolved)),
    [updateThread],
  );

  const remove = useCallback(
    (threadId: string) => {
      const sheetId = sheetIdOf();
      if (!sheetId) return;
      const threads = threadsForSheet(commentsRef.current, sheetId);
      const next = threads.filter((thread) => thread.id !== threadId);
      // 找不到这条线程：不制造一次"空改动 + 落盘"
      if (next.length === threads.length) return;
      commitMap(setSheetThreads(commentsRef.current, sheetId, next));
    },
    [commitMap, sheetIdOf],
  );

  return {
    comments,
    commentsRef,
    panelOpen,
    cell,
    author,
    setAuthor,
    openPanel,
    closePanel,
    useCurrentCell,
    adoptOnce,
    reset,
    add,
    reply,
    toggleResolved,
    remove,
  };
}
