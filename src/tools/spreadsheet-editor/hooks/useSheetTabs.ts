import { useCallback, useState } from 'react';
import type { SheetInfo } from '../univer';

/**
 * 工作表标签栏的状态与动作（P2-4 第 1 片）。
 *
 * 从 `SpreadsheetTool.tsx` 里搬出来的是一整块"薄编排"：调引擎、刷新列表、必要时请求落盘，
 * 以及删表后清理挂在那张表上的对象。搬出去以后，这些规则终于能在没有浏览器、没有 Univer
 * 的情况下被测到（传一个假引擎就行）——原来它们只存在于一个 2.7k 行的组件里，只能靠 e2e 覆盖。
 *
 * 依赖故意收窄成"用到的那几个方法"，而不是整个 `UniverHandle`：这样测试不需要伪造几十个
 * 用不上的成员，组件侧也不用额外适配。
 */

/** 本 hook 真正会调的引擎能力 */
export interface SheetTabsEngine {
  getSheets(): SheetInfo[];
  getActiveSheetId(): string | null;
  addSheet(name?: string): void;
  setActiveSheet(id: string): void;
  renameSheet(id: string, name: string): void;
  deleteSheet(id: string): void;
  duplicateSheet(id: string): void;
  /** 返回 false = 引擎拒绝（例如"最后一张可见表"） */
  setSheetHidden(id: string, hidden: boolean): boolean;
}

export interface UseSheetTabsOptions {
  /** 引擎句柄；实例还没建好时 `current` 为 null，所有动作退化成空操作 */
  handleRef: { current: SheetTabsEngine | null };
  /** 删表后清理挂在该表上的保护 / 局部名称 / 表格对象（由调用方决定清什么） */
  onRemoved?: (sheetId: string) => void;
  /** "这个改动脏标记看不到，请显式落盘"（删表 / 隐藏） */
  onCommit?: () => void;
  /** 需要告诉用户的失败（例如不能隐藏最后一张可见表），传入已翻译文案 */
  onError?: (message: string) => void;
  /** 隐藏最后一张可见表时的提示文案 */
  lastVisibleMessage?: string;
}

export interface SheetTabsApi {
  sheets: SheetInfo[];
  activeSheetId: string | null;
  /** 从引擎重新读一遍（新建实例、载入快照后都要调） */
  refresh: () => void;
  add: () => void;
  select: (id: string) => void;
  rename: (id: string, name: string) => void;
  remove: (id: string) => void;
  duplicate: (id: string) => void;
  /** 返回 false 表示引擎拒绝（调用方一般不用管，错误已经通过 `onError` 报过） */
  setHidden: (id: string, hidden: boolean) => boolean;
}

export function useSheetTabs({
  handleRef,
  onRemoved,
  onCommit,
  onError,
  lastVisibleMessage,
}: UseSheetTabsOptions): SheetTabsApi {
  const [sheets, setSheets] = useState<SheetInfo[]>([]);
  const [activeSheetId, setActiveSheetId] = useState<string | null>(null);

  const refresh = useCallback(() => {
    const handle = handleRef.current;
    // 引擎还没建好：保持上一次的列表，不要把界面清空造成一次闪烁
    if (!handle) return;
    setSheets(handle.getSheets());
    setActiveSheetId(handle.getActiveSheetId());
  }, [handleRef]);

  const add = useCallback(() => {
    handleRef.current?.addSheet();
    refresh();
  }, [handleRef, refresh]);

  const select = useCallback(
    (id: string) => {
      handleRef.current?.setActiveSheet(id);
      refresh();
    },
    [handleRef, refresh],
  );

  const rename = useCallback(
    (id: string, name: string) => {
      handleRef.current?.renameSheet(id, name);
      refresh();
    },
    [handleRef, refresh],
  );

  const remove = useCallback(
    (id: string) => {
      handleRef.current?.deleteSheet(id);
      refresh();
      // 该表上的保护 / 局部名称 / 表格对象随表一起消失：留着会让导出指向不存在的表
      onRemoved?.(id);
      onCommit?.();
    },
    [handleRef, refresh, onRemoved, onCommit],
  );

  const duplicate = useCallback(
    (id: string) => {
      handleRef.current?.duplicateSheet(id);
      refresh();
    },
    [handleRef, refresh],
  );

  const setHidden = useCallback(
    (id: string, hidden: boolean): boolean => {
      const changed = handleRef.current?.setSheetHidden(id, hidden) ?? false;
      if (!changed) {
        // 最后一张可见表不能隐藏：必须说话，否则菜单点了没反应
        if (lastVisibleMessage) onError?.(lastVisibleMessage);
        return false;
      }
      refresh();
      // 可见性不是普通单元格改动，脏标记看不到它
      onCommit?.();
      return true;
    },
    [handleRef, refresh, onCommit, onError, lastVisibleMessage],
  );

  return { sheets, activeSheetId, refresh, add, select, rename, remove, duplicate, setHidden };
}
