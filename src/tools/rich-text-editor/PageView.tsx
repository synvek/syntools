import { Plugin, PluginKey } from '@tiptap/pm/state';
import type { Node as PMNode } from '@tiptap/pm/model';
import type { EditorState, Transaction } from '@tiptap/pm/state';
import { Decoration, DecorationSet } from '@tiptap/pm/view';
import type { EditorView } from '@tiptap/pm/view';
import { countPages, pageIndexOfPosition } from './core';
import { isFloatingImageElement } from './imageLayer';
import { MM_TO_PX, SHEET_GAP_MM, pageMetricsToPx, type PageMetrics } from './pageSetup';
import { planSectionedPageBlocks, sectionBoxFromElement, type SectionBox } from './sections';

/**
 * Word-style paged editing view (the canonical ProseMirror approach):
 *
 * The document remains a single PM document; inter-page gaps are rendered by PM itself via
 * Decoration.widget — editing PM-managed block elements (inline style / data attributes) from the
 * outside gets wiped out by PM's DOMObserver, whereas widgets are owned by PM and stay reliable.
 *
 * Layout algorithm:
 * 1. Measure block geometry (skip gap widgets and subtract their heights to recover "natural" positions);
 * 2. planPageBlocks picks the page-start blocks (same algorithm as PDF/Word export);
 * 3. Insert a 52mm block-level gap widget before each page start (40mm margin compensation + 12mm inter-sheet gap);
 * 4. Align each page to a real A4 sheet (210mm x 297mm).
 */

/** Default page height (A4 portrait), fallback when page setup isn't wired in */
export const PAGE_HEIGHT_PX = 297 * MM_TO_PX;

const pageLayoutKey = new PluginKey<PageLayoutState>('richTextPageLayout');

/** Current page geometry (mm) -> pixels, following page setup changes */
export type PageMetricsGetter = () => PageMetrics;

/**
 * Page-number query contract: consumers that need "document position -> page number" (e.g. the TOC)
 * all go through it. The source is the pagination plugin's state (page-start doc positions), so a
 * query is a snapshot of the current state — callers just re-query after the state changes.
 */
export interface PageLayoutQuery {
  /** Document position -> page number (1-based; always 1 when not paginated) */
  pageIndexOfPos(pos: number): number;
  /** Total page count */
  pageCount(): number;
  /** Whether pagination info exists (the flow view has no page numbers) */
  paginated: boolean;
}

/** Create a page-number query from the current editor state (binary search, safe to call on every render) */
export function createPageLayoutQuery(state: EditorState): PageLayoutQuery {
  const positions = pageLayoutKey.getState(state)?.positions ?? [];
  return {
    pageIndexOfPos: (pos: number) => pageIndexOfPosition(positions, pos),
    pageCount: () => countPages(positions),
    paginated: positions.length > 0,
  };
}

/** Read the view zoom factor (CSS zoom): rects scale with zoom, so measurements must be converted back to CSS px */
function readZoomScale(view: EditorView): number {
  const host = view.dom.closest('[data-rte-zoom]');
  const raw = Number.parseFloat(host?.getAttribute('data-rte-zoom') ?? '1');
  return Number.isFinite(raw) && raw > 0 ? raw : 1;
}

interface PageLayoutState {
  /** Document positions of the page-start blocks */
  positions: number[];
  /** Heights of the corresponding gap widgets (px) */
  heights: number[];
  deco: DecorationSet;
}

/** Fixed spacing between adjacent sheets = 12mm sheet gap (px) */
const SHEET_GAP_PX = SHEET_GAP_MM * MM_TO_PX;

function isGapElement(el: Element): boolean {
  return el.hasAttribute('data-page-gap');
}

/** Explicit page break node: the first visible block after it must start a new page (matching break-after: page when printing) */
function isPageBreakElement(el: Element): boolean {
  return el.hasAttribute('data-page-break') || el.classList.contains('rte-page-break-node');
}

/** Section break node: starts a new section; its page setup snapshot gives that section's usable height */
function isSectionBreakElement(el: Element): boolean {
  return el.hasAttribute('data-section-break');
}

function sectionBoxOf(el: Element, fallback: SectionBox): SectionBox {
  return sectionBoxFromElement(el, fallback);
}

/**
 * Plan pagination: distribute blocks by the height available **in their section**, then add the breaks
 * forced by explicit page break nodes. The screen, print and snapshot paths must share this, otherwise
 * one document paginates two ways (the snapshot PDF reuses it on the print flow's DOM).
 */
export function planPageStarts(
  elements: Element[],
  items: { top: number; height: number }[],
  pageHeight: number,
): number[] {
  const boxes: SectionBox[] = [
    { contentHeight: pageHeight, advancePx: pageHeight, startType: 'nextPage' },
  ];
  const sectionOf = new Array<number>(elements.length).fill(0);
  let section = 0;
  elements.forEach((el, index) => {
    if (isSectionBreakElement(el)) {
      boxes.push(sectionBoxOf(el, boxes[0]));
      section = boxes.length - 1;
    }
    sectionOf[index] = section;
  });
  const blocks = items.map((item, index) => ({ ...item, section: sectionOf[index] ?? 0 }));
  const starts = new Set(planSectionedPageBlocks(blocks, boxes));
  elements.forEach((el, index) => {
    if (!isPageBreakElement(el)) return;
    // The first non-empty block after a page break starts a new page
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

function buildDecorations(
  doc: PMNode,
  positions: number[],
  heights: number[],
  fallbackGap: number,
): DecorationSet {
  const widgets = positions.map((pos, i) =>
    Decoration.widget(pos, () => makeGapElement(heights[i] ?? fallbackGap), { side: -1 }),
  );
  return DecorationSet.create(doc, widgets);
}

/**
 * Measure and plan pagination. Returns null when already converged (no dispatch needed).
 * Widget heights are computed as needed so each page's first block lands exactly at the natural
 * position k × (page height + gap) — short pages (explicit breaks, etc.) get taller gaps
 * automatically, keeping the sheet spacing constant and sheets from ever overlapping.
 */
function planLayout(
  view: EditorView,
  metrics: PageMetrics,
): { positions: number[]; heights: number[] } | null {
  const state = pageLayoutKey.getState(view.state) ?? {
    positions: [],
    heights: [],
    deco: DecorationSet.empty,
  };
  const paged = view.dom.closest('.rte-paged') !== null;
  if (!paged) {
    return state.positions.length > 0 ? { positions: [], heights: [] } : null;
  }
  const px = pageMetricsToPx(metrics);
  const scale = readZoomScale(view);
  // Read block geometry (use rects for sub-pixel values, avoiding per-block rounding drift from offsetTop):
  // 1) divide by the zoom factor to recover CSS px; 2) subtract gap heights to recover natural positions
  const domTop = view.dom.getBoundingClientRect().top;
  let gapPx = 0;
  const elements: HTMLElement[] = [];
  const items: { top: number; height: number }[] = [];
  Array.from(view.dom.children).forEach((node) => {
    const el = node as HTMLElement;
    const rect = el.getBoundingClientRect();
    const height = rect.height / scale;
    if (isGapElement(el)) {
      gapPx += height;
      return;
    }
    elements.push(el);
    // Floating images (in front of / behind text) are out of the text flow: count them as zero height,
    // otherwise their absolute position is mistaken for a block spilling across pages and extra gaps appear.
    if (isFloatingImageElement(el)) {
      items.push({ top: 0, height: 0 });
      return;
    }
    // A section break is a marker, not content: the forced page start must land on the next visible block
    if (isSectionBreakElement(el)) {
      items.push({ top: (rect.top - domTop) / scale - gapPx, height: 0 });
      return;
    }
    items.push({ top: (rect.top - domTop) / scale - gapPx, height });
  });
  const starts = planPageStarts(elements, items, px.contentHeightPx);

  // Block index -> document position + height of each gap widget
  const positions: number[] = [];
  const heights: number[] = [];
  let prevNaturalTop = 0;
  let index = 0;
  view.state.doc.forEach((_, offset) => {
    if (starts.includes(index)) {
      positions.push(offset);
      heights.push(Math.max(SHEET_GAP_PX, px.advancePx - (items[index].top - prevNaturalTop)));
      prevNaturalTop = items[index].top;
    }
    index += 1;
  });
  // The convergence check must verify the decorations still exist (a whole-document setContent maps
  // decorations to an empty set; comparing positions alone would falsely report convergence and deadlock)
  const decoCount = state.deco.find().length;
  if (
    positions.length === state.positions.length &&
    positions.every((pos, i) => pos === state.positions[i]) &&
    heights.every((h, i) => Math.abs(h - (state.heights[i] ?? 0)) < 1) &&
    decoCount === positions.length
  ) {
    return null; // Converged: avoid a dispatch storm
  }
  return { positions, heights };
}

/** Top of each sheet (wrapper coordinates): closed-form, constant spacing */
function sheetTopsFor(count: number, metrics: PageMetrics): number[] {
  const px = pageMetricsToPx(metrics);
  return Array.from({ length: count }, (_, i) => i * px.advancePx);
}

/**
 * Pagination snapshot: hands both the sheet positions and each page's start position to React.
 * The latter is what the TOC uses to compute real page numbers (page numbers exist only in the plugin state).
 */
export interface PageLayoutSnapshot {
  /** Top of each sheet (px, wrapper coordinates, constant spacing) */
  sheetTops: number[];
  /** Document position of each page's start block (ascending, including the implicit start of page 1) */
  pageStarts: number[];
}

/**
 * `performance.measure` name of one pagination pass (measure + plan). The e2e perf case reads these
 * entries to assert the §3.2.4 budget (a 50-page document must re-paginate in < 50ms per pass); keeping
 * it as a real measure entry beats a hidden dev-only counter, and the overhead is negligible next to the
 * block measurement itself.
 */
export const PAGE_LAYOUT_MEASURE = 'rte-page-layout';

/**
 * Page layout plugin: only active inside a .rte-paged container.
 * onLayout hands the pagination snapshot to React (to render sheets + TOC page numbers).
 * getMetrics supplies the current page setup (size/margins/orientation); changes trigger a re-layout.
 */
export function createPageLayoutPlugin(
  onLayout: (snapshot: PageLayoutSnapshot) => void,
  getMetrics: PageMetricsGetter,
): Plugin<PageLayoutState> {
  let raf = 0;
  let fontTimer = 0;

  const measure = (view: EditorView) => {
    const metrics = getMetrics();
    const startedAt = performance.now();
    const plan = planLayout(view, metrics);
    try {
      performance.measure(PAGE_LAYOUT_MEASURE, { start: startedAt, end: performance.now() });
    } catch {
      // Older engines / jsdom lack the options form: the timing is diagnostic only, never load-bearing
    }
    if (plan) {
      const { positions, heights } = plan;
      // Dispatch on a later macrotask, avoiding a synchronous dispatch inside PM's update cycle
      setTimeout(() => {
        const current =
          pageLayoutKey.getState(view.state) ??
          ({ positions: [], heights: [], deco: DecorationSet.empty } satisfies PageLayoutState);
        // Decorations can be lost through document transactions (setContent, etc.); then they must be
        // rebuilt even if the page breaks didn't change, otherwise the page view degrades into
        // continuous layout without inter-page gaps
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
    const pageStarts = plan ? plan.positions : (state?.positions ?? []);
    const pageCount = pageStarts.length + 1;
    onLayout({ sheetTops: sheetTopsFor(pageCount, metrics), pageStarts });
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
            deco: buildDecorations(
              tr.doc,
              meta.positions,
              meta.heights,
              pageMetricsToPx(getMetrics()).gapPx,
            ),
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
      // Re-calibrate after fonts/images finish loading asynchronously
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
 * Print path only (DOM not managed by PM): tag the print flow with the same block pagination markers
 * as the on-screen page view, using CSS `break-before: page` for WYSIWYG.
 *
 * Mark only, never touch margins: Chrome does NOT truncate margin-top at a forced break, so pushing
 * blocks into position with margins makes the print preview add blank pages or shift everything down,
 * visibly diverging from on-screen pagination.
 */
export function applyPagedBreaks(dom: HTMLElement, metrics: PageMetrics): void {
  const children = Array.from(dom.children) as HTMLElement[];
  children.forEach((el) => {
    el.style.marginTop = '';
    el.removeAttribute('data-page-start');
  });
  if (children.length === 0) return;
  // Normalize to the content origin (the print flow's offsetParent isn't necessarily the container).
  // Take the first block "in the text flow" as the origin: floating images are absolutely positioned.
  const flowChild = children.find((el) => !isFloatingImageElement(el)) ?? children[0];
  const base = flowChild.getBoundingClientRect().top;
  const items = children.map((el) => {
    // Floating images are out of the text flow: count them as zero height and exclude them from print pagination
    if (isFloatingImageElement(el)) return { top: 0, height: 0 };
    const rect = el.getBoundingClientRect();
    // A section break keeps its space but must not be the block that starts a page (same rule as the
    // on-screen measurement, otherwise the print and screen paths paginate differently)
    return { top: rect.top - base, height: isSectionBreakElement(el) ? 0 : rect.height };
  });
  const starts = planPageStarts(children, items, pageMetricsToPx(metrics).contentHeightPx);
  starts.forEach((index) => {
    children[index].setAttribute('data-page-start', 'true');
  });
}
