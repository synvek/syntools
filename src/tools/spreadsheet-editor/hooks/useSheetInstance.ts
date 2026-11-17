import { useEffect, useRef } from 'react';
import { readDraft } from '../draft';
import type { UniverHandle } from '../univer';
import type { WorkbookSnapshot } from '../xlsx-io';

/**
 * Univer 实例的创建 / 重建 / 销毁（P2-4 第十片）。
 *
 * 这一段以前是组件里最长的一个 effect，难拆的原因是**它的入参横跨所有域**：
 * 快照里的工具自有内容（图表 / 形状 / 批注 / 名称 / 透视…）、落盘、标签栏、汇总、只读开关、
 * 视口投影。与其继续按域切片，不如把它变成一个**显式接口**：hook 只负责"什么时候创建、
 * 什么时候销毁、什么时候订阅"，"重建后各域该做什么"由下面几个具名回调注入。
 *
 * 三条容易踩的坑都留在这里，不再散落到组件：
 *
 * 1. **一个 tick 后再创建**：StrictMode 下 effect 会 mount → unmount → mount，
 *    在 effect 里直接实例化会在 React 自己的渲染过程中卸载 Univer 的 React root，
 *    第二次挂载就只剩一张空白表。
 * 2. **重建前先把快照抓进 `pendingRef`**：换主题 / 换语言 / StrictMode 的第二次挂载都走
 *    "dispose → 重建"，不抓就会拿草稿重来，用户未落盘的编辑会回滚。
 * 3. **订阅必须在卸载时断开**：否则旧实例的 mutation 回调还挂在全局上，
 *    重建后每改一个格就落两次盘。
 */
export interface UseSheetInstanceOptions<CreateOptions = { locale: string; dark: boolean }> {
  containerRef: { current: HTMLDivElement | null };
  handleRef: { current: UniverHandle | null };
  /** 重建前抓到的快照（优先于草稿） */
  pendingRef: { current: WorkbookSnapshot | null };
  /** mutation / viewport 的退订函数 */
  subscriptionRef: { current: (() => void) | null };
  /**
   * 传给 `create` 的参数（语言 / 主题）。
   * 必须是稳定引用：变了就等于"该重建实例"，组件用 `useMemo` 按语言 + 主题生成。
   */
  engineOptions: CreateOptions;
  /** 从快照里读回工具自有内容并采纳；各族"只采纳一次"的规则由组件持有 */
  adopt: (snapshot: WorkbookSnapshot) => void;
  /** Ribbon 等 UI 需要拿到实例（卸载时传 null） */
  onHostChange: (handle: UniverHandle | null) => void;
  /** 实例就绪：刷新标签栏 / 只读开关 / 汇总 / 图表数据 */
  onReady: (handle: UniverHandle) => void;
  /** 单元格被改：落盘、重算透视、形状重投影 */
  onMutation: () => void;
  /** 视口变化（滚动 / 缩放 / 换表）：形状要重算投影 */
  onViewport: (handle: UniverHandle) => void;
  /** 实例建不起来（WebGL 不可用等）：交给组件显示运行时报错 */
  onFailure: () => void;
  /**
   * 实例化函数（组件传 `createUniverInstance`）。
   * 由调用方注入而不是在这里 import：`univer.ts` 一加载就会摸 canvas / Path2D，
   * jsdom 里连模块都进不来，hook 也就没法单测了。
   */
  create: (container: HTMLElement, options: CreateOptions) => UniverHandle;
}

export function useSheetInstance<CreateOptions = { locale: string; dark: boolean }>({
  containerRef,
  handleRef,
  pendingRef,
  subscriptionRef,
  engineOptions,
  adopt,
  onHostChange,
  onReady,
  onMutation,
  onViewport,
  onFailure,
  create,
}: UseSheetInstanceOptions<CreateOptions>): void {
  const latest = useRef({
    adopt,
    onHostChange,
    onReady,
    onMutation,
    onViewport,
    onFailure,
    create,
  });
  latest.current = { adopt, onHostChange, onReady, onMutation, onViewport, onFailure, create };

  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;
    let cancelled = false;
    let stopViewport: (() => void) | null = null;

    // Create one tick later: under StrictMode the effect mounts → unmounts → mounts synchronously,
    // and instantiating inside the effect would unmount Univer's React root during React's own
    // render, leaving the second instance blank (an empty sheet in development).
    const timer = window.setTimeout(() => {
      if (cancelled) return;
      let handle: UniverHandle;
      try {
        handle = latest.current.create(container, engineOptions);
      } catch {
        latest.current.onFailure();
        return;
      }

      const pending = pendingRef.current ?? readDraft();
      if (pending) {
        handle.loadSnapshot(pending);
        // 重建拿到的是原始 Univer 快照：各族的"只采纳一次 / 空才采纳"规则在组件里
        latest.current.adopt(pending);
      }

      handleRef.current = handle;
      latest.current.onHostChange(handle);
      subscriptionRef.current = handle.onMutation(() => latest.current.onMutation());
      latest.current.onReady(handle);

      // Shapes are projected through the grid's origin / scroll / zoom; the render unit is only
      // measured once Univer has painted, hence the extra frame before the first read.
      const syncViewport = (): void => {
        if (cancelled) return;
        latest.current.onViewport(handle);
      };
      stopViewport = handle.onViewportChange(syncViewport);
      syncViewport();
      window.requestAnimationFrame(syncViewport);
    }, 0);

    return () => {
      cancelled = true;
      window.clearTimeout(timer);
      stopViewport?.();
      stopViewport = null;
      subscriptionRef.current?.();
      subscriptionRef.current = null;
      const current = handleRef.current;
      if (current) {
        pendingRef.current = current.getSnapshot();
        current.dispose();
        handleRef.current = null;
        latest.current.onHostChange(null);
      }
    };
  }, [containerRef, engineOptions, handleRef, pendingRef, subscriptionRef]);
}
