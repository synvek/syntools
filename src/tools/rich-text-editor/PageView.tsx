import { Plugin, PluginKey } from '@tiptap/pm/state';
import type { Node as PMNode } from '@tiptap/pm/model';
import type { EditorState, Transaction } from '@tiptap/pm/state';
import { Decoration, DecorationSet } from '@tiptap/pm/view';
import type { EditorView } from '@tiptap/pm/view';
import { countPages, pageIndexOfPosition } from './core';
import { isFloatingImageElement } from './imageLayer';
import { isIncrementalLayoutEnabled } from './layoutFlag';
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
 *    the incremental path (P1-5) re-reads only the blocks the transaction touched and reuses the rest;
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
  /** Bumped by `forcePageRelayout`: lets the plugin re-run for a non-document change (page setup, zoom) */
  token: number;
}

/**
 * Ask for a pagination pass although the document did not change.
 *
 * Page setup / zoom live outside ProseMirror, so no transaction carries them; a plain dispatch used to
 * be enough when every transaction re-paginated. With the `docChanged` gate this explicit signal is
 * what keeps "change paper size → pages re-flow" working.
 */
export function forcePageRelayout(view: EditorView): void {
  view.dispatch(view.state.tr.setMeta(pageLayoutKey, { force: true }));
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

/** A block's geometry in natural coordinates: CSS px, zoom-corrected, gap widgets subtracted */
interface BlockGeometry {
  top: number;
  height: number;
}

/**
 * Block geometry from the previous pass, so an incremental pass can skip the blocks the edit cannot
 * have moved. Validity is a cheap signature — page geometry, zoom, container width and the block
 * elements themselves; width / zoom / page-setup changes rewrap every line, so those paths clear the
 * cache and the signature check is only the backstop.
 */
interface BlockLayoutCache {
  doc: PMNode;
  /** Page geometry (usable height, sheet advance, fallback gap) the geometry was measured against */
  metricsKey: string;
  scale: number;
  /** Container width in CSS px: a width change rewraps every line */
  width: number;
  elements: HTMLElement[];
  items: BlockGeometry[];
}

/** Owns the cache across passes (one plugin instance is the lifetime of one paginated view) */
interface BlockLayoutCacheStore {
  current: BlockLayoutCache | null;
}

/** Inclusive top-level block range touched by a document change; `all` when the block count changed */
export type DirtyBlocks = { first: number; last: number } | 'all';

/** Tolerance for "unchanged position" — sub-pixel layout noise stays below one CSS px */
const GEOMETRY_EPS = 1;

/**
 * Locate the top-level blocks a document change touched, by walking both documents' children.
 *
 * `Node.eq` hits reference equality first for untouched children (ProseMirror keeps the node when a
 * transaction maps a fragment), so the walk costs one pointer comparison per block. A position-based
 * diff (`findDiffStart`) is deliberately not used: it compares text only, so "bold applied to a
 * selection" — no text change, but every line of the range rewraps — would look unchanged.
 */
export function dirtyBlockRange(prev: PMNode, next: PMNode): DirtyBlocks {
  if (prev.childCount !== next.childCount) return 'all';
  let first = -1;
  let last = -1;
  for (let index = 0; index < next.childCount; index += 1) {
    if (prev.child(index).eq(next.child(index))) continue;
    if (first < 0) first = index;
    last = index;
  }
  // Same blocks but a different document (doc-level attributes only): nothing reusable piecewise
  return first < 0 ? 'all' : { first, last };
}

/**
 * Blocks an incremental pass has to read: the changed range widened by one block on each side — the
 * block before it proves nothing above moved, the block after it carries the shift of everything
 * below — plus the last block, which probes "no block outside the range resized".
 */
function incrementalProbes(count: number, range: { first: number; last: number }): number[] {
  const probes: number[] = [];
  const to = Math.min(count - 1, range.last + 1);
  for (let index = Math.max(0, range.first - 1); index <= to; index += 1) probes.push(index);
  if (to < count - 1) probes.push(count - 1);
  return probes;
}

/**
 * Rebuild block geometry from the cached pass plus a sparse re-measure of `measured`.
 *
 * Only the changed range is re-read. Blocks before it cannot have moved; blocks after it move by the
 * height delta the change introduced (reflow pushes a block down, it does not resize the blocks below
 * it), which the first block after the range carries exactly. Two guards keep the assumptions honest:
 * the block *before* the range must still sit where it did (otherwise something above changed — a late
 * font or image load), and the last block must land where the shift predicts (otherwise a block
 * outside the range resized). Either mismatch returns null, which forces a full measure.
 */
export function incrementalItems(
  cached: readonly BlockGeometry[],
  measured: ReadonlyMap<number, BlockGeometry>,
  range: { first: number; last: number },
): BlockGeometry[] | null {
  const count = cached.length;
  if (count === 0) return null;
  const items = cached.slice();
  const first = Math.max(0, range.first);
  if (first > 0) {
    const guard = measured.get(first - 1);
    const base = cached[first - 1];
    if (
      !guard ||
      Math.abs(guard.top - base.top) > GEOMETRY_EPS ||
      Math.abs(guard.height - base.height) > GEOMETRY_EPS
    ) {
      return null;
    }
  }
  const last = Math.min(range.last, count - 1);
  for (let index = first; index <= last; index += 1) {
    const next = measured.get(index);
    if (!next) return null;
    items[index] = next;
  }
  if (last === count - 1) return items;
  // The first block after the change carries the shift of everything below it
  const anchor = measured.get(last + 1);
  if (!anchor) return null;
  items[last + 1] = anchor;
  const shift = anchor.top - cached[last + 1].top;
  for (let index = last + 2; index < count; index += 1) {
    items[index] = { top: cached[index].top + shift, height: cached[index].height };
  }
  const tail = count - 1;
  if (tail > last + 1) {
    const probe = measured.get(tail);
    if (!probe || Math.abs(probe.top - (cached[tail].top + shift)) > GEOMETRY_EPS) return null;
  }
  return items;
}

/**
 * Read one block's geometry: zoom-corrected (rects scale with the CSS zoom) and with the gap widgets
 * above it subtracted, so page planning never sees our own gaps.
 */
function measureBlockAt(
  el: HTMLElement,
  gapAbove: number,
  scale: number,
  domTop: number,
): BlockGeometry {
  const rect = el.getBoundingClientRect();
  // Floating images (in front of / behind text) are out of the text flow: count them as zero height,
  // otherwise their absolute position is mistaken for a block spilling across pages and extra gaps appear.
  if (isFloatingImageElement(el)) return { top: 0, height: 0 };
  const top = (rect.top - domTop) / scale - gapAbove;
  // A section break is a marker, not content: the forced page start must land on the next visible block
  if (isSectionBreakElement(el)) return { top, height: 0 };
  return { top, height: rect.height / scale };
}

/**
 * Collect the block children of the editing surface plus how many gap pixels sit above each of them.
 * Only the gap widgets are read here; block geometry is read separately (see `blockGeometry`) so an
 * incremental pass can read a handful of blocks instead of all of them.
 */
function collectBlocks(
  view: EditorView,
  scale: number,
): { elements: HTMLElement[]; gapBefore: number[]; gaps: number } {
  const elements: HTMLElement[] = [];
  const gapBefore: number[] = [];
  let gapPx = 0;
  let gaps = 0;
  Array.from(view.dom.children).forEach((node) => {
    const el = node as HTMLElement;
    if (isGapElement(el)) {
      gaps += 1;
      gapPx += el.getBoundingClientRect().height / scale;
      return;
    }
    elements.push(el);
    gapBefore.push(gapPx);
  });
  return { elements, gapBefore, gaps };
}

/** The cached pass, when it is still valid for this page geometry, zoom, width and block list */
function reusableCache(
  cache: BlockLayoutCacheStore,
  elements: readonly HTMLElement[],
  box: { metricsKey: string; scale: number; width: number },
): BlockLayoutCache | null {
  const cached = cache.current;
  if (!cached) return null;
  if (cached.metricsKey !== box.metricsKey) return null;
  if (cached.scale !== box.scale) return null;
  if (Math.abs(cached.width - box.width) >= 0.5) return null;
  if (cached.elements.length !== elements.length) return null;
  if (cached.elements.some((el, index) => el !== elements[index])) return null;
  return cached;
}

/**
 * Block geometry for this pass: the full measure (every block read) or, with the incremental flag on,
 * the cached geometry refreshed only for the blocks the last transaction touched.
 */
function blockGeometry(
  view: EditorView,
  elements: HTMLElement[],
  gapBefore: number[],
  box: { metricsKey: string; scale: number; width: number; domTop: number },
  cache: BlockLayoutCacheStore,
  gapsTrusted: boolean,
): BlockGeometry[] {
  const measureAll = (): BlockGeometry[] =>
    elements.map((el, index) => measureBlockAt(el, gapBefore[index], box.scale, box.domTop));

  const cached = reusableCache(cache, elements, box);
  // Same document, same signature and consistent gaps: the cached geometry is still exact
  if (cached && gapsTrusted && cached.doc === view.state.doc) return cached.items;

  let items: BlockGeometry[] | null = null;
  if (cached && gapsTrusted && isIncrementalLayoutEnabled()) {
    const range = dirtyBlockRange(cached.doc, view.state.doc);
    if (range !== 'all') {
      const measured = new Map<number, BlockGeometry>();
      incrementalProbes(elements.length, range).forEach((index) => {
        measured.set(
          index,
          measureBlockAt(elements[index], gapBefore[index], box.scale, box.domTop),
        );
      });
      items = incrementalItems(cached.items, measured, range);
    }
  }
  if (!items) items = measureAll();
  cache.current = {
    doc: view.state.doc,
    metricsKey: box.metricsKey,
    scale: box.scale,
    width: box.width,
    elements,
    items,
  };
  return items;
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
  cache: BlockLayoutCacheStore,
): { positions: number[]; heights: number[] } | null {
  const state = pageLayoutKey.getState(view.state) ?? {
    positions: [],
    heights: [],
    deco: DecorationSet.empty,
    token: 0,
  };
  const paged = view.dom.closest('.rte-paged') !== null;
  if (!paged) {
    cache.current = null;
    return state.positions.length > 0 ? { positions: [], heights: [] } : null;
  }
  const px = pageMetricsToPx(metrics);
  const scale = readZoomScale(view);
  // Use rects (not offsetTop) for sub-pixel values: the natural position of a block is its box top
  // divided by the zoom factor, minus the gap widgets above it.
  const domRect = view.dom.getBoundingClientRect();
  // The convergence check must verify the decorations still exist (a whole-document setContent maps
  // decorations to an empty set; comparing positions alone would falsely report convergence and deadlock)
  const decoCount = state.deco.find().length;
  const { elements, gapBefore, gaps } = collectBlocks(view, scale);
  // Gap widgets are placed on block boundaries, so the surface holds exactly one per decoration.
  // A mismatch means one was rendered *inside* a block (a stale page start), which inflates that
  // block's box and shifts every natural position below it: cached geometry is useless then.
  const gapsTrusted = gaps === decoCount;
  const items = blockGeometry(
    view,
    elements,
    gapBefore,
    {
      metricsKey: `${px.contentHeightPx}|${px.advancePx}|${px.gapPx}`,
      scale,
      width: domRect.width / scale,
      domTop: domRect.top,
    },
    cache,
    gapsTrusted,
  );
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
  // Block geometry carried between passes for the incremental path (P1-5)
  const cache: BlockLayoutCacheStore = { current: null };

  const measure = (view: EditorView) => {
    const metrics = getMetrics();
    const startedAt = performance.now();
    const plan = planLayout(view, metrics, cache);
    try {
      performance.measure(PAGE_LAYOUT_MEASURE, { start: startedAt, end: performance.now() });
    } catch {
      // Older engines / jsdom lack the options form: the timing is diagnostic only, never load-bearing
    }
    if (plan) {
      const { positions, heights } = plan;
      // The plan belongs to the document it was measured on. A keystroke landing in the macrotask gap
      // below shifts every later page start by one position; dispatching them then puts the gap widget
      // *inside* the preceding paragraph (`<p><span data-page-gap>`, which inflates that block by a page
      // gap and corrupts every natural position below it). Drop the plan instead: the next pass, which
      // the keystroke already scheduled, measures the new document.
      const plannedDoc = view.state.doc;
      // Dispatch on a later macrotask, avoiding a synchronous dispatch inside PM's update cycle
      setTimeout(() => {
        if (view.state.doc !== plannedDoc) return;
        const current =
          pageLayoutKey.getState(view.state) ??
          ({
            positions: [],
            heights: [],
            deco: DecorationSet.empty,
            token: 0,
          } satisfies PageLayoutState);
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
      init: () => ({ positions: [], heights: [], deco: DecorationSet.empty, token: 0 }),
      apply: (tr: Transaction, value) => {
        const meta = tr.getMeta(pageLayoutKey) as
          { positions: number[]; heights: number[] } | { force: true } | undefined;
        if (meta && 'force' in meta) return { ...value, token: value.token + 1 };
        if (meta) {
          return {
            positions: meta.positions,
            heights: meta.heights,
            token: value.token,
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
      // Everything that can rewrap the whole document without a document change (resize, zoom, page
      // setup, a late font/image load) must drop the cached block geometry as well.
      const invalidate = (target: EditorView) => {
        cache.current = null;
        schedule(target);
      };
      const onResize = () => invalidate(view);
      schedule(view);
      // Re-calibrate after fonts/images finish loading asynchronously
      fontTimer = window.setTimeout(onResize, 400);
      window.addEventListener('resize', onResize);
      return {
        // Re-paginate only when the document instance changed. A caret move, a selection drag or a
        // decoration-only transaction cannot move blocks, yet scheduling on them re-measured every
        // block of the document (2100+ getBoundingClientRect calls per keystroke in a 200-page file).
        // Metric / resize / font-load changes have their own paths (resize listener + plugin re-init).
        update: (nextView, prevState) => {
          if (nextView.state.doc !== prevState.doc) {
            schedule(nextView);
            return;
          }
          // Page setup / zoom changes carry no document transaction: they bump the token instead
          const nextToken = pageLayoutKey.getState(nextView.state)?.token ?? 0;
          const prevToken = pageLayoutKey.getState(prevState)?.token ?? 0;
          if (nextToken !== prevToken) invalidate(nextView);
        },
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
