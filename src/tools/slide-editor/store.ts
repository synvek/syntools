import { create } from 'zustand';
import { clampBounds } from './core';
import { cloneDoc, cloneElement, createDoc, createSlide, createId } from './model/factory';
import type { Slide, SlideDoc, SlideElement } from './model/types';

/**
 * 幻灯片编辑器状态：唯一真相源是 doc，其余（选中 / 视口 / 历史）是会话态。
 * 所有修改 doc 的 action 都先 commit() 把旧快照压入历史，保证 undo 可回放。
 */

const HISTORY_LIMIT = 50;

export interface Viewport {
  /** 画布缩放比例；0 = 尚未计算，宿主会按容器大小自动适配 */
  scale: number;
  width: number;
  height: number;
}

export interface ImportReport {
  /** 被降级为占位框的元素数量 */
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
  moveSelected: (dx: number, dy: number) => void;
  removeSelected: () => void;
  duplicateSelected: () => void;
  bringForward: () => void;
  sendBackward: () => void;

  commit: () => void;
  undo: () => void;
  redo: () => void;
}

const emptyReport: ImportReport | null = null;

export const useSlideStore = create<SlideState>((set, get) => ({
  doc: createDoc(),
  slideIndex: 0,
  selection: [],
  viewport: { scale: 0, width: 0, height: 0 },
  showPlaceholders: true,
  past: [],
  future: [],
  report: emptyReport,

  loadDoc: (doc, report) =>
    set((s) => ({
      doc,
      slideIndex: 0,
      selection: [],
      past: [],
      future: [],
      report: report ?? null,
      // 换了文档后重新自动适配缩放
      viewport: { ...s.viewport, scale: 0 },
    })),

  setDocName: (name) => set((s) => ({ doc: { ...s.doc, name } })),

  setViewport: (viewport) => set((s) => ({ viewport: { ...s.viewport, ...viewport } })),

  setScale: (scale) =>
    set((s) => ({
      viewport: { ...s.viewport, scale: Math.min(3, Math.max(0.1, Math.round(scale * 100) / 100)) },
    })),

  togglePlaceholders: () => set((s) => ({ showPlaceholders: !s.showPlaceholders })),

  /** 压入当前 doc 快照（历史环形上限 HISTORY_LIMIT） */
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
    })),

  addElement: (element) => {
    get().commit();
    set((s) => {
      const slides = s.doc.slides.map((slide, i) =>
        i === s.slideIndex ? { ...slide, elements: [...slide.elements, element] } : slide,
      );
      return {
        doc: { ...s.doc, slides, version: s.doc.version + 1 },
        selection: [element.id],
      };
    });
  },

  patchElement: (id, patch, history = true) => {
    if (history) get().commit();
    set((s) => {
      const slides = s.doc.slides.map((slide, i) => {
        if (i !== s.slideIndex) return slide;
        return {
          ...slide,
          elements: slide.elements.map((el) =>
            el.id === id ? ({ ...el, ...patch } as SlideElement) : el,
          ),
        };
      });
      return { doc: { ...s.doc, slides, version: s.doc.version + 1 } };
    });
  },

  patchSelected: (patch, history = true) => {
    if (history) get().commit();
    set((s) => {
      const slides = s.doc.slides.map((slide, i) => {
        if (i !== s.slideIndex) return slide;
        return {
          ...slide,
          elements: slide.elements.map((el) =>
            s.selection.includes(el.id) ? ({ ...el, ...patch } as SlideElement) : el,
          ),
        };
      });
      return { doc: { ...s.doc, slides, version: s.doc.version + 1 } };
    });
  },

  moveSelected: (dx, dy) =>
    set((s) => {
      const slides = s.doc.slides.map((slide, i) => {
        if (i !== s.slideIndex) return slide;
        return {
          ...slide,
          elements: slide.elements.map((el) => {
            if (!s.selection.includes(el.id)) return el;
            const next = clampBounds({ ...el, x: el.x + dx, y: el.y + dy }, s.doc);
            return { ...el, ...next } as SlideElement;
          }),
        };
      });
      return { doc: { ...s.doc, slides, version: s.doc.version + 1 } };
    }),

  removeSelected: () => {
    get().commit();
    set((s) => {
      if (s.selection.length === 0) return s;
      const slides = s.doc.slides.map((slide, i) =>
        i === s.slideIndex
          ? { ...slide, elements: slide.elements.filter((el) => !s.selection.includes(el.id)) }
          : slide,
      );
      return { doc: { ...s.doc, slides, version: s.doc.version + 1 }, selection: [] };
    });
  },

  duplicateSelected: () => {
    const { commit } = get();
    commit();
    set((s) => {
      const slide = s.doc.slides[s.slideIndex];
      if (!slide) return s;
      const copies = slide.elements
        .filter((el) => s.selection.includes(el.id))
        .map((el) => {
          const copy = cloneElement(el, true);
          return { ...copy, x: copy.x + 16, y: copy.y + 16 } as SlideElement;
        });
      if (copies.length === 0) return s;
      const slides = s.doc.slides.map((slide, i) =>
        i === s.slideIndex ? { ...slide, elements: [...slide.elements, ...copies] } : slide,
      );
      return {
        doc: { ...s.doc, slides, version: s.doc.version + 1 },
        selection: copies.map((el) => el.id),
      };
    });
  },

  bringForward: () => {
    get().commit();
    set((s) => {
      const slides = s.doc.slides.map((slide, i) => {
        if (i !== s.slideIndex) return slide;
        const elements = [...slide.elements];
        for (let index = elements.length - 2; index >= 0; index -= 1) {
          if (s.selection.includes(elements[index].id)) {
            const below = elements[index + 1];
            if (s.selection.includes(below.id)) continue;
            elements[index] = below;
            elements[index + 1] = slide.elements[index];
          }
        }
        return { ...slide, elements };
      });
      return { doc: { ...s.doc, slides, version: s.doc.version + 1 } };
    });
  },

  sendBackward: () => {
    get().commit();
    set((s) => {
      const slides = s.doc.slides.map((slide, i) => {
        if (i !== s.slideIndex) return slide;
        const elements = [...slide.elements];
        for (let index = 1; index < elements.length; index += 1) {
          if (s.selection.includes(elements[index].id)) {
            const above = elements[index - 1];
            if (s.selection.includes(above.id)) continue;
            elements[index] = above;
            elements[index - 1] = slide.elements[index];
          }
        }
        return { ...slide, elements };
      });
      return { doc: { ...s.doc, slides, version: s.doc.version + 1 } };
    });
  },
}));

/** 当前活动页（越界时回落到最后一页） */
export function activeSlide(state: SlideState): Slide | undefined {
  return state.doc.slides[state.slideIndex];
}
