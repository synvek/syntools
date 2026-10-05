/**
 * 撤销/重做：**结构 diff 历史**（替代早期「整图快照」方案）。
 *
 * 背景：早期 commit 把整个 nodes/edges 数组压栈，大图 + 50 步历史会长期持有
 * 大量数组引用与对象。这里改为只记录「本次变更涉及的节点/边」的 before/after：
 * - 未受影响的节点引用完全不变 → diff 只保存引用，不做深拷贝（不可变更新保证安全）；
 * - 每条历史记录只含真正变动的条目，大图小改动时内存与拷贝成本都接近零。
 *
 * 时序（commit 发生在变更「之前」，因此用 pending 基线做延迟结算）：
 *   commit() ── flush 上一条 pending 的 diff 入栈，再把当前状态记为新的 pending
 *   undo()   ── 先 flush 未入栈的改动，再弹出最后一条 diff 并反向应用
 */

import type { FlowEdge, FlowNode } from './helpers';
import { HISTORY_LIMIT } from './helpers';

/**
 * 单条 diff：id + 变更前后下标 + before/after（缺省表示「该侧不存在」）。
 * 记录下标是为了还原堆叠顺序（数组顺序即层级），-1 表示该侧不存在。
 */
export interface ListEntry<T> {
  id: string;
  /** 变更前下标；-1 表示新增 */
  prevIndex: number;
  /** 变更后下标；-1 表示删除 */
  nextIndex: number;
  before?: T;
  after?: T;
}

export interface HistoryDiff {
  nodes: ListEntry<FlowNode>[];
  edges: ListEntry<FlowEdge>[];
}

interface DocSnapshot {
  nodes: FlowNode[];
  edges: FlowEdge[];
}

export interface HistoryState {
  past: HistoryDiff[];
  future: HistoryDiff[];
  commit: () => void;
  undo: () => void;
  redo: () => void;
  /** 载入文档后重建基线（keep 为真时保留历史栈，用于快照回滚） */
  resetHistory: (keep?: boolean) => void;
}

/** 计算两个数组之间的最小 diff */
export function diffList<T extends { id: string }>(
  prev: readonly T[],
  next: readonly T[],
): ListEntry<T>[] {
  const out: ListEntry<T>[] = [];
  const nextIndex = new Map(next.map((item, index) => [item.id, index] as const));
  const prevIndex = new Map(prev.map((item, index) => [item.id, index] as const));

  prev.forEach((item, at) => {
    const after = nextIndex.get(item.id);
    if (after === undefined) {
      // 删除
      out.push({ id: item.id, prevIndex: at, nextIndex: -1, before: item });
      return;
    }
    const nextItem = next[after];
    // 引用相等且位置未变 → 未变更（不可变更新的核心不变量，短路零成本）
    if (nextItem === item && after === at) return;
    out.push({ id: item.id, prevIndex: at, nextIndex: after, before: item, after: nextItem });
  });

  next.forEach((item, at) => {
    if (prevIndex.has(item.id)) return;
    out.push({ id: item.id, prevIndex: -1, nextIndex: at, after: item });
  });
  return out;
}

/** 把 diff 应用到数组（dir='undo' 取 before/prevIndex，'redo' 取 after/nextIndex） */
export function applyListDiff<T extends { id: string }>(
  list: readonly T[],
  entries: readonly ListEntry<T>[],
  dir: 'undo' | 'redo',
): T[] {
  if (entries.length === 0) return [...list];
  const out = [...list];
  for (const entry of entries) {
    const value = dir === 'undo' ? entry.before : entry.after;
    const target = dir === 'undo' ? entry.prevIndex : entry.nextIndex;
    const at = out.findIndex((item) => item.id === entry.id);
    if (at >= 0) out.splice(at, 1);
    if (value !== undefined) {
      out.splice(Math.min(Math.max(target, 0), out.length), 0, value);
    }
  }
  return out;
}

/**
 * 创建历史记录切片。
 * pending / 基线保存在闭包里，不进入响应式状态（避免无意义的订阅通知）。
 */
export function createHistorySlice<S extends HistoryState & DocSnapshot>(
  set: (partial: Partial<S> | ((state: S) => Partial<S>)) => void,
  get: () => S,
): HistoryState {
  /** 上一次 commit 时的状态（尚未结算的变更基线） */
  let pending: DocSnapshot | null = null;

  /** 结算 pending：把「上一次 commit 之后发生的改动」压缩成一条 diff 入栈 */
  const flush = (): void => {
    if (!pending) return;
    const { nodes, edges } = get();
    const diff: HistoryDiff = {
      nodes: diffList(pending.nodes, nodes),
      edges: diffList(pending.edges, edges),
    };
    pending = { nodes, edges };
    if (diff.nodes.length === 0 && diff.edges.length === 0) return;
    set(
      (s) =>
        ({
          past: [...s.past, diff].slice(-HISTORY_LIMIT),
          future: [],
        }) as unknown as Partial<S>,
    );
  };

  return {
    past: [],
    future: [],

    commit: () => {
      flush();
      if (!pending) {
        const { nodes, edges } = get();
        pending = { nodes, edges };
      }
    },

    undo: () => {
      flush();
      const state = get();
      const entry = state.past[state.past.length - 1];
      if (!entry) return;
      const applied: DocSnapshot = {
        nodes: applyListDiff(state.nodes, entry.nodes, 'undo'),
        edges: applyListDiff(state.edges, entry.edges, 'undo'),
      };
      pending = applied;
      set(
        () =>
          ({
            past: state.past.slice(0, -1),
            future: [entry, ...state.future].slice(0, HISTORY_LIMIT),
            nodes: applied.nodes,
            edges: applied.edges,
            selectedNodes: [],
            selectedEdges: [],
          }) as unknown as Partial<S>,
      );
    },

    redo: () => {
      const state = get();
      const entry = state.future[0];
      if (!entry) return;
      const applied: DocSnapshot = {
        nodes: applyListDiff(state.nodes, entry.nodes, 'redo'),
        edges: applyListDiff(state.edges, entry.edges, 'redo'),
      };
      pending = applied;
      set(
        () =>
          ({
            past: [...state.past, entry].slice(-HISTORY_LIMIT),
            future: state.future.slice(1),
            nodes: applied.nodes,
            edges: applied.edges,
            selectedNodes: [],
            selectedEdges: [],
          }) as unknown as Partial<S>,
      );
    },

    resetHistory: (keep = false) => {
      const { nodes, edges } = get();
      pending = { nodes, edges };
      if (!keep) set(() => ({ past: [], future: [] }) as unknown as Partial<S>);
    },
  };
}
