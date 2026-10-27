import { create } from 'zustand';
import {
  clampBounds,
  computeAlign,
  computeDistribute,
  unionBounds,
  type AlignMode,
  type AlignBox,
  type DistributeAxis,
} from './core';
import { cloneDoc, cloneElement, createDoc, createSlide, createId } from './model/factory';
import { migrateDoc } from './model/migrate';
import { replaceInDoc, type FindOptions, type TextHit } from './model/search';
import { applyStyleSnapshot, extractStyleSnapshot, type StyleSnapshot } from './model/style';
import { findTemplate, instantiateTemplate } from './model/templates';
import type { Fill, Slide, SlideDoc, SlideElement, TableCell } from './model/types';

/**
 * Slide editor state: `doc` is the single source of truth; the rest (selection / viewport / history) is session state.
 * Every action that mutates doc calls commit() first to push the old snapshot into history, so undo can replay it.
 */

const HISTORY_LIMIT = 50;

export interface Viewport {
  /** Canvas scale; 0 = not computed yet, the host fits it to the container */
  scale: number;
  width: number;
  height: number;
  /** Pan offset relative to the "page centered" position (produced by wheel panning / hand drag) */
  panX: number;
  panY: number;
}

export interface ImportReport {
  /** Number of elements downgraded to placeholder boxes */
  placeholders: number;
  skipped: string[];
}

interface SlideState {
  doc: SlideDoc;
  slideIndex: number;
  selection: string[];
  viewport: Viewport;
  showPlaceholders: boolean;
  past: SlideDoc[];
  future: SlideDoc[];
  report: ImportReport | null;
  /** Session clipboard: not part of doc, not in undo, lost when the page closes */
  clipboard: SlideElement[];
  /** Active table cell (set by clicking a cell on the canvas, used by the property panel to edit text) */
  activeCell: { row: number; col: number } | null;
  /** Grid snap toggle (dragging also snaps to multiples of GRID_SIZE when on) */
  gridSnap: boolean;
  /** Show rulers and guides */
  showRulers: boolean;
  /** Insert flyout tab (session UI state, shared by the toolbar and the menu bar) */
  insertPanel: 'shape' | 'chart' | 'icon' | 'formula' | null;
  /** Manual guides (session state, not part of doc / undo) */
  guides: { id: string; axis: 'x' | 'y'; position: number }[];

  /** View mode: normal editing / master editing */
  viewMode: ViewMode;
  /** In master view, whether a master or one of its layouts is being edited */
  masterKind: 'master' | 'layout';
  /** Target index in master view */
  masterIndex: number;
  /** Format painter: copied style snapshot (session state, not part of doc) */
  formatPainter: StyleSnapshot | null;

  setViewMode: (mode: ViewMode) => void;
  selectMasterTarget: (kind: 'master' | 'layout', index: number) => void;
  /** Set the current container background (normal view = slide background; master view = master/layout background) */
  setContainerBackground: (background: string | Fill | undefined) => void;
  /** Capture a style snapshot of the selection (format painter, step 1) */
  copyFormat: () => void;
  /** Apply the style snapshot to the selection (format painter, step 2) */
  applyFormat: () => void;
  clearFormatPainter: () => void;

  /** Replace all across slides (with an undo snapshot) */
  replaceAll: (query: string, replacement: string, options?: FindOptions) => void;
  /** Jump to a hit: switch slide and select the matching element */
  goToHit: (hit: TextHit) => void;

  loadDoc: (doc: SlideDoc, report?: ImportReport | null) => void;
  setDocName: (name: string) => void;
  setViewport: (viewport: Partial<Viewport>) => void;
  setScale: (scale: number) => void;
  togglePlaceholders: () => void;

  selectSlide: (index: number) => void;
  addSlide: () => void;
  duplicateSlide: (index: number) => void;
  removeSlide: (index: number) => void;
  moveSlide: (from: number, to: number) => void;
  updateSlide: (patch: Partial<Pick<Slide, 'background' | 'layoutId' | 'notes'>>) => void;

  select: (ids: string[], additive?: boolean) => void;
  addElement: (element: SlideElement) => void;
  patchElement: (id: string, patch: Partial<SlideElement>, history?: boolean) => void;
  patchSelected: (patch: Partial<SlideElement>, history?: boolean) => void;
  /**
   * Computes a patch from each element's **own current value** and applies it in bulk (`updater` returning `null` skips it).
   *
   * `patchSelected` can only send one identical patch, which suits "set everything to the same value"; but
   * "toggle based on each current value" (bold switch) or "derive a new body from each body" (font/align) must
   * be computed per element, otherwise a multi-select overwrites every element's text with the first element's body.
   */
  patchSelectedWith: (
    updater: (element: SlideElement) => Partial<SlideElement> | null,
    history?: boolean,
  ) => void;
  moveSelected: (dx: number, dy: number) => void;
  removeSelected: () => void;
  duplicateSelected: () => void;
  bringForward: () => void;
  sendBackward: () => void;
  bringToFront: () => void;
  sendToBack: () => void;
  alignSelected: (mode: AlignMode) => void;
  distributeSelected: (axis: DistributeAxis) => void;
  groupSelected: () => void;
  ungroupSelected: () => void;
  toggleLockSelected: () => void;
  toggleVisibleSelected: () => void;

  toggleGridSnap: () => void;
  toggleRulers: () => void;
  setInsertPanel: (panel: 'shape' | 'chart' | 'icon' | 'formula' | null) => void;
  addGuide: (axis: 'x' | 'y', position: number) => void;
  moveGuide: (id: string, position: number) => void;
  removeGuide: (id: string) => void;

  copySelected: () => void;
  cutSelected: () => void;
  pasteClipboard: () => void;

  setActiveCell: (cell: { row: number; col: number } | null) => void;
  setTableSize: (rows: number, cols: number) => void;
  patchTableCell: (row: number, col: number, patch: Partial<TableCell>) => void;
  /** Merge the active cell horizontally with its right neighbor */
  mergeCellRight: () => void;
  /** Split the active cell (restores the covered right-hand cell) */
  splitCell: () => void;

  /** Promote the selection to master elements (they then appear on every slide). In master view this "moves into the layout" */
  promoteSelectedToMaster: () => void;
  /** Clear the master's shared elements */
  clearMasterElements: () => void;
  setMasterBackground: (color: string | undefined) => void;

  /** Replace all slides at once (used by Markdown outline generation) */
  replaceSlides: (slides: Slide[]) => void;
  applyTemplate: (templateId: string) => void;
  applyThemeColor: (key: string, color: string) => void;
  setThemeFont: (scope: 'major' | 'minor', font: string) => void;

  commit: () => void;
  undo: () => void;
  redo: () => void;
}

const emptyReport: ImportReport | null = null;

/**
 * View mode: normal editing vs master editing.
 *
 * In master view every element operation must target master/layout elements instead of the current slide's,
 * so the "current editing container" is abstracted into a reader/writer pair (`containerElements` /
 * `writeContainerElements`); each action only changes those two call sites,
 * avoiding a per-action rewrite of the slide lookup logic.
 */
export type ViewMode = 'normal' | 'master';
export type ContainerKind = 'slide' | 'master' | 'layout';

export interface ContainerRef {
  kind: ContainerKind;
  index: number;
}

/** Locate the current editing container: normal view = current slide; master view = selected master/layout */
export function containerRefOf(s: {
  viewMode: ViewMode;
  slideIndex: number;
  masterKind: 'master' | 'layout';
  masterIndex: number;
}): ContainerRef {
  return s.viewMode === 'master'
    ? { kind: s.masterKind, index: s.masterIndex }
    : { kind: 'slide', index: s.slideIndex };
}

/** Read container elements (returns an empty array when out of range, callers need no null check) */
function elementsOf(doc: SlideDoc, ref: ContainerRef): SlideElement[] {
  if (ref.kind === 'slide') return doc.slides[ref.index]?.elements ?? [];
  if (ref.kind === 'master') return doc.masters[ref.index]?.elements ?? [];
  return doc.layouts[ref.index]?.elements ?? [];
}

/** Container background (slide background in normal view, plus the owning layout/master fallback) */
export function containerBackgroundOf(doc: SlideDoc, ref: ContainerRef): string | Fill | undefined {
  if (ref.kind === 'slide') {
    const slide = doc.slides[ref.index];
    if (!slide) return undefined;
    const layout = doc.layouts.find((item) => item.id === slide.layoutId);
    return slide.background ?? layout?.background ?? doc.masters[0]?.background;
  }
  if (ref.kind === 'master') return doc.masters[ref.index]?.background;
  return doc.layouts[ref.index]?.background;
}

type ContainerHost = Pick<
  SlideState,
  'doc' | 'viewMode' | 'slideIndex' | 'masterKind' | 'masterIndex'
>;

/** Read the element array of the current editing container */
export function containerElements(s: ContainerHost): SlideElement[] {
  return elementsOf(s.doc, containerRefOf(s));
}

/** Write the current container elements back and return a new doc (bumps version to invalidate thumbnail caches) */
function writeContainerElements(
  s: ContainerHost,
  next: SlideElement[] | ((current: SlideElement[]) => SlideElement[]),
): SlideDoc {
  const ref = containerRefOf(s);
  const current = elementsOf(s.doc, ref);
  const resolved = typeof next === 'function' ? next(current) : next;
  if (ref.kind === 'slide') {
    const slides = s.doc.slides.map((slide, i) =>
      i === ref.index ? { ...slide, elements: resolved } : slide,
    );
    return { ...s.doc, slides, version: s.doc.version + 1 };
  }
  if (ref.kind === 'master') {
    const masters = s.doc.masters.map((master, i) =>
      i === ref.index ? { ...master, elements: resolved } : master,
    );
    return { ...s.doc, masters, version: s.doc.version + 1 };
  }
  const layouts = s.doc.layouts.map((layout, i) =>
    i === ref.index ? { ...layout, elements: resolved } : layout,
  );
  return { ...s.doc, layouts, version: s.doc.version + 1 };
}

/** Bulk patch by id (only matching elements change, the rest keep their references) */
function patchElements(
  elements: SlideElement[],
  patches: Map<string, Partial<SlideElement>>,
): SlideElement[] {
  return elements.map((el) => {
    const patch = patches.get(el.id);
    return patch ? ({ ...el, ...patch } as SlideElement) : el;
  });
}

function toBox(element: SlideElement): AlignBox {
  return { x: element.x, y: element.y, width: element.width, height: element.height };
}

export const useSlideStore = create<SlideState>((set, get) => ({
  doc: createDoc(),
  slideIndex: 0,
  selection: [],
  viewport: { scale: 0, width: 0, height: 0, panX: 0, panY: 0 },
  showPlaceholders: true,
  past: [],
  future: [],
  report: emptyReport,
  clipboard: [],
  activeCell: null,
  gridSnap: false,
  showRulers: true,
  insertPanel: null,
  guides: [],
  viewMode: 'normal',
  masterKind: 'master',
  masterIndex: 0,
  formatPainter: null,

  setViewMode: (mode) => set({ viewMode: mode, selection: [], activeCell: null }),

  selectMasterTarget: (kind, index) =>
    set((s) => {
      const max = kind === 'master' ? s.doc.masters.length - 1 : s.doc.layouts.length - 1;
      return {
        masterKind: kind,
        masterIndex: Math.min(Math.max(index, 0), Math.max(0, max)),
        selection: [],
      };
    }),

  setContainerBackground: (background) => {
    get().commit();
    set((s) => {
      const ref = containerRefOf(s);
      if (ref.kind === 'slide') {
        return {
          doc: {
            ...s.doc,
            slides: s.doc.slides.map((slide, i) =>
              i === ref.index ? { ...slide, background: background ?? undefined } : slide,
            ),
            version: s.doc.version + 1,
          },
        };
      }
      if (ref.kind === 'master') {
        return {
          doc: {
            ...s.doc,
            masters: s.doc.masters.map((master, i) =>
              i === ref.index ? { ...master, background: background ?? undefined } : master,
            ),
            version: s.doc.version + 1,
          },
        };
      }
      return {
        doc: {
          ...s.doc,
          layouts: s.doc.layouts.map((layout, i) =>
            i === ref.index ? { ...layout, background: background ?? undefined } : layout,
          ),
          version: s.doc.version + 1,
        },
      };
    });
  },

  copyFormat: () => {
    const state = get();
    const target = containerElements(state).find((el) => state.selection.includes(el.id));
    if (!target) return;
    set({ formatPainter: extractStyleSnapshot(target) });
  },

  applyFormat: () => {
    const state = get();
    const snapshot = state.formatPainter;
    if (!snapshot || state.selection.length === 0) return;
    get().commit();
    set((s) => {
      const patches = new Map<string, Partial<SlideElement>>();
      for (const element of containerElements(s)) {
        if (!s.selection.includes(element.id)) continue;
        patches.set(element.id, applyStyleSnapshot(element, snapshot));
      }
      if (patches.size === 0) return s;
      return {
        doc: writeContainerElements(s, (current) => patchElements(current, patches)),
        // The format painter is single-use: it clears itself after applying (matching PowerPoint's click behavior)
        formatPainter: null,
      };
    });
  },

  clearFormatPainter: () => set({ formatPainter: null }),

  replaceAll: (query, replacement, options) => {
    if (!query.trim()) return;
    const state = get();
    const next = replaceInDoc(state.doc, query, replacement, options);
    // No hit: leave history alone so we don't create a "nothing changed" undo step
    if (next === state.doc) return;
    get().commit();
    set({ doc: next, activeCell: null });
  },

  goToHit: (hit) => {
    set((s) => ({
      slideIndex: Math.min(Math.max(hit.slideIndex, 0), s.doc.slides.length - 1),
      selection: hit.elementId ? [hit.elementId] : [],
      activeCell: hit.cell ?? null,
    }));
  },

  // Every source (pptx import / .sld open / draft restore / template apply) goes through migration here,
  // so the store always holds a document in the current schema
  loadDoc: (doc, report) =>
    set((s) => ({
      doc: migrateDoc(doc),
      slideIndex: 0,
      selection: [],
      past: [],
      future: [],
      report: report ?? null,
      // Re-fit the zoom after switching documents
      viewport: { ...s.viewport, scale: 0 },
    })),

  setDocName: (name) => set((s) => ({ doc: { ...s.doc, name } })),

  setViewport: (viewport) => set((s) => ({ viewport: { ...s.viewport, ...viewport } })),

  setScale: (scale) =>
    set((s) => ({
      viewport: { ...s.viewport, scale: Math.min(3, Math.max(0.1, Math.round(scale * 100) / 100)) },
    })),

  togglePlaceholders: () => set((s) => ({ showPlaceholders: !s.showPlaceholders })),

  /** Push the current doc snapshot (history ring capped at HISTORY_LIMIT) */
  commit: () =>
    set((s) => {
      const past = [...s.past, cloneDoc(s.doc)].slice(-HISTORY_LIMIT);
      return { past, future: [] };
    }),

  undo: () =>
    set((s) => {
      const previous = s.past[s.past.length - 1];
      if (!previous) return s;
      return {
        past: s.past.slice(0, -1),
        future: [cloneDoc(s.doc), ...s.future].slice(0, HISTORY_LIMIT),
        doc: previous,
        slideIndex: Math.min(s.slideIndex, previous.slides.length - 1),
        selection: [],
      };
    }),

  redo: () =>
    set((s) => {
      const next = s.future[0];
      if (!next) return s;
      return {
        past: [...s.past, cloneDoc(s.doc)].slice(-HISTORY_LIMIT),
        future: s.future.slice(1),
        doc: next,
        slideIndex: Math.min(s.slideIndex, next.slides.length - 1),
        selection: [],
      };
    }),

  selectSlide: (index) =>
    set((s) => ({
      slideIndex: Math.min(Math.max(index, 0), s.doc.slides.length - 1),
      selection: [],
    })),

  addSlide: () => {
    get().commit();
    set((s) => {
      const slide = createSlide(s.doc.layouts[0]?.id);
      const slides = [...s.doc.slides];
      slides.splice(s.slideIndex + 1, 0, slide);
      return {
        doc: { ...s.doc, slides, version: s.doc.version + 1 },
        slideIndex: s.slideIndex + 1,
        selection: [],
      };
    });
  },

  duplicateSlide: (index) => {
    get().commit();
    set((s) => {
      const source = s.doc.slides[index];
      if (!source) return s;
      const copy: Slide = {
        ...cloneDoc({ ...s.doc, slides: [source] }).slides[0],
        id: createId('slide'),
      };
      const slides = [...s.doc.slides];
      slides.splice(index + 1, 0, copy);
      return {
        doc: { ...s.doc, slides, version: s.doc.version + 1 },
        slideIndex: index + 1,
        selection: [],
      };
    });
  },

  removeSlide: (index) => {
    get().commit();
    set((s) => {
      if (s.doc.slides.length <= 1) return s;
      const slides = s.doc.slides.filter((_, i) => i !== index);
      return {
        doc: { ...s.doc, slides, version: s.doc.version + 1 },
        slideIndex: Math.min(index, slides.length - 1),
        selection: [],
      };
    });
  },

  moveSlide: (from, to) => {
    get().commit();
    set((s) => {
      if (from === to || from < 0 || to < 0) return s;
      if (from >= s.doc.slides.length || to >= s.doc.slides.length) return s;
      const slides = [...s.doc.slides];
      const [moved] = slides.splice(from, 1);
      slides.splice(to, 0, moved);
      return {
        doc: { ...s.doc, slides, version: s.doc.version + 1 },
        slideIndex: to,
      };
    });
  },

  updateSlide: (patch) => {
    get().commit();
    set((s) => {
      const slides = s.doc.slides.map((slide, i) =>
        i === s.slideIndex ? { ...slide, ...patch } : slide,
      );
      return { doc: { ...s.doc, slides, version: s.doc.version + 1 } };
    });
  },

  select: (ids, additive = false) =>
    set((s) => ({
      selection: additive ? Array.from(new Set([...s.selection, ...ids])) : ids,
      // Clear the active table cell when the selection changes, so the panel doesn't point at an unselected table
      activeCell: null,
    })),

  addElement: (element) => {
    get().commit();
    set((s) => ({
      doc: writeContainerElements(s, (current) => [...current, element]),
      selection: [element.id],
    }));
  },

  patchElement: (id, patch, history = true) => {
    if (history) get().commit();
    set((s) => ({
      doc: writeContainerElements(s, (current) =>
        current.map((el) => (el.id === id ? ({ ...el, ...patch } as SlideElement) : el)),
      ),
    }));
  },

  patchSelected: (patch, history = true) => {
    if (history) get().commit();
    set((s) => {
      const patches = new Map<string, Partial<SlideElement>>();
      for (const id of s.selection) patches.set(id, patch);
      return { doc: writeContainerElements(s, (current) => patchElements(current, patches)) };
    });
  },

  patchSelectedWith: (updater, history = true) => {
    const state = get();
    const patches = new Map<string, Partial<SlideElement>>();
    for (const element of containerElements(state)) {
      if (!state.selection.includes(element.id)) continue;
      const patch = updater(element);
      // Skip empty patches (e.g. font size already at its limit) to avoid a "nothing changed" undo step
      if (patch && Object.keys(patch).length > 0) patches.set(element.id, patch);
    }
    if (patches.size === 0) return;
    if (history) get().commit();
    set((s) => ({
      doc: writeContainerElements(s, (current) => patchElements(current, patches)),
    }));
  },

  moveSelected: (dx, dy) =>
    set((s) => ({
      doc: writeContainerElements(s, (current) =>
        current.map((el) => {
          if (!s.selection.includes(el.id)) return el;
          const next = clampBounds({ ...el, x: el.x + dx, y: el.y + dy }, s.doc);
          return { ...el, ...next } as SlideElement;
        }),
      ),
    })),

  removeSelected: () => {
    get().commit();
    set((s) => {
      if (s.selection.length === 0) return s;
      return {
        doc: writeContainerElements(s, (current) =>
          current.filter((el) => !s.selection.includes(el.id)),
        ),
        selection: [],
      };
    });
  },

  duplicateSelected: () => {
    const { commit } = get();
    commit();
    set((s) => {
      const current = containerElements(s);
      const copies = current
        .filter((el) => s.selection.includes(el.id))
        .map((el) => {
          const copy = cloneElement(el, true);
          return { ...copy, x: copy.x + 16, y: copy.y + 16 } as SlideElement;
        });
      if (copies.length === 0) return s;
      return {
        doc: writeContainerElements(s, (list) => [...list, ...copies]),
        selection: copies.map((el) => el.id),
      };
    });
  },

  bringForward: () => {
    get().commit();
    set((s) => ({
      doc: writeContainerElements(s, (current) => {
        const elements = [...current];
        for (let index = elements.length - 2; index >= 0; index -= 1) {
          if (s.selection.includes(elements[index].id)) {
            const below = elements[index + 1];
            if (s.selection.includes(below.id)) continue;
            elements[index] = below;
            elements[index + 1] = current[index];
          }
        }
        return elements;
      }),
    }));
  },

  sendBackward: () => {
    get().commit();
    set((s) => ({
      doc: writeContainerElements(s, (current) => {
        const elements = [...current];
        for (let index = 1; index < elements.length; index += 1) {
          if (s.selection.includes(elements[index].id)) {
            const above = elements[index - 1];
            if (s.selection.includes(above.id)) continue;
            elements[index] = above;
            elements[index - 1] = current[index];
          }
        }
        return elements;
      }),
    }));
  },

  bringToFront: () => {
    get().commit();
    set((s) => ({
      doc: writeContainerElements(s, (current) => {
        const picked = current.filter((el) => s.selection.includes(el.id));
        if (picked.length === 0) return current;
        const rest = current.filter((el) => !s.selection.includes(el.id));
        // Move the selection to the end as a block, keeping its internal relative order
        return [...rest, ...picked];
      }),
    }));
  },

  sendToBack: () => {
    get().commit();
    set((s) => ({
      doc: writeContainerElements(s, (current) => {
        const picked = current.filter((el) => s.selection.includes(el.id));
        if (picked.length === 0) return current;
        const rest = current.filter((el) => !s.selection.includes(el.id));
        return [...picked, ...rest];
      }),
    }));
  },

  alignSelected: (mode) => {
    const state = get();
    const targets = containerElements(state).filter((el) => state.selection.includes(el.id));
    if (targets.length === 0) return;
    const boxes = targets.map(toBox);
    // Multi-select: align to the union bounds of the selection (align to selection); single: align to slide
    const bounds =
      targets.length > 1
        ? unionBounds(boxes)
        : { x: 0, y: 0, width: state.doc.width, height: state.doc.height };
    const deltas = computeAlign(mode, boxes, bounds);
    const patches = new Map<string, Partial<SlideElement>>();
    targets.forEach((element, index) => {
      const { dx, dy } = deltas[index];
      if (dx === 0 && dy === 0) return;
      patches.set(element.id, { x: element.x + dx, y: element.y + dy });
    });
    if (patches.size === 0) return;
    get().commit();
    set((s) => ({
      doc: writeContainerElements(s, (current) => patchElements(current, patches)),
    }));
  },

  distributeSelected: (axis) => {
    const state = get();
    const targets = containerElements(state).filter((el) => state.selection.includes(el.id));
    if (targets.length < 3) return;
    const deltas = computeDistribute(axis, targets.map(toBox));
    const patches = new Map<string, Partial<SlideElement>>();
    targets.forEach((element, index) => {
      const { dx, dy } = deltas[index];
      if (dx === 0 && dy === 0) return;
      patches.set(element.id, { x: element.x + dx, y: element.y + dy });
    });
    if (patches.size === 0) return;
    get().commit();
    set((s) => ({
      doc: writeContainerElements(s, (current) => patchElements(current, patches)),
    }));
  },

  groupSelected: () => {
    const state = get();
    const current = containerElements(state);
    const picked = current.filter((el) => state.selection.includes(el.id));
    if (picked.length < 2) return;
    const bounds = unionBounds(picked.map(toBox));
    // children store coordinates relative to the group origin (see the GroupElement comment)
    const children = picked.map(
      (element) =>
        ({
          ...cloneElement(element),
          x: element.x - bounds.x,
          y: element.y - bounds.y,
        }) as SlideElement,
    );
    const group: SlideElement = {
      id: createId('el'),
      type: 'group',
      x: Math.round(bounds.x),
      y: Math.round(bounds.y),
      width: Math.round(bounds.width),
      height: Math.round(bounds.height),
      children,
    };
    const rest = current.filter((el) => !state.selection.includes(el.id));
    // Insert at the earliest index among the selected elements to keep z-order intuitive
    const firstIndex = current.findIndex((el) => state.selection.includes(el.id));
    const elements = [...rest];
    elements.splice(Math.min(Math.max(firstIndex, 0), rest.length), 0, group);
    get().commit();
    set((s) => ({
      doc: writeContainerElements(s, elements),
      selection: [group.id],
    }));
  },

  ungroupSelected: () => {
    const state = get();
    const current = containerElements(state);
    const hasGroup = current.some((el) => state.selection.includes(el.id) && el.type === 'group');
    if (!hasGroup) return;
    const elements: SlideElement[] = [];
    const restored: string[] = [];
    for (const element of current) {
      if (!state.selection.includes(element.id) || element.type !== 'group') {
        elements.push(element);
        continue;
      }
      for (const child of element.children) {
        // Convert relative coordinates back to absolute page coordinates
        const abs = {
          ...cloneElement(child),
          x: element.x + child.x,
          y: element.y + child.y,
        } as SlideElement;
        elements.push(abs);
        restored.push(abs.id);
      }
    }
    get().commit();
    set((s) => ({
      doc: writeContainerElements(s, elements),
      selection: restored,
    }));
  },

  toggleLockSelected: () => {
    const state = get();
    const targets = containerElements(state).filter((el) => state.selection.includes(el.id));
    if (targets.length === 0) return;
    // Lock everything if any target is unlocked, otherwise unlock everything
    const next = targets.some((el) => !el.locked);
    const patches = new Map<string, Partial<SlideElement>>(
      targets.map((el) => [el.id, { locked: next }]),
    );
    get().commit();
    set((s) => ({
      doc: writeContainerElements(s, (current) => patchElements(current, patches)),
      // A locked element should not stay selected
      selection: next ? [] : s.selection,
    }));
  },

  toggleVisibleSelected: () => {
    const state = get();
    const targets = containerElements(state).filter((el) => state.selection.includes(el.id));
    if (targets.length === 0) return;
    const next = targets.some((el) => el.visible !== false);
    const patches = new Map<string, Partial<SlideElement>>(
      targets.map((el) => [el.id, { visible: !next }]),
    );
    get().commit();
    set((s) => ({
      doc: writeContainerElements(s, (current) => patchElements(current, patches)),
    }));
  },

  copySelected: () => {
    const state = get();
    const picked = containerElements(state)
      .filter((el) => state.selection.includes(el.id))
      .map((el) => cloneElement(el, true));
    if (picked.length === 0) return;
    set({ clipboard: picked });
  },

  cutSelected: () => {
    get().copySelected();
    get().removeSelected();
  },

  pasteClipboard: () => {
    const state = get();
    if (state.clipboard.length === 0) return;
    const copies = state.clipboard.map(
      (el) => ({ ...cloneElement(el, true), x: el.x + 16, y: el.y + 16 }) as SlideElement,
    );
    get().commit();
    set((s) => ({
      doc: writeContainerElements(s, (current) => [...current, ...copies]),
      selection: copies.map((el) => el.id),
    }));
  },

  setActiveCell: (cell) => set({ activeCell: cell }),

  toggleGridSnap: () => set((s) => ({ gridSnap: !s.gridSnap })),

  toggleRulers: () => set((s) => ({ showRulers: !s.showRulers })),

  setInsertPanel: (panel) => set({ insertPanel: panel }),

  addGuide: (axis, position) =>
    set((s) => ({
      guides: [...s.guides, { id: createId('guide'), axis, position: Math.round(position) }],
    })),

  moveGuide: (id, position) =>
    set((s) => ({
      guides: s.guides.map((guide) =>
        guide.id === id ? { ...guide, position: Math.round(position) } : guide,
      ),
    })),

  removeGuide: (id) => set((s) => ({ guides: s.guides.filter((guide) => guide.id !== id) })),

  setTableSize: (rows, cols) => {
    const state = get();
    const target = containerElements(state).find(
      (el) => state.selection.includes(el.id) && el.type === 'table',
    );
    if (!target || target.type !== 'table') return;
    const nextRows = Math.max(1, Math.min(50, Math.round(rows)));
    const nextCols = Math.max(1, Math.min(50, Math.round(cols)));
    if (nextRows === target.rows.length && nextCols === target.colWidths.length) return;

    const emptyCell = (): TableCell => ({ text: '', align: 'left', valign: 'middle' });
    // Keep existing content: pad missing rows/columns with empty cells, drop the removed ones
    const nextCells = target.rows.slice(0, nextRows).map((row) => {
      const copy = row.slice(0, nextCols);
      while (copy.length < nextCols) copy.push(emptyCell());
      return copy;
    });
    while (nextCells.length < nextRows) {
      nextCells.push(Array.from({ length: nextCols }, emptyCell));
    }
    // Divide row/column sizes evenly (there is no per-column resize entry point, even is most predictable)
    const colWidths = Array.from({ length: nextCols }, () => Math.round(target.width / nextCols));
    const rowHeights = Array.from({ length: nextRows }, () => Math.round(target.height / nextRows));
    const patches = new Map<string, Partial<SlideElement>>();
    patches.set(target.id, { rows: nextCells, colWidths, rowHeights });
    get().commit();
    set((s) => ({
      doc: writeContainerElements(s, (current) => patchElements(current, patches)),
      activeCell: null,
    }));
  },

  patchTableCell: (row, col, patch) => {
    const state = get();
    const target = containerElements(state).find(
      (el) => state.selection.includes(el.id) && el.type === 'table',
    );
    if (!target || target.type !== 'table') return;
    if (!target.rows[row]?.[col]) return;
    const rows = target.rows.map((cells, rowIndex) =>
      rowIndex === row
        ? cells.map((cell, colIndex) => (colIndex === col ? { ...cell, ...patch } : cell))
        : cells,
    );
    const patches = new Map<string, Partial<SlideElement>>();
    patches.set(target.id, { rows });
    get().commit();
    set((s) => ({
      doc: writeContainerElements(s, (current) => patchElements(current, patches)),
    }));
  },

  promoteSelectedToMaster: () => {
    const state = get();
    const master = state.doc.masters[0];
    if (!master || state.selection.length === 0) return;
    const source = containerElements(state);
    const picked = source.filter((el) => state.selection.includes(el.id));
    if (picked.length === 0) return;
    // Already in master view: nothing to promote (avoids pushing master elements back into the master)
    if (state.viewMode === 'master') return;
    get().commit();
    set((s) => {
      const withoutPicked = source.filter((el) => !s.selection.includes(el.id));
      const doc = writeContainerElements(s, withoutPicked);
      return {
        doc: {
          ...doc,
          // Master element coordinates are page coordinates already, no conversion needed
          masters: doc.masters.map((item, index) =>
            index === 0 ? { ...item, elements: [...item.elements, ...picked] } : item,
          ),
          version: doc.version + 1,
        },
        selection: [],
      };
    });
  },

  clearMasterElements: () => {
    const master = get().doc.masters[0];
    if (!master || master.elements.length === 0) return;
    get().commit();
    set((s) => ({
      doc: {
        ...s.doc,
        masters: s.doc.masters.map((item, index) =>
          index === 0 ? { ...item, elements: [] } : item,
        ),
        version: s.doc.version + 1,
      },
    }));
  },

  setMasterBackground: (color) => {
    const master = get().doc.masters[0];
    if (!master) return;
    get().commit();
    set((s) => ({
      doc: {
        ...s.doc,
        masters: s.doc.masters.map((item, index) =>
          index === 0 ? { ...item, background: color } : item,
        ),
        version: s.doc.version + 1,
      },
    }));
  },

  replaceSlides: (slides) => {
    if (slides.length === 0) return;
    get().commit();
    set((s) => ({
      doc: { ...s.doc, slides, version: s.doc.version + 1 },
      slideIndex: 0,
      selection: [],
      activeCell: null,
    }));
  },

  mergeCellRight: () => {
    const state = get();
    const target = containerElements(state).find(
      (el) => state.selection.includes(el.id) && el.type === 'table',
    );
    const cell = state.activeCell;
    if (!target || target.type !== 'table' || !cell) return;
    const row = target.rows[cell.row];
    const current = row?.[cell.col];
    const next = row?.[cell.col + 1];
    // Only swallow right-hand neighbors that are not covered yet
    if (!current || !next || next.covered) return;
    const consume = Math.max(1, next.colSpan ?? 1);
    const rows = target.rows.map((cells, rowIndex) =>
      rowIndex !== cell.row
        ? cells
        : cells.map((item, colIndex) => {
            if (colIndex === cell.col) {
              return { ...item, colSpan: (item.colSpan ?? 1) + consume };
            }
            if (colIndex > cell.col && colIndex <= cell.col + consume) {
              return {
                ...item,
                covered: true,
                coveredBy: 'h' as const,
                colSpan: undefined,
                text: '',
              };
            }
            return item;
          }),
    );
    const patches = new Map<string, Partial<SlideElement>>();
    patches.set(target.id, { rows });
    get().commit();
    set((s) => ({
      doc: writeContainerElements(s, (current) => patchElements(current, patches)),
    }));
  },

  splitCell: () => {
    const state = get();
    const target = containerElements(state).find(
      (el) => state.selection.includes(el.id) && el.type === 'table',
    );
    const cell = state.activeCell;
    if (!target || target.type !== 'table' || !cell) return;
    const current = target.rows[cell.row]?.[cell.col];
    const span = current?.colSpan ?? 1;
    if (!current || span <= 1) return;
    const rows = target.rows.map((cells, rowIndex) =>
      rowIndex !== cell.row
        ? cells
        : cells.map((item, colIndex) => {
            if (colIndex === cell.col) return { ...item, colSpan: undefined };
            if (colIndex > cell.col && colIndex < cell.col + span) {
              return { ...item, covered: undefined, coveredBy: undefined };
            }
            return item;
          }),
    );
    const patches = new Map<string, Partial<SlideElement>>();
    patches.set(target.id, { rows });
    get().commit();
    set((s) => ({
      doc: writeContainerElements(s, (current) => patchElements(current, patches)),
    }));
  },

  applyTemplate: (templateId) => {
    const template = findTemplate(templateId);
    if (!template) return;
    const { theme, masters, layouts } = instantiateTemplate(template);
    const defaultLayoutId = layouts[0]?.id;
    get().commit();
    set((s) => ({
      doc: {
        ...s.doc,
        theme,
        masters,
        layouts,
        // The old layoutId is gone after a template change; point every slide at the new template's first layout to avoid dangling refs
        slides: s.doc.slides.map((slide) => ({ ...slide, layoutId: defaultLayoutId })),
        version: s.doc.version + 1,
      },
      selection: [],
    }));
  },

  applyThemeColor: (key, color) => {
    get().commit();
    set((s) => ({
      doc: {
        ...s.doc,
        theme: { ...s.doc.theme, colors: { ...s.doc.theme.colors, [key]: color } },
        version: s.doc.version + 1,
      },
    }));
  },

  setThemeFont: (scope, font) => {
    const fonts = { latin: font, ea: font, cs: font };
    get().commit();
    set((s) => ({
      doc: {
        ...s.doc,
        theme: {
          ...s.doc.theme,
          [scope === 'major' ? 'majorFont' : 'minorFont']: fonts,
        },
        version: s.doc.version + 1,
      },
    }));
  },
}));

/** Current active slide (falls back to the last slide when out of range) */
export function activeSlide(state: SlideState): Slide | undefined {
  return state.doc.slides[state.slideIndex];
}
