import { useCallback, useRef, useState } from 'react';
import { buildPresentGrid, type PresentGrid } from '../core';
import type { WorkbookSnapshot } from '../xlsx-io';

/**
 * 演示视图（P2-4 第十一片）。
 *
 * 它不渲染 Univer 实例：把工作簿读成一份只读网格再单独画，所以编辑中的文档完全不受影响。
 * 两个容易出错的点都在这里：
 *
 * 1. **必须用合成后的快照**：图表 / 形状 / 图片只存在于工具自有字段里，`getSnapshot()` 拿不到，
 *    直接用就会演示成"只有格子"；
 * 2. **打开时必须先清掉上一次的网格**：否则第二次打开会先闪一下旧内容
 *    （失败的标记同理，不清就会一直显示"演示失败"）。
 */
export interface PresentEngine {
  getSnapshot(): WorkbookSnapshot;
  getActiveSheetId(): string | null;
}

export interface UseSheetPresentOptions {
  handleRef: { current: PresentEngine | null };
  /** 把工具自有内容（图表 / 形状 / 图片 / 批注…）合进快照 */
  withDocOwnedContent: (base: WorkbookSnapshot) => WorkbookSnapshot;
  /** 测试注入点；默认用真实的投影函数 */
  buildGrid?: (snapshot: WorkbookSnapshot, sheetId: string | null) => PresentGrid | null;
}

export interface SheetPresentApi {
  presenting: boolean;
  grid: PresentGrid | null;
  /** 投影失败（快照读不出来 / 空工作簿）：面板仍在，显示失败文案 */
  failed: boolean;
  open: () => void;
  close: () => void;
}

export function useSheetPresent({
  handleRef,
  withDocOwnedContent,
  buildGrid = buildPresentGrid,
}: UseSheetPresentOptions): SheetPresentApi {
  const [presenting, setPresenting] = useState(false);
  const [grid, setGrid] = useState<PresentGrid | null>(null);
  const [failed, setFailed] = useState(false);

  const latest = useRef({ withDocOwnedContent, buildGrid });
  latest.current = { withDocOwnedContent, buildGrid };

  const open = useCallback(() => {
    setGrid(null);
    setFailed(false);
    setPresenting(true);
    try {
      const handle = handleRef.current;
      const snapshot = handle ? latest.current.withDocOwnedContent(handle.getSnapshot()) : null;
      const next = snapshot
        ? latest.current.buildGrid(snapshot, handle?.getActiveSheetId() ?? null)
        : null;
      if (next) setGrid(next);
      else setFailed(true);
    } catch {
      setFailed(true);
    }
  }, [handleRef]);

  const close = useCallback(() => setPresenting(false), []);

  return { presenting, grid, failed, open, close };
}
