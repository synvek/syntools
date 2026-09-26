import { Plugin, PluginKey } from '@tiptap/pm/state';
import type { Node as PMNode } from '@tiptap/pm/model';
import type { Transaction } from '@tiptap/pm/state';
import { Decoration, DecorationSet } from '@tiptap/pm/view';
import type { EditorView } from '@tiptap/pm/view';
import { planPageBlocks } from './core';

/**
 * Word 式分页编辑视图（ProseMirror 正统实现）：
 *
 * 文档仍是单一 PM 文档；页间空白通过 Decoration.widget 由 PM 自己渲染——
 * 外部直接改 PM 管理的块元素（inline style / data 属性）会被 PM 的
 * DOMObserver 检测并强制重绘抹掉，widget 则由 PM 管理，稳定可靠。
 *
 * 布局算法：
 * 1. 测量块级几何（剔除页间空白 widget，并扣除其高度，还原「自然排版」位置）；
 * 2. planPageBlocks 规划分页起始块（与导出 PDF/Word 同一套算法）；
 * 3. 在起始块前插入 52mm（40mm 页边距补偿 + 12mm 纸间留白）的块级空白 widget；
 * 4. 把每页对齐到一张真实 A4 纸面（210mm × 297mm）。
 */

/** CSS 规范：1in = 96px，1mm = 96/25.4px */
const MM_TO_PX = 96 / 25.4;
/** A4 纸高 297mm；内容区高 = 297 - 20*2 = 257mm */
export const PAGE_HEIGHT_PX = 297 * MM_TO_PX;
export const PAGE_CONTENT_PX = 257 * MM_TO_PX;
/** 页间空白 = 页边距补偿 40mm + 纸间留白 12mm */
export const PAGE_GAP_PX = PAGE_HEIGHT_PX - PAGE_CONTENT_PX + 12 * MM_TO_PX;

const pageLayoutKey = new PluginKey<PageLayoutState>('richTextPageLayout');

interface PageLayoutState {
  /** 分页起始块的文档位置 */
  positions: number[];
  /** 对应页间空白 widget 的高度（px） */
  heights: number[];
  deco: DecorationSet;
}

/** 相邻两页纸的固定间距 = 纸间留白 12mm */
const SHEET_GAP_PX = 12 * MM_TO_PX;
/** 相邻两页页首块自然位置之差的期望值 = 纸高 + 纸间留白 */
const PAGE_ADVANCE_PX = PAGE_HEIGHT_PX + SHEET_GAP_PX;

function isGapElement(el: Element): boolean {
  return el.hasAttribute('data-page-gap');
}

/** 显式分页符节点：其后的第一个可见块必须另起一页（与打印时 break-after: page 对齐） */
function isPageBreakElement(el: Element): boolean {
  return el.hasAttribute('data-page-break') || el.classList.contains('rte-page-break-node');
}

/**
 * 规划分页：先按页高分配块，再补上显式分页符强制的换页点。
 * 屏幕与打印两条路径必须共用它，否则同一份文档会出现两种分页。
 */
function planPageStarts(
  elements: Element[],
  items: { top: number; height: number }[],
  pageHeight: number,
): number[] {
  const starts = new Set(planPageBlocks(items, pageHeight));
  elements.forEach((el, index) => {
    if (!isPageBreakElement(el)) return;
    // 分页符之后的第一个非空块另起一页
    for (let next = index + 1; next < elements.length; next += 1) {
      if (items[next].height > 0) {
        starts.add(next);
        break;
      }
    }
  });
  return [...starts].sort((a, b) => a - b);
}

function makeGapElement(height: number): HTMLElement {
  const el = document.createElement('span');
  el.className = 'rte-page-gap';
  el.style.height = `${Math.round(height * 10) / 10}px`;
  el.setAttribute('data-page-gap', 'true');
  el.setAttribute('aria-hidden', 'true');
  el.contentEditable = 'false';
  return el;
}

function buildDecorations(doc: PMNode, positions: number[], heights: number[]): DecorationSet {
  const widgets = positions.map((pos, i) =>
    Decoration.widget(pos, () => makeGapElement(heights[i] ?? PAGE_GAP_PX), { side: -1 }),
  );
  return DecorationSet.create(doc, widgets);
}

/**
 * 测量并规划分页。返回 null 表示已收敛（无需 dispatch）。
 * widget 高度按需计算：让每页首块恰好落在 k × (纸高 + 留白) 的自然位置上——
 * 短页（显式分页符等）自动加高空白，保证纸面间距恒定、永不重叠。
 */
function planLayout(view: EditorView): { positions: number[]; heights: number[] } | null {
  const state = pageLayoutKey.getState(view.state) ?? {
    positions: [],
    heights: [],
    deco: DecorationSet.empty,
  };
  const paged = view.dom.closest('.rte-paged') !== null;
  if (!paged) {
    return state.positions.length > 0 ? { positions: [], heights: [] } : null;
  }
  // 读取块几何（用 rect 取亚像素值，避免 offsetTop 取整逐块累积误差）：
  // widget 高度从自然位置中扣除，保证规划输入与打印路径完全一致
  const domTop = view.dom.getBoundingClientRect().top;
  let gapPx = 0;
  const elements: HTMLElement[] = [];
  const items: { top: number; height: number }[] = [];
  Array.from(view.dom.children).forEach((node) => {
    const el = node as HTMLElement;
    const rect = el.getBoundingClientRect();
    if (isGapElement(el)) {
      gapPx += rect.height;
      return;
    }
    elements.push(el);
    items.push({ top: rect.top - domTop - gapPx, height: rect.height });
  });
  const starts = planPageStarts(elements, items, PAGE_CONTENT_PX);

  // 块索引 → 文档位置 + 每个页间空白的高度
  const positions: number[] = [];
  const heights: number[] = [];
  let prevNaturalTop = 0;
  let index = 0;
  view.state.doc.forEach((_, offset) => {
    if (starts.includes(index)) {
      positions.push(offset);
      heights.push(Math.max(SHEET_GAP_PX, PAGE_ADVANCE_PX - (items[index].top - prevNaturalTop)));
      prevNaturalTop = items[index].top;
    }
    index += 1;
  });
  // 收敛判断必须校验装饰本身仍在（整篇 setContent 等事务会把 decoration 映射成空集，
  // 若只比较位置会误判「已收敛」而死锁）
  const decoCount = state.deco.find().length;
  if (
    positions.length === state.positions.length &&
    positions.every((pos, i) => pos === state.positions[i]) &&
    heights.every((h, i) => Math.abs(h - (state.heights[i] ?? 0)) < 1) &&
    decoCount === positions.length
  ) {
    return null; // 已收敛，避免 dispatch 风暴
  }
  return { positions, heights };
}

/** 每页纸面的 top（wrapper 坐标）：解析式，恒定间距 */
function sheetTopsFor(count: number): number[] {
  return Array.from({ length: count }, (_, i) => i * PAGE_ADVANCE_PX);
}

/**
 * 页面布局插件：仅在 .rte-paged 容器内生效。
 * onSheetTops 把每页纸面位置回调给 React（渲染纸面层）。
 */
export function createPageLayoutPlugin(
  onSheetTops: (tops: number[]) => void,
): Plugin<PageLayoutState> {
  let raf = 0;
  let fontTimer = 0;

  const measure = (view: EditorView) => {
    const plan = planLayout(view);
    if (plan) {
      const { positions, heights } = plan;
      // 延迟到宏任务后 dispatch，避免在 PM update 流程内同步 dispatch
      setTimeout(() => {
        const current =
          pageLayoutKey.getState(view.state) ??
          ({ positions: [], heights: [], deco: DecorationSet.empty } satisfies PageLayoutState);
        // 装饰可能因文档事务（setContent 等）被映射丢失，此时即使分页点没变也必须重建，
        // 否则页面视图会退化成"没有页间空白"的连续排版
        const decoLost = current.deco.find().length !== positions.length;
        const changed =
          decoLost ||
          current.positions.length !== positions.length ||
          current.positions.some((pos, i) => pos !== positions[i]) ||
          current.heights.some((h, i) => Math.abs(h - (heights[i] ?? 0)) >= 1);
        if (changed) {
          view.dispatch(view.state.tr.setMeta(pageLayoutKey, { positions, heights }));
        }
      }, 0);
    }
    const state = pageLayoutKey.getState(view.state);
    const pageCount = (plan ? plan.positions.length : (state?.positions.length ?? 0)) + 1;
    onSheetTops(sheetTopsFor(pageCount));
  };
  const schedule = (view: EditorView) => {
    cancelAnimationFrame(raf);
    raf = requestAnimationFrame(() => measure(view));
  };

  return new Plugin<PageLayoutState>({
    key: pageLayoutKey,
    state: {
      init: () => ({ positions: [], heights: [], deco: DecorationSet.empty }),
      apply: (tr: Transaction, value) => {
        const meta = tr.getMeta(pageLayoutKey) as
          { positions: number[]; heights: number[] } | undefined;
        if (meta) {
          return {
            positions: meta.positions,
            heights: meta.heights,
            deco: buildDecorations(tr.doc, meta.positions, meta.heights),
          };
        }
        if (!tr.docChanged) return value;
        return { ...value, deco: value.deco.map(tr.mapping, tr.doc) };
      },
    },
    props: {
      decorations: (state) => pageLayoutKey.getState(state)?.deco ?? DecorationSet.empty,
    },
    view: (view) => {
      const onResize = () => schedule(view);
      schedule(view);
      // 字体/图片异步加载完成后再校准
      fontTimer = window.setTimeout(onResize, 400);
      window.addEventListener('resize', onResize);
      return {
        update: (nextView) => schedule(nextView),
        destroy: () => {
          cancelAnimationFrame(raf);
          clearTimeout(fontTimer);
          window.removeEventListener('resize', onResize);
        },
      };
    },
  });
}

/**
 * 打印路径专用（非 PM 管理 DOM）：给打印流打上与屏幕页面视图完全相同的块级分页标记，
 * 配合 CSS `break-before: page` 实现所见即所得。
 *
 * 只做标记、不改 margin：Chrome 在强制断页处**不会**截断 margin-top，
 * 一旦用 margin 把块"顶"到目标位置，打印预览就会多出空白页或整段下移，
 * 与屏幕分页明显不一致。
 */
export function applyPagedBreaks(dom: HTMLElement): void {
  const children = Array.from(dom.children) as HTMLElement[];
  children.forEach((el) => {
    el.style.marginTop = '';
    el.removeAttribute('data-page-start');
  });
  if (children.length === 0) return;
  // 归一化到内容原点（打印流的 offsetParent 未必是容器本身）
  const base = children[0].getBoundingClientRect().top;
  const items = children.map((el) => {
    const rect = el.getBoundingClientRect();
    return { top: rect.top - base, height: rect.height };
  });
  const starts = planPageStarts(children, items, PAGE_CONTENT_PX);
  starts.forEach((index) => {
    children[index].setAttribute('data-page-start', 'true');
  });
}
