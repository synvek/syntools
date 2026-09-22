/**
 * 脑图编辑器状态：唯一真相源是树（doc.nodes），坐标由 model/layout.ts 派生。
 * 结构性变更前先写历史快照，保证 undo / redo 可回放（沿用 flowchart-editor 模式）。
 */

import { create } from 'zustand';
import { layoutMindmap, type MindLayoutResult } from './model/layout';
import { DEFAULT_THEME_ID } from './model/themes';
import {
  addChild,
  addSibling,
  childrenOf,
  duplicateSubtree,
  emptyDoc,
  findNode,
  indentNode,
  moveNode,
  outdentNode,
  patchNode,
  removeNode,
  reparent,
  setAllCollapsed,
  toggleCollapse,
  visibleChildrenOf,
} from './model/tree';
import type { MindDoc, MindLayoutDirection, MindNodeRec, MindSide } from './model/types';

const HISTORY_LIMIT = 50;

/** 快照深拷贝：撤销栈只存纯数据，不含派生坐标 */
function snapshotOf(doc: MindDoc): MindDoc {
  return {
    ...doc,
    nodes: doc.nodes.map((n) => ({ ...n, style: n.style ? { ...n.style } : undefined })),
  };
}

interface UpdateOptions {
  /** 变更后的选中项；undefined 表示不变，null 表示取消选中 */
  select?: string | null;
  /** 变更后的文本编辑项 */
  edit?: string | null;
  /** false 时不写历史（连续输入类操作） */
  history?: boolean;
}

interface MindState {
  doc: MindDoc;
  layout: MindLayoutResult;
  selectedId: string | null;
  editingId: string | null;
  past: MindDoc[];
  future: MindDoc[];

  load: (doc: MindDoc | null) => void;
  getDoc: () => MindDoc;

  commit: () => void;
  undo: () => void;
  redo: () => void;

  select: (id: string | null) => void;
  /** 可见节点的先序序列（折叠子树不含在内） */
  visibleIds: () => string[];
  moveSelection: (dir: 'up' | 'down' | 'left' | 'right') => void;

  addChildOf: (id?: string | null) => void;
  addSiblingOf: (id?: string | null) => void;
  removeAt: (id?: string | null) => void;
  duplicateAt: (id?: string | null) => void;
  indentAt: (id?: string | null) => void;
  outdentAt: (id?: string | null) => void;
  moveAt: (id: string | null, dir: -1 | 1) => void;
  reparentAt: (id: string, parentId: string) => void;

  toggleCollapseAt: (id?: string | null) => void;
  setAllCollapsed: (collapsed: boolean) => void;

  beginEdit: (id: string) => void;
  endEdit: () => void;
  setText: (id: string, text: string) => void;
  patch: (id: string, patchValue: Partial<Omit<MindNodeRec, 'id'>>) => void;
  setSide: (id: string, side: MindSide) => void;

  setDirection: (direction: MindLayoutDirection) => void;
  setTheme: (themeId: string) => void;
  relayout: () => void;
}

const initialDoc = emptyDoc();

/** 操作目标：未指定（undefined / null）时用当前选中项，仍无则回落到根节点 */
function targetOf(state: MindState, id?: string | null): string | null {
  const wanted = id ?? state.selectedId;
  const hit = wanted ? findNode(state.doc.nodes, wanted) : undefined;
  if (hit) return hit.id;
  return state.doc.rootId;
}

export const useMindStore = create<MindState>((set, get) => {
  /** 结构 / 内容变更的统一入口：写历史 → 更新 doc → 重算布局 */
  const update = (nodes: MindNodeRec[], opts?: UpdateOptions) => {
    const state = get();
    const doc: MindDoc = { ...state.doc, nodes };
    const keepHistory = opts?.history === false;
    set({
      doc,
      layout: layoutMindmap(doc),
      past: keepHistory ? state.past : [...state.past, snapshotOf(state.doc)].slice(-HISTORY_LIMIT),
      future: keepHistory ? state.future : [],
      selectedId: opts && 'select' in opts ? (opts.select ?? null) : state.selectedId,
      editingId: opts && 'edit' in opts ? (opts.edit ?? null) : state.editingId,
    });
  };

  /** 仅替换文档级字段（方向 / 主题等），同样重算布局 */
  const updateDoc = (patch: Partial<MindDoc>, history = true) => {
    const state = get();
    const doc: MindDoc = { ...state.doc, ...patch };
    set({
      doc,
      layout: layoutMindmap(doc),
      past: history ? [...state.past, snapshotOf(state.doc)].slice(-HISTORY_LIMIT) : state.past,
      future: history ? [] : state.future,
    });
  };

  /** 撤销 / redo 落位：目标节点可能已被删除，需回落 */
  const restore = (doc: MindDoc) => {
    const state = get();
    const exists = state.selectedId ? findNode(doc.nodes, state.selectedId) : undefined;
    set({
      doc,
      layout: layoutMindmap(doc),
      selectedId: exists ? state.selectedId : doc.rootId,
      editingId: null,
    });
  };

  return {
    doc: initialDoc,
    layout: layoutMindmap(initialDoc),
    selectedId: initialDoc.rootId,
    editingId: null,
    past: [],
    future: [],

    load: (doc) => {
      const next = doc ?? emptyDoc();
      set({
        doc: next,
        layout: layoutMindmap(next),
        selectedId: next.rootId,
        editingId: null,
        past: [],
        future: [],
      });
    },

    getDoc: () => get().doc,

    commit: () =>
      set((s) => ({ past: [...s.past, snapshotOf(s.doc)].slice(-HISTORY_LIMIT), future: [] })),

    undo: () => {
      const state = get();
      const previous = state.past[state.past.length - 1];
      if (!previous) return;
      set({
        past: state.past.slice(0, -1),
        future: [snapshotOf(state.doc), ...state.future].slice(0, HISTORY_LIMIT),
      });
      restore(previous);
    },

    redo: () => {
      const state = get();
      const next = state.future[0];
      if (!next) return;
      set({
        past: [...state.past, snapshotOf(state.doc)].slice(-HISTORY_LIMIT),
        future: state.future.slice(1),
      });
      restore(next);
    },

    select: (id) => set({ selectedId: id, editingId: null }),

    visibleIds: () => {
      const { doc } = get();
      const out: string[] = [];
      const walk = (id: string) => {
        out.push(id);
        for (const child of visibleChildrenOf(doc.nodes, id)) walk(child.id);
      };
      walk(doc.rootId);
      return out;
    },

    moveSelection: (dir) => {
      const state = get();
      const current = state.selectedId ?? state.doc.rootId;
      const horizontal = state.doc.direction !== 'down';
      const order = state.visibleIds();
      const idx = order.indexOf(current);
      // 主轴方向：横向布局为左右，向下布局为上下
      const deeper = horizontal ? dir === 'right' : dir === 'down';
      const shallower = horizontal ? dir === 'left' : dir === 'up';
      if (deeper) {
        const kids = visibleChildrenOf(state.doc.nodes, current);
        if (kids.length > 0) {
          set({ selectedId: kids[0].id, editingId: null });
          return;
        }
      } else if (shallower) {
        const self = findNode(state.doc.nodes, current);
        if (self?.parentId) {
          set({ selectedId: self.parentId, editingId: null });
          return;
        }
      }
      if (idx < 0) return;
      const next = dir === 'up' || dir === 'left' ? idx - 1 : idx + 1;
      if (next < 0 || next >= order.length) return;
      set({ selectedId: order[next], editingId: null });
    },

    addChildOf: (id) => {
      const state = get();
      const parent = targetOf(state, id);
      if (!parent) return;
      // 不显式传文案：使用模型层的默认英文文案（Subtopic）
      const res = addChild(state.doc.nodes, parent);
      if (!res.id) return;
      update(res.nodes, { select: res.id, edit: res.id });
    },

    addSiblingOf: (id) => {
      const state = get();
      const anchor = targetOf(state, id);
      if (!anchor) return;
      // 同上：默认英文文案（Topic）
      const res = addSibling(state.doc.nodes, anchor);
      if (!res.id) return;
      update(res.nodes, { select: res.id, edit: res.id });
    },

    removeAt: (id) => {
      const state = get();
      const target = targetOf(state, id);
      if (!target) return;
      const self = findNode(state.doc.nodes, target);
      if (!self || self.parentId === null) return; // 中心主题不可删
      update(removeNode(state.doc.nodes, target), { select: self.parentId, edit: null });
    },

    duplicateAt: (id) => {
      const state = get();
      const target = targetOf(state, id);
      if (!target) return;
      const res = duplicateSubtree(state.doc.nodes, target);
      if (!res.id) return;
      update(res.nodes, { select: res.id, edit: null });
    },

    indentAt: (id) => {
      const state = get();
      const target = targetOf(state, id);
      if (!target) return;
      update(indentNode(state.doc.nodes, target), { select: target });
    },

    outdentAt: (id) => {
      const state = get();
      const target = targetOf(state, id);
      if (!target) return;
      update(outdentNode(state.doc.nodes, target), { select: target });
    },

    moveAt: (id, dir) => {
      const state = get();
      const target = targetOf(state, id);
      if (!target) return;
      update(moveNode(state.doc.nodes, target, dir), { select: target });
    },

    reparentAt: (id, parentId) => {
      const state = get();
      const next = reparent(state.doc.nodes, id, parentId);
      if (next === state.doc.nodes) return;
      update(next, { select: id, edit: null });
    },

    toggleCollapseAt: (id) => {
      const state = get();
      const target = targetOf(state, id);
      if (!target) return;
      update(toggleCollapse(state.doc.nodes, target), { select: target });
    },

    setAllCollapsed: (collapsed) => {
      const state = get();
      update(setAllCollapsed(state.doc.nodes, collapsed), { select: state.selectedId });
    },

    beginEdit: (id) => {
      const state = get();
      if (!findNode(state.doc.nodes, id)) return;
      // 重复进入（如双击事件被多处监听）不重复压历史
      if (state.editingId === id) return;
      set({
        past: [...state.past, snapshotOf(state.doc)].slice(-HISTORY_LIMIT),
        future: [],
        selectedId: id,
        editingId: id,
      });
    },

    endEdit: () => set({ editingId: null }),

    setText: (id, text) => {
      const state = get();
      update(patchNode(state.doc.nodes, id, { text }), { history: false });
    },

    patch: (id, patchValue) => {
      const state = get();
      update(patchNode(state.doc.nodes, id, patchValue));
    },

    setSide: (id, side) => {
      const state = get();
      update(patchNode(state.doc.nodes, id, { side }), { select: id });
    },

    setDirection: (direction) => updateDoc({ direction }),

    setTheme: (themeId) => updateDoc({ themeId: themeId || DEFAULT_THEME_ID }),

    relayout: () => set((s) => ({ layout: layoutMindmap(s.doc) })),
  };
});

/** 选中节点的子节点数量（折叠徽标用） */
export function childCountOf(doc: MindDoc, id: string): number {
  return childrenOf(doc.nodes, id).length;
}
