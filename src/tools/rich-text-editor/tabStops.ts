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

export interface TabStop {
  /** Distance from the paragraph's text edge in CSS px (Word's `w:tab/@w:pos` in twips ÷ 15) */
  pos: number;
  align: TabStopAlign;
}

const ALIGNS: readonly TabStopAlign[] = ['left', 'center', 'right', 'decimal'];

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
    stops.push({ pos: rounded, align: normalizeAlign((raw as TabStop).align) });
    if (stops.length >= MAX_TAB_STOPS) break;
  }
  return stops.sort((a, b) => a.pos - b.pos);
}

/** Wire format used by `data-tab-stops` (drafts, HTML import/export and the docx reader) */
export function formatTabStops(stops: readonly TabStop[]): string {
  return normalizeTabStops(stops)
    .map((stop) => `${stop.pos}:${stop.align}`)
    .join(',');
}

export function parseTabStops(raw: string | null | undefined): TabStop[] {
  if (!raw) return [];
  return normalizeTabStops(
    raw.split(',').map((part) => {
      const [pos, align] = part.split(':');
      return { pos: Number(pos), align: align as TabStopAlign };
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
    decorations.push(
      Decoration.node(pos, pos + node.nodeSize, {
        class: 'rte-tab--measured',
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
 * Advance of a tab at `x` (CSS px from the text edge).
 *
 * Left stops are pure arithmetic; center / right / decimal also need the width of the text the tab
 * aligns, read from the laid-out line (`coordsAtPos`). A run already wrapped to the next line cannot
 * be aligned by a stop, so it degrades to a left stop instead of guessing.
 */
function tabAdvance(
  view: EditorView,
  stops: readonly TabStop[],
  x: number,
  tabPos: number,
  run: string,
  runEnd: number,
  tabTop: number,
  scale: number,
): number {
  const stop = nextTabStop(stops, x);
  const advance = stop.pos - x;
  if (stop.align === 'left' || run.length === 0) return Math.max(0, advance);
  const start = view.coordsAtPos(tabPos);
  const end = view.coordsAtPos(runEnd);
  if (Math.abs(end.top - tabTop) > 2 || Math.abs(start.top - tabTop) > 2) {
    return Math.max(0, advance);
  }
  const runWidth = Math.max(0, (end.left - start.left) / scale);
  if (stop.align === 'center') return Math.max(0, advance - runWidth / 2);
  if (stop.align === 'right') return Math.max(0, advance - runWidth);
  // Decimal: align the '.'; a run without one reads as right-aligned (Word does the same)
  const dot = run.indexOf('.');
  if (dot <= 0) return Math.max(0, advance - runWidth);
  const dotEnd = view.coordsAtPos(runEnd - run.length + dot);
  return Math.max(0, advance - Math.max(0, (dotEnd.left - start.left) / scale));
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
    const padding = Number.parseFloat(getComputedStyle(dom).paddingLeft) || 0;
    const indent = Number(block.attrs.indentLeft ?? 0) || 0;
    // Text edge = content box left minus the left indent (stops are relative to the text margin)
    const textLeft = rect.left + padding - indent * scale;
    const coords = view.coordsAtPos(pos);
    const line = Math.round(coords.top / 2);
    const shift = lineShifts.get(line) ?? 0;
    const x = (coords.left - textLeft) / scale + shift;
    const { run, runEnd } = runAfter(doc, pos + node.nodeSize, $pos.end($pos.depth));
    const advance = tabAdvance(view, stops, x, pos, run, runEnd, coords.top, scale);
    lineShifts.set(line, shift + advance - (previous.get(pos) ?? 0));
    widths.set(pos, Math.round(advance * 100) / 100);
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
