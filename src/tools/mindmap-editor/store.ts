/**
 * Mind map editor state: the tree (`doc.nodes`) is the single source of truth and coordinates are
 * derived by model/layout.ts. A history snapshot is written before every structural change so
 * undo / redo can replay it (following the flowchart-editor pattern).
 */

import { create } from 'zustand';
import { layoutMindmap, type MindLayoutResult } from './model/layout';
import { DEFAULT_THEME_ID } from './model/themes';
import {
  addChild,
  addSibling,
  childrenOf,
  createId,
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
import { serializeDoc } from './io/projectJson';
import type {
  MindDoc,
  MindLayoutDirection,
  MindNodeRec,
  MindProject,
  MindSheet,
  MindSide,
} from './model/types';

const HISTORY_LIMIT = 50;

/** Default first-sheet id (used for new documents and after clearing) */
export const DEFAULT_SHEET_ID = 'sheet-1';
/** Default first-sheet name */
export const DEFAULT_SHEET_NAME = '画布 1';

/** Normalise input to a project: null → one blank sheet; v1 flat doc → one sheet; v2 kept with defaults filled */
function normalizeProject(input: MindProject | MindDoc | null): MindProject {
  if (!input) {
    const doc = emptyDoc();
    return {
      version: 2,
      sheets: [{ id: DEFAULT_SHEET_ID, name: DEFAULT_SHEET_NAME, doc }],
      activeSheetId: DEFAULT_SHEET_ID,
    };
  }
  if ((input as MindProject).version === 2 && Array.isArray((input as MindProject).sheets)) {
    const p = input as MindProject;
    const sheets =
      p.sheets.length > 0
        ? p.sheets
        : [{ id: DEFAULT_SHEET_ID, name: DEFAULT_SHEET_NAME, doc: emptyDoc() }];
    const id =
      p.activeSheetId && sheets.some((s) => s.id === p.activeSheetId)
        ? p.activeSheetId
        : sheets[0].id;
    return {
      version: 2,
      ...(p.name === undefined ? {} : { name: p.name }),
      sheets,
      activeSheetId: id,
    };
  }
  // Flat v1 document → a single sheet
  const doc = input as MindDoc;
  return {
    version: 2,
    ...(doc.name === undefined ? {} : { name: doc.name }),
    sheets: [{ id: doc.rootId, name: DEFAULT_SHEET_NAME, doc }],
    activeSheetId: doc.rootId,
  };
}

/** Active sheet (the first one when no marker is set) */
function activeSheetOf(project: MindProject): MindSheet {
  const id = project.activeSheetId;
  return (id ? project.sheets.find((s) => s.id === id) : project.sheets[0]) ?? project.sheets[0];
}

/** Deep-copy snapshot: the undo stack stores pure data with no derived coordinates */
function snapshotOf(doc: MindDoc): MindDoc {
  return {
    ...doc,
    nodes: doc.nodes.map((n) => ({ ...n, style: n.style ? { ...n.style } : undefined })),
  };
}

interface UpdateOptions {
  /** Selection after the change; undefined keeps it, null clears it */
  select?: string | null;
  /** Node being edited after the change */
  edit?: string | null;
  /** false skips history (continuous typing operations) */
  history?: boolean;
}

interface MindState {
  doc: MindDoc;
  layout: MindLayoutResult;
  selectedId: string | null;
  editingId: string | null;
  past: MindDoc[];
  future: MindDoc[];

  /** Sheets: a document title plus sheet order and names; the active sheet lives in `doc`, others in `sheetData` */
  docName: string;
  sheetOrder: { id: string; name: string }[];
  activeSheetId: string;
  sheetData: Record<string, MindDoc>;
  addSheet: (name?: string) => void;
  switchSheet: (id: string) => void;
  renameSheet: (id: string, name: string) => void;
  removeSheet: (id: string) => void;
  moveSheet: (id: string, dir: -1 | 1) => void;

  load: (doc: MindProject | MindDoc | null) => void;
  getDoc: () => MindProject;
  /** Document title (source of the export filename, not part of undo history) */
  setDocName: (name: string) => void;

  commit: () => void;
  undo: () => void;
  redo: () => void;

  select: (id: string | null) => void;
  /** Pre-order list of visible node ids (collapsed subtrees excluded) */
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

/** Operation target: falls back to the current selection, then to the root node */
function targetOf(state: MindState, id?: string | null): string | null {
  const wanted = id ?? state.selectedId;
  const hit = wanted ? findNode(state.doc.nodes, wanted) : undefined;
  if (hit) return hit.id;
  return state.doc.rootId;
}

export const useMindStore = create<MindState>((set, get) => {
  /** Single entry point for structural / content changes: history → doc → relayout */
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

  /** Replace document-level fields only (direction / theme etc.) and relayout */
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

  /** Undo / redo landing: the selected node may be gone, so fall back */
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
    docName: '',
    sheetOrder: [{ id: DEFAULT_SHEET_ID, name: DEFAULT_SHEET_NAME }],
    activeSheetId: DEFAULT_SHEET_ID,
    sheetData: {},

    load: (doc) => {
      const project = normalizeProject(doc);
      const sheet = activeSheetOf(project);
      const sheetData: Record<string, MindDoc> = {};
      for (const s of project.sheets) if (s.id !== sheet.id) sheetData[s.id] = s.doc;
      set({
        doc: sheet.doc,
        layout: layoutMindmap(sheet.doc),
        selectedId: sheet.doc.rootId,
        editingId: null,
        past: [],
        future: [],
        docName: project.name ?? '',
        sheetOrder: project.sheets.map((s) => ({ id: s.id, name: s.name })),
        activeSheetId: sheet.id,
        sheetData,
      });
    },

    getDoc: () => {
      const { doc, docName, sheetOrder, activeSheetId, sheetData } = get();
      const active = serializeDoc(doc);
      const sheets: MindSheet[] = sheetOrder.map((meta) => {
        if (meta.id === activeSheetId) return { id: meta.id, name: meta.name, doc: active };
        const cached = sheetData[meta.id];
        return { id: meta.id, name: meta.name, doc: cached ?? emptyDoc() };
      });
      return {
        version: 2,
        ...(docName ? { name: docName } : {}),
        sheets,
        activeSheetId,
      };
    },

    setDocName: (name) => set({ docName: name }),

    addSheet: (name) => {
      const state = get();
      const project = state.getDoc();
      const cur = project.sheets.find((s) => s.id === state.activeSheetId);
      const blank = emptyDoc();
      const id = createId('sheet');
      set({
        sheetOrder: [
          ...state.sheetOrder,
          { id, name: name?.trim() || `画布 ${state.sheetOrder.length + 1}` },
        ],
        activeSheetId: id,
        sheetData: { ...state.sheetData, ...(cur ? { [state.activeSheetId]: cur.doc } : {}) },
        doc: blank,
        docName: state.docName,
        layout: layoutMindmap(blank),
        selectedId: blank.rootId,
        editingId: null,
        past: [],
        future: [],
      });
    },

    switchSheet: (id) => {
      const state = get();
      if (id === state.activeSheetId) return;
      const project = state.getDoc();
      const cur = project.sheets.find((s) => s.id === state.activeSheetId);
      const target = project.sheets.find((s) => s.id === id);
      if (!target) return;
      const sheetData = { ...state.sheetData };
      if (cur) sheetData[state.activeSheetId] = cur.doc;
      delete sheetData[id];
      set({
        doc: target.doc,
        docName: state.docName,
        sheetOrder: state.sheetOrder,
        activeSheetId: id,
        sheetData,
        layout: layoutMindmap(target.doc),
        selectedId: target.doc.rootId,
        editingId: null,
        past: [],
        future: [],
      });
    },

    renameSheet: (id, name) => {
      const trimmed = name.trim();
      if (!trimmed) return;
      set((s) => ({
        sheetOrder: s.sheetOrder.map((p) => (p.id === id ? { ...p, name: trimmed } : p)),
      }));
    },

    removeSheet: (id) => {
      const state = get();
      if (state.sheetOrder.length <= 1) return;
      const idx = state.sheetOrder.findIndex((p) => p.id === id);
      if (idx < 0) return;
      const sheetOrder = state.sheetOrder.filter((p) => p.id !== id);
      const sheetData = { ...state.sheetData };
      delete sheetData[id];
      if (id !== state.activeSheetId) {
        set({ sheetOrder, sheetData });
        return;
      }
      const next = sheetOrder[Math.min(idx, sheetOrder.length - 1)];
      const project = state.getDoc();
      const target = project.sheets.find((s) => s.id === next.id) ?? {
        id: next.id,
        name: next.name,
        doc: emptyDoc(),
      };
      set({
        sheetOrder,
        sheetData,
        activeSheetId: next.id,
        doc: target.doc,
        docName: state.docName,
        layout: layoutMindmap(target.doc),
        selectedId: target.doc.rootId,
        editingId: null,
        past: [],
        future: [],
      });
    },

    moveSheet: (id, dir) => {
      set((s) => {
        const idx = s.sheetOrder.findIndex((p) => p.id === id);
        const nextIdx = idx + dir;
        if (idx < 0 || nextIdx < 0 || nextIdx >= s.sheetOrder.length) return s;
        const sheetOrder = [...s.sheetOrder];
        [sheetOrder[idx], sheetOrder[nextIdx]] = [sheetOrder[nextIdx], sheetOrder[idx]];
        return { sheetOrder };
      });
    },

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
      // Main axis: left / right for horizontal layouts, up / down for the downward layout
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
      // No text passed explicitly: the model layer's default English copy (Subtopic) is used
      const res = addChild(state.doc.nodes, parent);
      if (!res.id) return;
      update(res.nodes, { select: res.id, edit: res.id });
    },

    addSiblingOf: (id) => {
      const state = get();
      const anchor = targetOf(state, id);
      if (!anchor) return;
      // Same as above: the default English copy (Topic)
      const res = addSibling(state.doc.nodes, anchor);
      if (!res.id) return;
      update(res.nodes, { select: res.id, edit: res.id });
    },

    removeAt: (id) => {
      const state = get();
      const target = targetOf(state, id);
      if (!target) return;
      const self = findNode(state.doc.nodes, target);
      if (!self || self.parentId === null) return; // the central topic cannot be deleted
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
      // Repeated entry (e.g. a double-click handled in several places) does not push history twice
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

/** Number of children of a node (for the collapse badge) */
export function childCountOf(doc: MindDoc, id: string): number {
  return childrenOf(doc.nodes, id).length;
}
