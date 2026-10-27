/**
 * Undo/redo: **structural diff history** (replacing the earlier whole-graph snapshot approach).
 *
 * Background: the earlier commit pushed entire nodes/edges arrays onto the stack, so a large diagram with 50 history steps
 * held many array references and objects for a long time. Now only the before/after of the nodes/edges touched by a change is recorded:
 * - unaffected node references stay identical → the diff stores references only, no deep copies (immutable updates keep this safe);
 * - each history entry holds only entries that really changed, so memory and copy cost stay near zero for small edits on large diagrams.
 *
 * Timing (commit happens *before* a change, so the pending baseline settles it later):
 * commit() ── flush the previous pending diff onto the stack, then record the current state as the new pending
 * undo()   ── flush unstacked changes first, then pop the last diff and apply it in reverse
 */

import type { FlowEdge, FlowNode } from './helpers';
import { HISTORY_LIMIT } from './helpers';

/**
 * One diff entry: id + index before and after + before/after (absent means "not present on that side").
 * Indices are recorded to restore stacking order (array order is layering); -1 means absent on that side.
 */
export interface ListEntry<T> {
  id: string;
  /** Index before the change; -1 means inserted */
  prevIndex: number;
  /** Index after the change; -1 means deleted */
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
  /** Rebuild the baseline after loading a document (keeps the history stack when keep is true, for snapshot rollback) */
  resetHistory: (keep?: boolean) => void;
}

/** Compute the minimal diff between two arrays */
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
      // Deletion
      out.push({ id: item.id, prevIndex: at, nextIndex: -1, before: item });
      return;
    }
    const nextItem = next[after];
    // Same reference and same position → unchanged (the core invariant of immutable updates, a zero-cost shortcut)
    if (nextItem === item && after === at) return;
    out.push({ id: item.id, prevIndex: at, nextIndex: after, before: item, after: nextItem });
  });

  next.forEach((item, at) => {
    if (prevIndex.has(item.id)) return;
    out.push({ id: item.id, prevIndex: -1, nextIndex: at, after: item });
  });
  return out;
}

/** Apply a diff to an array (dir='undo' takes before/prevIndex, 'redo' takes after/nextIndex) */
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
 * Create the history slice.
 * pending / baseline live in the closure rather than reactive state (avoiding pointless subscriber notifications).
 */
export function createHistorySlice<S extends HistoryState & DocSnapshot>(
  set: (partial: Partial<S> | ((state: S) => Partial<S>)) => void,
  get: () => S,
): HistoryState {
  /** State at the previous commit (the baseline of changes not yet settled) */
  let pending: DocSnapshot | null = null;

  /** Settle pending: compress "the changes since the previous commit" into one diff entry pushed onto the stack */
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
