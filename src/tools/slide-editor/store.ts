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
 * 幻灯片编辑器状态：唯一真相源是 doc，其余（选中 / 视口 / 历史）是会话态。
 * 所有修改 doc 的 action 都先 commit() 把旧快照压入历史，保证 undo 可回放。
 */

const HISTORY_LIMIT = 50;

export interface Viewport {
  /** 画布缩放比例；0 = 尚未计算，宿主会按容器大小自动适配 */
  scale: number;
  width: number;
  height: number;
  /** 相对「页面居中位置」的平移偏移（滚轮平移 / 抓手拖动产生） */
  panX: number;
  panY: number;
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
  /** 会话内剪贴板：不入 doc、不进 undo，关闭页面即失效 */
  clipboard: SlideElement[];
  /** 表格当前活动单元格（点击画布单元格设置，供属性面板编辑文字） */
  activeCell: { row: number; col: number } | null;
  /** 网格吸附开关（开启后拖动会额外吸附到 GRID_SIZE 的整数倍） */
  gridSnap: boolean;
  /** 标尺与参考线显示开关 */
  showRulers: boolean;
  /** 手动参考线（会话态，不入 doc / 不进 undo） */
  guides: { id: string; axis: 'x' | 'y'; position: number }[];

  /** 视图模式：普通编辑 / 母版编辑 */
  viewMode: ViewMode;
  /** 母版视图下编辑的是母版还是某个版式 */
  masterKind: 'master' | 'layout';
  /** 母版视图下的目标下标 */
  masterIndex: number;
  /** 格式刷：已复制的样式快照（会话态，不入 doc） */
  formatPainter: StyleSnapshot | null;

  setViewMode: (mode: ViewMode) => void;
  selectMasterTarget: (kind: 'master' | 'layout', index: number) => void;
  /** 设置当前容器背景（普通视图 = 页面背景；母版视图 = 母版/版式背景） */
  setContainerBackground: (background: string | Fill | undefined) => void;
  /** 取出当前选中元素的样式快照（格式刷第一步） */
  copyFormat: () => void;
  /** 把样式快照套用到选中元素（格式刷第二步） */
  applyFormat: () => void;
  clearFormatPainter: () => void;

  /** 跨页全部替换（带 undo 快照） */
  replaceAll: (query: string, replacement: string, options?: FindOptions) => void;
  /** 跳到某处命中：切页并选中对应元素 */
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
  addGuide: (axis: 'x' | 'y', position: number) => void;
  moveGuide: (id: string, position: number) => void;
  removeGuide: (id: string) => void;

  copySelected: () => void;
  cutSelected: () => void;
  pasteClipboard: () => void;

  setActiveCell: (cell: { row: number; col: number } | null) => void;
  setTableSize: (rows: number, cols: number) => void;
  patchTableCell: (row: number, col: number, patch: Partial<TableCell>) => void;
  /** 把活动单元格与其右侧相邻单元格横向合并 */
  mergeCellRight: () => void;
  /** 拆分活动单元格（还原被覆盖的右侧格子） */
  splitCell: () => void;

  /** 把当前选中元素提升为母版元素（提升后所有页都会显示）。母版视图下为「移入版式」 */
  promoteSelectedToMaster: () => void;
  /** 清空母版公共元素 */
  clearMasterElements: () => void;
  setMasterBackground: (color: string | undefined) => void;

  /** 用一批新页整体替换（Markdown 大纲生成用） */
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
 * 视图模式：普通编辑 vs 母版编辑。
 *
 * 母版视图下所有元素操作应作用于母版/版式元素而不是当前页元素，
 * 因此把「当前编辑容器」抽成一对读写器（`containerElements` /
 * `writeContainerElements`），各 action 只改这两处的调用，
 * 避免逐个 action 重写页面定位逻辑。
 */
export type ViewMode = 'normal' | 'master';
export type ContainerKind = 'slide' | 'master' | 'layout';

export interface ContainerRef {
  kind: ContainerKind;
  index: number;
}

/** 当前编辑容器定位：普通视图 = 当前页；母版视图 = 选中的母版/版式 */
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

/** 读取容器元素（越界返回空数组，调用方无需再判空） */
function elementsOf(doc: SlideDoc, ref: ContainerRef): SlideElement[] {
  if (ref.kind === 'slide') return doc.slides[ref.index]?.elements ?? [];
  if (ref.kind === 'master') return doc.masters[ref.index]?.elements ?? [];
  return doc.layouts[ref.index]?.elements ?? [];
}

/** 容器背景（普通视图下为页面背景 + 所属版式/母版兜底） */
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

/** 读取当前编辑容器的元素数组 */
export function containerElements(s: ContainerHost): SlideElement[] {
  return elementsOf(s.doc, containerRefOf(s));
}

/** 写回当前编辑容器元素，返回新的 doc（触发 version 自增以失效缩略图缓存） */
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

/** 按 id 批量打补丁（只改命中的元素，其余保持引用不变） */
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
        // 格式刷为「一次性」使用，套用后自动清除（与 PowerPoint 单击行为一致）
        formatPainter: null,
      };
    });
  },

  clearFormatPainter: () => set({ formatPainter: null }),

  replaceAll: (query, replacement, options) => {
    if (!query.trim()) return;
    const state = get();
    const next = replaceInDoc(state.doc, query, replacement, options);
    // 无命中时不动历史，避免制造一次「什么都没变」的撤销点
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

  // 任何来源（pptx 导入 / .sld 打开 / 草稿恢复 / 模板套用）都在此过一遍迁移，
  // 保证 store 里流通的始终是当前 schema 的文档
  loadDoc: (doc, report) =>
    set((s) => ({
      doc: migrateDoc(doc),
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
      // 换选中元素时清掉表格活动单元格，避免面板继续指向已经取消选中的表格
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
        // 选中项整体移到末尾，内部保持原有相对顺序
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
    // 多选：对齐到选中元素的并集包围盒（对齐所选对象）；单选：对齐到幻灯片
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
    // children 存相对 group 原点的坐标（见 GroupElement 注释）
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
    // 插入位置沿用被选中元素中最靠前的那个，保持原有 z-order 直觉
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
        // 相对坐标还原为页面绝对坐标
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
    // 只要有一个未锁定就整体锁定，否则整体解锁
    const next = targets.some((el) => !el.locked);
    const patches = new Map<string, Partial<SlideElement>>(
      targets.map((el) => [el.id, { locked: next }]),
    );
    get().commit();
    set((s) => ({
      doc: writeContainerElements(s, (current) => patchElements(current, patches)),
      // 锁定后不应继续处于选中态
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
    // 保留已有内容：多出来的行/列补空单元格，减少的行/列直接裁掉
    const nextCells = target.rows.slice(0, nextRows).map((row) => {
      const copy = row.slice(0, nextCols);
      while (copy.length < nextCols) copy.push(emptyCell());
      return copy;
    });
    while (nextCells.length < nextRows) {
      nextCells.push(Array.from({ length: nextCols }, emptyCell));
    }
    // 行列尺寸按新数量均分（当前没有单独调整列宽的入口，均分最可预期）
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
    // 已经在母版视图里就没什么可提升的（避免把母版元素重复塞回母版）
    if (state.viewMode === 'master') return;
    get().commit();
    set((s) => {
      const withoutPicked = source.filter((el) => !s.selection.includes(el.id));
      const doc = writeContainerElements(s, withoutPicked);
      return {
        doc: {
          ...doc,
          // 母版元素坐标即页面坐标，无需换算
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
    // 只允许向右吞并「尚未被覆盖」的相邻格
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
        // 换模板后原有 layoutId 已不存在，统一指向新模板的首个版式，避免悬空引用
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

/** 当前活动页（越界时回落到最后一页） */
export function activeSlide(state: SlideState): Slide | undefined {
  return state.doc.slides[state.slideIndex];
}
