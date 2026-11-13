import { Extension, Node, type Editor } from '@tiptap/core';
import type { Node as PmNode, Slice } from '@tiptap/pm/model';
import { Plugin, PluginKey, type Transaction } from '@tiptap/pm/state';
import { Decoration, DecorationSet, type EditorView } from '@tiptap/pm/view';

/**
 * 制表位（tab stop，P1-4 最后一片）。
 *
 * Word stores tab stops in `w:pPr/w:tabs` and moves the caret to the next stop when Tab is pressed.
 * Browsers cannot express an arbitrary stop list in CSS (`tab-size` is one uniform interval), so the
 * problem is split in two:
 * - the *stop list* is a per-paragraph attribute (`TabStop[]` → `data-tab-stops="96:left,192:right"`),
 *   exchanged with `.docx` as `w:tabs`;
 * - the *tab itself* is an inline atom (`<span data-rte-tab>`), **not** a `\t` character: ProseMirror's
 *   HTML parser normalises whitespace, so a literal tab in the document turns into a space on the next
 *   `setContent` (draft reload, `.docx` import) and the alignment would silently disappear. An element
 *   survives every path and is also what the `.docx` writer turns into `<w:tab/>`.
 *
 * Rendering: without custom stops the atom steps on the browser's own grid (`tab-size` via CSS
 * `::before`), so editor, page view and print agree. With custom stops a decoration gives the atom an
 * explicit advance measured from the laid-out line — the only way to honour an arbitrary position
 * inside a contenteditable. Those widths are decorations, so they reach the page view (same DOM) but
 * not the print / snapshot-PDF flow, which renders `getHTML()`; that is registered as a plan deviation.
 */

/** Word's default tab interval: 0.5in at 96dpi (= 720 twips). Must match `editor.css`'s `tab-size` */
export const DEFAULT_TAB_STOP_PX = 48;
/** `data-tab-stops` wire format: `96:left,192:right` */
export const TAB_STOPS_ATTR = 'data-tab-stops';
/** Marks the inline tab atom in HTML (drafts, exports, `.docx` import) */
export const TAB_ATTR = 'data-rte-tab';
/** Guard rail: a longer stop list is a paste accident, not a layout decision */
export const MAX_TAB_STOPS = 32;
const MAX_TAB_STOP_PX = 4096;

export type TabStopAlign = 'left' | 'center' | 'right' | 'decimal';

/** `w:leader` — what fills the gap up to the stop (tables of contents use dots) */
export type TabLeader = 'none' | 'dot' | 'hyphen' | 'underscore' | 'heavy' | 'middleDot';

export interface TabStop {
  /** Distance from the paragraph's text edge in CSS px (Word's `w:tab/@w:pos` in twips ÷ 15) */
  pos: number;
  align: TabStopAlign;
  /** Fill character; omitted means `none` */
  leader?: TabLeader;
}

const ALIGNS: readonly TabStopAlign[] = ['left', 'center', 'right', 'decimal'];
const LEADERS: readonly TabLeader[] = ['none', 'dot', 'hyphen', 'underscore', 'heavy', 'middleDot'];

function normalizeLeader(value: unknown): TabLeader {
  return LEADERS.includes(value as TabLeader) ? (value as TabLeader) : 'none';
}

function normalizeAlign(value: unknown): TabStopAlign {
  return ALIGNS.includes(value as TabStopAlign) ? (value as TabStopAlign) : 'left';
}

/** Drop garbage, clamp, dedupe by position and sort ascending (the order every consumer needs) */
export function normalizeTabStops(input: unknown): TabStop[] {
  if (!Array.isArray(input)) return [];
  const seen = new Set<number>();
  const stops: TabStop[] = [];
  for (const raw of input) {
    if (!raw || typeof raw !== 'object') continue;
    const pos = Number((raw as TabStop).pos);
    if (!Number.isFinite(pos) || pos < 0) continue;
    const rounded = Math.round(pos);
    if (rounded > MAX_TAB_STOP_PX || seen.has(rounded)) continue;
    seen.add(rounded);
    const leader = normalizeLeader((raw as TabStop).leader);
    stops.push({
      pos: rounded,
      align: normalizeAlign((raw as TabStop).align),
      // `none` is the default, so it is left out: the stop objects stay comparable by value
      ...(leader === 'none' ? {} : { leader }),
    });
    if (stops.length >= MAX_TAB_STOPS) break;
  }
  return stops.sort((a, b) => a.pos - b.pos);
}

/** Wire format used by `data-tab-stops` (drafts, HTML import/export and the docx reader) */
export function formatTabStops(stops: readonly TabStop[]): string {
  return normalizeTabStops(stops)
    .map((stop) =>
      stop.leader && stop.leader !== 'none'
        ? `${stop.pos}:${stop.align}:${stop.leader}`
        : `${stop.pos}:${stop.align}`,
    )
    .join(',');
}

export function parseTabStops(raw: string | null | undefined): TabStop[] {
  if (!raw) return [];
  return normalizeTabStops(
    raw.split(',').map((part) => {
      const [pos, align, leader] = part.split(':');
      return { pos: Number(pos), align: align as TabStopAlign, leader: leader as TabLeader };
    }),
  );
}

/**
 * The stop a tab at `x` advances to: the first custom stop past it, otherwise the next multiple of
 * the default interval (Word's behaviour when a paragraph defines no stops of its own).
 */
export function nextTabStop(
  stops: readonly TabStop[],
  x: number,
  interval: number = DEFAULT_TAB_STOP_PX,
): TabStop {
  for (const stop of normalizeTabStops(stops)) {
    if (stop.pos > x + 0.5) return stop;
  }
  const step = interval > 0 ? interval : DEFAULT_TAB_STOP_PX;
  // +0.0001 so a tab sitting exactly on a grid line moves to the next one instead of staying put
  return { pos: (Math.floor(x / step + 0.0001) + 1) * step, align: 'left' };
}

/** Add a stop, replacing one already within 3px (clicking the same tick twice keeps one stop) */
export function setTabStop(stops: readonly TabStop[], stop: TabStop): TabStop[] {
  const pos = Math.max(0, Math.round(stop.pos));
  return normalizeTabStops([
    ...normalizeTabStops(stops).filter((existing) => Math.abs(existing.pos - pos) > 3),
    { pos, align: normalizeAlign(stop.align) },
  ]);
}

/** Remove the stops nearest `pos` (4px tolerance: one ruler tick) */
export function removeTabStop(stops: readonly TabStop[], pos: number, tolerance = 4): TabStop[] {
  return normalizeTabStops(stops).filter((stop) => Math.abs(stop.pos - pos) > tolerance);
}

/* ------------------------------------------------------------------------------------------------
 * The tab atom
 * ---------------------------------------------------------------------------------------------- */

/**
 * Inline tab: an atom instead of a `\t` character (see the module comment). `contenteditable` is
 * disabled by ProseMirror for atoms, so the caret steps over it like over an inline image.
 */
export const DocTab = Node.create({
  name: 'docTab',
  group: 'inline',
  inline: true,
  atom: true,
  selectable: false,
  parseHTML() {
    return [{ tag: `span[${TAB_ATTR}]` }];
  },
  renderHTML() {
    return ['span', { [TAB_ATTR]: 'true', class: 'rte-tab' }];
  },
});

/** Blocks whose Tab key already means something (list sinking, table cell navigation, code indentation) */
const TAB_OWNED_BLOCKS = new Set([
  'listItem',
  'taskItem',
  'table',
  'tableCell',
  'tableHeader',
  'codeBlock',
]);

function tabOwnedByAncestor(editor: Editor): boolean {
  const { $from } = editor.state.selection;
  for (let depth = $from.depth; depth > 0; depth -= 1) {
    if (TAB_OWNED_BLOCKS.has($from.node(depth).type.name)) return true;
  }
  return false;
}

/** Insert a tab at the caret (Tab key) */
export function insertTab(editor: Editor): boolean {
  const { state } = editor;
  const { $from, empty } = state.selection;
  if (!empty || !$from.parent.isTextblock) return false;
  if (tabOwnedByAncestor(editor)) return false;
  if (!state.schema.nodes.docTab) return false;
  return editor.commands.insertContent({ type: 'docTab' });
}

/**
 * Shift-Tab: step back one stop.
 *
 * Walks left over the text on the current line and deletes the tab it runs into, so a caret sitting
 * after the stop's content ("甲⇥乙|") still steps back — Word moves the text to the previous stop,
 * and removing the tab is exactly that. It stops at another inline atom (an image is not a tab
 * field) and never crosses the block start.
 */
export function removeTabBefore(editor: Editor): boolean {
  const { state } = editor;
  const { $from, empty } = state.selection;
  if (!empty) return false;
  let pos = $from.pos;
  for (let guard = 0; guard < 256; guard += 1) {
    const $pos = state.doc.resolve(pos);
    const before = $pos.nodeBefore;
    if (!before) return false;
    if (before.type.name === 'docTab') {
      editor.view.dispatch(state.tr.delete(pos - before.nodeSize, pos).scrollIntoView());
      return true;
    }
    if (!before.isText) return false;
    pos -= before.nodeSize;
    if (pos <= $pos.start($pos.depth)) return false;
  }
  return false;
}

/**
 * Convert `\t` characters in imported HTML into tab atoms.
 *
 * mammoth hands `<w:tab/>` over as a `\t` inside a text node, and ProseMirror's parser would collapse
 * it into a space. Runs before the HTML reaches the editor, so the atom survives. Code blocks keep
 * their literal tabs (`<pre>` content is text by definition).
 */
export function tabsToTabNodes(html: string): string {
  if (!html.includes('\t') || typeof DOMParser === 'undefined') return html;
  const doc = new DOMParser().parseFromString(html, 'text/html');
  const walker = doc.createTreeWalker(doc.body, NodeFilter.SHOW_TEXT);
  const targets: Text[] = [];
  for (let node = walker.nextNode(); node; node = walker.nextNode()) {
    if (!(node as Text).data.includes('\t')) continue;
    if ((node as Text).parentElement?.closest('pre, code')) continue;
    targets.push(node as Text);
  }
  if (targets.length === 0) return html;
  for (const target of targets) {
    const fragment = doc.createDocumentFragment();
    target.data.split('\t').forEach((part, index) => {
      if (index > 0) {
        const tab = doc.createElement('span');
        tab.setAttribute(TAB_ATTR, 'true');
        fragment.appendChild(tab);
      }
      if (part) fragment.appendChild(doc.createTextNode(part));
    });
    target.replaceWith(fragment);
  }
  return doc.body.innerHTML;
}

/* ------------------------------------------------------------------------------------------------
 * Measured advance
 * ---------------------------------------------------------------------------------------------- */

interface TabStopState {
  /** Measured advance (CSS px) keyed by the document position of the tab atom */
  widths: Map<number, number>;
  deco: DecorationSet;
  hasTabs: boolean;
}

export const tabStopsKey = new PluginKey<TabStopState>('rteTabStops');

function isTab(node: PmNode): boolean {
  return node.type.name === 'docTab';
}

function buildDecorations(doc: PmNode, widths: Map<number, number>): DecorationSet {
  const decorations: Decoration[] = [];
  doc.descendants((node, pos) => {
    if (!isTab(node) || !node.isLeaf) return;
    const stops = normalizeTabStops(doc.resolve(pos).parent.attrs.tabStops);
    if (stops.length === 0) return;
    const width = widths.get(pos);
    if (width === undefined) return;
    // The leader belongs to the stop the tab runs into; the ruler cannot pick per-tab stops yet, so the
    // first leader in the paragraph is used (tables of contents have exactly one tab per line)
    const leader = stops.find((stop) => stop.leader && stop.leader !== 'none')?.leader;
    decorations.push(
      Decoration.node(pos, pos + node.nodeSize, {
        class: 'rte-tab--measured',
        ...(leader ? { 'data-tab-leader': leader } : {}),
        style: `width: ${Math.round(width * 100) / 100}px`,
      }),
    );
  });
  return DecorationSet.create(doc, decorations);
}

/** Decorations only have to be rebuilt from scratch when the document gained a tab atom */
function insertsTab(tr: Transaction): boolean {
  for (const step of tr.steps) {
    const slice = (step as unknown as { slice?: Slice }).slice;
    if (!slice) continue;
    let found = false;
    slice.content.descendants((node) => {
      if (isTab(node)) found = true;
      return !found;
    });
    if (found) return true;
  }
  return false;
}

function mapWidths(widths: Map<number, number>, tr: Transaction): Map<number, number> {
  if (widths.size === 0) return widths;
  const next = new Map<number, number>();
  widths.forEach((width, pos) => {
    next.set(tr.mapping.map(pos, -1), width);
  });
  return next;
}

/** Text after a tab atom: up to the next tab, the next inline atom (image, break) or the block end */
function runAfter(doc: PmNode, from: number, blockEnd: number): { run: string; runEnd: number } {
  let runEnd = blockEnd;
  doc.nodesBetween(from, blockEnd, (node, pos) => {
    if (pos < from) return true;
    if (isTab(node) || (node.isLeaf && !node.isText)) {
      runEnd = pos;
      return false;
    }
    return true;
  });
  return { run: doc.textBetween(from, runEnd, '', ''), runEnd };
}

/**
 * Room kept between the text the tab aligns and the right text edge (CSS px).
 *
 * Word puts a table of contents' right stop *exactly* on the text margin: A4 is 11906 twip and one
 * inch of margin on each side leaves 9026 twip, which is also what `TOC1`–`TOC9` carry as `w:pos`.
 * 9026 twip ÷ 15 rounds to **602px** while the text area is 601.73px, so the aligned run ends a third
 * of a pixel past the margin — enough for the browser to wrap the page number onto the next line.
 */
export const TAB_EDGE_SAFETY_PX = 0.5;

/** What the run after a tab measures, and how much room the text edge still offers */
export interface TabRunMetrics {
  /** Rendered width of the text after the tab (CSS px); 0 when the line ends at the tab */
  runWidth: number;
  /** Width of everything before the first `.` (decimal stops); `null` when the run has no dot */
  dotWidth?: number | null;
  /** Distance from the paragraph's text edge to the right edge of its text area (CSS px) */
  available: number;
}

/**
 * Advance of one tab at `x` (CSS px from the text edge), clamped so the text it aligns can never be
 * pushed past the right text edge.
 *
 * Left stops are pure arithmetic; center / right / decimal also need the width of the run they align.
 * The clamp is what keeps a stop that sits *on* the margin (see {@link TAB_EDGE_SAFETY_PX}) from
 * wrapping its page number onto the following line.
 */
export function resolveTabAdvance(stop: TabStop, x: number, metrics: TabRunMetrics): number {
  const { runWidth, available } = metrics;
  const advance = Math.max(0, stop.pos - x);
  const edge = Math.max(0, available - x - TAB_EDGE_SAFETY_PX);
  if (stop.align === 'left' || runWidth <= 0) return Math.min(advance, edge);
  let aligned = advance - runWidth;
  if (stop.align === 'center') aligned = advance - runWidth / 2;
  else if (stop.align === 'decimal') {
    const dotWidth = metrics.dotWidth;
    // Decimal: align the '.'; a run without one reads as right-aligned (Word does the same)
    aligned = advance - Math.max(0, dotWidth ?? runWidth);
  }
  // The aligned run has to fit as well, not just the tab box itself
  return Math.min(Math.max(0, aligned), Math.max(0, edge - runWidth));
}

/**
 * Width of the inline run `[from, to)` as laid out, read from a DOM range.
 *
 * Differencing two caret boxes (the previous approach) only worked while the run sat next to the tab:
 * once the run had wrapped, its width read as "unknown" and a right stop degraded into a left one,
 * which pushed the run further out and kept it wrapped forever. A range still knows the width.
 */
function runWidthPx(view: EditorView, from: number, to: number, scale: number): number | null {
  if (to <= from) return 0;
  try {
    const start = view.domAtPos(from);
    const end = view.domAtPos(to);
    const range = document.createRange();
    range.setStart(start.node, start.offset);
    range.setEnd(end.node, end.offset);
    const rects = Array.from(range.getClientRects()).filter((rect) => rect.width > 0);
    if (rects.length === 0) return null;
    // The first line is what the stop aligns (a run that wrapped has no single alignment anyway)
    const top = rects[0]?.top ?? 0;
    const sameLine = rects.filter((rect) => Math.abs(rect.top - top) < 2);
    const left = Math.min(...sameLine.map((rect) => rect.left));
    const right = Math.max(...sameLine.map((rect) => rect.right));
    return Math.max(0, (right - left) / scale);
  } catch {
    // Partially updated DOM or a detached node: fall back to the plain stop
    return null;
  }
}

/** Advance of a tab, reading the width of the run it aligns from the laid-out DOM */
function tabAdvance(
  view: EditorView,
  stops: readonly TabStop[],
  x: number,
  runFrom: number,
  run: string,
  runEnd: number,
  scale: number,
  available: number,
): number {
  const stop = nextTabStop(stops, x);
  if (stop.align === 'left' || run.length === 0) {
    return resolveTabAdvance(stop, x, { runWidth: 0, available });
  }
  const runWidth = runWidthPx(view, runFrom, runEnd, scale) ?? 0;
  const dot = run.indexOf('.');
  const dotWidth = dot > 0 ? runWidthPx(view, runFrom, runFrom + dot, scale) : null;
  return resolveTabAdvance(stop, x, { runWidth, dotWidth, available });
}

/** Zoom factor of the editor surface (`data-rte-zoom`): measured screen px ÷ CSS px */
function zoomOf(view: EditorView): number {
  const host = view.dom.closest('[data-rte-zoom]');
  const scale = Number(host?.getAttribute('data-rte-zoom') ?? 1);
  return Number.isFinite(scale) && scale > 0 ? scale : 1;
}

/**
 * Measure the advance of every tab atom that sits in a paragraph with custom stops.
 *
 * Reads the *current* layout, so the widths belong to the document they were measured on. Tabs that
 * share a visual line shift each other, so the pass walks them in order and folds the delta of each
 * corrected advance into the next measurement (one pass instead of one dispatch per tab).
 */
export function measureTabWidths(
  view: EditorView,
  previous: Map<number, number>,
): Map<number, number> {
  const widths = new Map<number, number>();
  const { doc } = view.state;
  const scale = zoomOf(view);
  // Per-line accumulated delta: a corrected advance moves every later tab on that line
  const lineShifts = new Map<number, number>();
  doc.descendants((node, pos) => {
    if (!isTab(node)) return;
    const $pos = doc.resolve(pos);
    const block = $pos.parent;
    const stops = normalizeTabStops(block.attrs.tabStops);
    if (stops.length === 0) return;
    const blockPos = $pos.before($pos.depth);
    const dom = view.nodeDOM(blockPos);
    if (!(dom instanceof HTMLElement)) return;
    const rect = dom.getBoundingClientRect();
    const style = getComputedStyle(dom);
    const padLeft = Number.parseFloat(style.paddingLeft) || 0;
    const padRight = Number.parseFloat(style.paddingRight) || 0;
    const indent = Number(block.attrs.indentLeft ?? 0) || 0;
    // Text edge = content box left minus the left indent (stops are relative to the text margin), so the
    // usable width grows by that indent: the block was narrowed by exactly the same amount
    const textLeft = rect.left + padLeft - indent * scale;
    const available = (rect.width - padLeft - padRight) / scale + indent;
    const coords = view.coordsAtPos(pos);
    const line = Math.round(coords.top / 2);
    const shift = lineShifts.get(line) ?? 0;
    const x = (coords.left - textLeft) / scale + shift;
    const runFrom = pos + node.nodeSize;
    const { run, runEnd } = runAfter(doc, runFrom, $pos.end($pos.depth));
    const advance = tabAdvance(view, stops, x, runFrom, run, runEnd, scale, available);
    lineShifts.set(line, shift + advance - (previous.get(pos) ?? 0));
    // Floor, not round: a hundredth of a pixel above the text edge is enough to wrap the aligned run
    widths.set(pos, Math.floor(advance * 100) / 100);
  });
  return widths;
}

function sameWidths(a: Map<number, number>, b: Map<number, number>): boolean {
  if (a.size !== b.size) return false;
  for (const [pos, width] of a) {
    const other = b.get(pos);
    if (other === undefined || Math.abs(other - width) > 0.5) return false;
  }
  return true;
}

/**
 * Tab stops extension: Tab / Shift-Tab plus the measured-advance plugin.
 *
 * The measure → dispatch cycle mirrors `PageView`'s pagination plugin: measure after the frame has
 * settled, dispatch only when something moved by more than half a pixel, and re-measure a bounded
 * number of times (applying widths can rewrap the very line that was just measured).
 */
export const TabStops = Extension.create({
  name: 'tabStops',
  addKeyboardShortcuts() {
    return {
      Tab: () => insertTab(this.editor),
      'Shift-Tab': () => removeTabBefore(this.editor),
    };
  },
  addProseMirrorPlugins() {
    return [
      new Plugin<TabStopState>({
        key: tabStopsKey,
        state: {
          init: (_config, state) => {
            let hasTabs = false;
            state.doc.descendants((node) => {
              if (isTab(node)) hasTabs = true;
              return !hasTabs;
            });
            return { widths: new Map(), hasTabs, deco: buildDecorations(state.doc, new Map()) };
          },
          apply: (tr, value) => {
            const meta = tr.getMeta(tabStopsKey) as Map<number, number> | undefined;
            if (meta) {
              return {
                widths: meta,
                hasTabs: value.hasTabs || meta.size > 0,
                deco: buildDecorations(tr.doc, meta),
              };
            }
            if (!tr.docChanged) return value;
            const widths = mapWidths(value.widths, tr);
            if (!insertsTab(tr))
              return { ...value, widths, deco: value.deco.map(tr.mapping, tr.doc) };
            return { widths, hasTabs: true, deco: buildDecorations(tr.doc, widths) };
          },
        },
        props: {
          decorations: (state) => tabStopsKey.getState(state)?.deco ?? DecorationSet.empty,
        },
        view: (editorView) => {
          let raf = 0;
          let passes = 0;
          const schedule = (target: EditorView) => {
            cancelAnimationFrame(raf);
            raf = requestAnimationFrame(() => {
              const current = tabStopsKey.getState(target.state);
              if (!current?.hasTabs) return;
              // Hidden / zero-width surfaces (jsdom, a collapsed pane) have no layout to read
              if (!target.dom.isConnected || target.dom.clientWidth === 0) return;
              const doc = target.state.doc;
              const widths = measureTabWidths(target, current.widths);
              // The widths belong to the measured document: a keystroke in between invalidates them
              if (target.state.doc !== doc) return;
              if (sameWidths(widths, current.widths)) {
                passes = 0;
                return;
              }
              target.dispatch(target.state.tr.setMeta(tabStopsKey, widths));
              if (passes < 2) {
                passes += 1;
                schedule(target);
              } else {
                passes = 0;
              }
            });
          };
          schedule(editorView);
          return {
            update: (nextView, prevState) => {
              if (nextView.state.doc !== prevState.doc) {
                passes = 0;
                schedule(nextView);
                return;
              }
              // Widths just landed: confirm them once (the line may have rewrapped)
              const before = tabStopsKey.getState(prevState);
              const after = tabStopsKey.getState(nextView.state);
              if (before && after && before.widths !== after.widths) schedule(nextView);
            },
            destroy: () => cancelAnimationFrame(raf),
          };
        },
      }),
    ];
  },
});
