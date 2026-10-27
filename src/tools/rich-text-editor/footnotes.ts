import { Extension, Node, mergeAttributes } from '@tiptap/core';
import type { Node as PMNode } from '@tiptap/pm/model';
import { NodeSelection, Plugin, PluginKey, type EditorState } from '@tiptap/pm/state';
import { Decoration, DecorationSet } from '@tiptap/pm/view';
import type { EditorView, NodeView } from '@tiptap/pm/view';

/**
 * Footnotes (modeled on Word footnotes / endnotes):
 *
 * - The body holds an inline atom `footnoteRef`, with the note text in the node attribute `note` —
 *   self-contained, avoiding positional coupling between a "reference + list" node pair, so undo/redo
 *   and serialization deal with a single record;
 * - The on-screen end-of-document summary is derived from a widget decoration: it doesn't touch the
 *   document content and never reaches getHTML;
 * - Print / snapshot PDF / single-file HTML / Markdown / Word export all run through injectFootnotes
 *   beforehand: number by DOM order, write the numbers into the HTML, and append the same summary.
 */

export interface FootnoteLabels {
  /** Footnote label: shared by the toolbar, dialog title and end-of-document summary heading */
  name: string;
  /** Placeholder for an empty note */
  empty: string;
}

export const DEFAULT_FOOTNOTE_LABELS: FootnoteLabels = { name: '脚注', empty: '（空脚注）' };

/** Summary section marker attribute: both injection idempotency and styling depend on it */
const LIST_TAG = 'section';
const LIST_ATTR = 'data-footnote-list';
const LIST_CLASS = 'rte-footnote-list';

/** Attribute on the reference node that outside code (export layer / tests) can read */
export const FOOTNOTE_ATTR = 'data-footnote';

/** Custom event dispatched on reference click: NodeView -> tool layer opens the edit dialog */
export const FOOTNOTE_EDIT_EVENT = 'rte-footnote-edit';

export interface FootnoteEditDetail {
  /** Document position of the reference node */
  pos: number;
  /** Current note text */
  note: string;
}

/* ------------------------------------------------------------------ *
 * Pure logic: numbering and export injection
 * ------------------------------------------------------------------ */

/** Collect footnote notes in document order */
export function collectFootnoteNotes(doc: PMNode): string[] {
  const notes: string[] = [];
  doc.descendants((node) => {
    if (node.type.name !== 'footnoteRef') return;
    notes.push(String(node.attrs.note ?? '').trim());
  });
  return notes;
}

/** Build the end-of-document summary DOM (shared by the on-screen widget and export injection) */
export function renderFootnoteList(
  notes: readonly string[],
  labels: FootnoteLabels = DEFAULT_FOOTNOTE_LABELS,
): HTMLElement {
  const section = document.createElement(LIST_TAG);
  section.className = LIST_CLASS;
  section.setAttribute(LIST_ATTR, 'true');

  const title = document.createElement('p');
  title.className = 'rte-footnote-list-title';
  title.textContent = labels.name;
  section.appendChild(title);

  const list = document.createElement('ol');
  list.className = 'rte-footnote-list-items';
  notes.forEach((note, index) => {
    const item = document.createElement('li');
    item.className = 'rte-footnote-item';
    item.setAttribute('data-number', String(index + 1));
    item.textContent = note || labels.empty;
    list.appendChild(item);
  });
  section.appendChild(list);
  return section;
}

/**
 * Number footnote references and append the end-of-document summary (idempotent: repeat calls
 * renumber and replace the previous summary).
 * Input references look like `<sup data-footnote data-note="…">`,
 * output is `<sup data-footnote data-number="n" data-note="…">[n]</sup>` + the summary.
 */
export function injectFootnotes(
  html: string,
  labels: FootnoteLabels = DEFAULT_FOOTNOTE_LABELS,
): string {
  if (!html.includes(FOOTNOTE_ATTR)) return html;
  const doc = new DOMParser().parseFromString(html, 'text/html');
  const refs = Array.from(doc.querySelectorAll(`sup[${FOOTNOTE_ATTR}]`));
  if (refs.length === 0) return html;

  // Remove the previously injected summary first so the call stays repeatable
  doc.querySelectorAll(`${LIST_TAG}[${LIST_ATTR}]`).forEach((node) => node.remove());

  const notes = refs.map((ref) => (ref.getAttribute('data-note') ?? '').trim());
  refs.forEach((ref, index) => {
    ref.setAttribute('data-number', String(index + 1));
    ref.textContent = `[${index + 1}]`;
  });

  doc.body.appendChild(renderFootnoteList(notes, labels));
  return doc.body.innerHTML;
}

/* ------------------------------------------------------------------ *
 * Reference node and on-screen summary
 * ------------------------------------------------------------------ */

/** Traverse each document once: all reference NodeViews share the numbering result */
const numberCache = new WeakMap<PMNode, Map<number, number>>();

function footnoteNumbers(state: EditorState): Map<number, number> {
  const cached = numberCache.get(state.doc);
  if (cached) return cached;
  const numbers = new Map<number, number>();
  let index = 0;
  state.doc.descendants((node, pos) => {
    if (node.type.name !== 'footnoteRef') return;
    index += 1;
    numbers.set(pos, index);
  });
  numberCache.set(state.doc, numbers);
  return numbers;
}

/**
 * The footnote reference the current action targets:
 * 1) the reference is selected (NodeSelection right after clicking [n]);
 * 2) the cursor sits next to a reference (after insertion the cursor rests right after it, the most
 *    common state when editing).
 */
export function findSelectedFootnote(state: EditorState): { pos: number; note: string } | null {
  const { selection } = state;
  if (selection instanceof NodeSelection && selection.node.type.name === 'footnoteRef') {
    return { pos: selection.from, note: String(selection.node.attrs.note ?? '') };
  }
  const { $from } = selection;
  const before = $from.nodeBefore;
  if (before && before.type.name === 'footnoteRef') {
    return { pos: selection.from - before.nodeSize, note: String(before.attrs.note ?? '') };
  }
  const after = $from.nodeAfter;
  if (after && after.type.name === 'footnoteRef') {
    return { pos: selection.from, note: String(after.attrs.note ?? '') };
  }
  return null;
}

/** Footnote reference view: shows the live number and dispatches an edit event on click */
class FootnoteRefView implements NodeView {
  readonly dom: HTMLElement;

  private node: PMNode;
  private readonly view: EditorView;
  private readonly getPos: () => number | undefined;
  private readonly labels: FootnoteLabels;

  constructor(
    node: PMNode,
    view: EditorView,
    getPos: () => number | undefined,
    labels: FootnoteLabels,
  ) {
    this.node = node;
    this.view = view;
    this.getPos = getPos;
    this.labels = labels;
    this.dom = document.createElement('sup');
    this.dom.className = 'rte-footnote-ref';
    this.dom.setAttribute(FOOTNOTE_ATTR, 'true');
    this.dom.contentEditable = 'false';
    this.dom.addEventListener('mousedown', (event) => {
      event.preventDefault();
      this.emitEdit();
    });
    this.render();
  }

  update(node: PMNode): boolean {
    if (node.type !== this.node.type) return false;
    this.node = node;
    this.render();
    return true;
  }

  private render(): void {
    const pos = this.getPos();
    const numbers = footnoteNumbers(this.view.state);
    const number = pos === undefined ? 0 : (numbers.get(pos) ?? 0);
    const note = String(this.node.attrs.note ?? '').trim();
    this.dom.textContent = `[${number}]`;
    this.dom.setAttribute('data-number', String(number));
    this.dom.setAttribute('title', note || this.labels.empty);
  }

  private emitEdit(): void {
    const pos = this.getPos();
    if (pos === undefined) return;
    const detail: FootnoteEditDetail = { pos, note: String(this.node.attrs.note ?? '') };
    this.dom.dispatchEvent(
      new CustomEvent<FootnoteEditDetail>(FOOTNOTE_EDIT_EVENT, { bubbles: true, detail }),
    );
  }
}

/** Footnote reference node */
export const FootnoteRef = Node.create<{ labels: FootnoteLabels }>({
  name: 'footnoteRef',
  group: 'inline',
  inline: true,
  atom: true,
  selectable: true,

  addOptions() {
    return { labels: DEFAULT_FOOTNOTE_LABELS };
  },

  addAttributes() {
    return {
      /** Note text; an empty string means not filled in yet */
      note: {
        default: '',
        parseHTML: (el) => el.getAttribute('data-note') ?? '',
        renderHTML: (attrs: { note?: string }) => ({ 'data-note': attrs.note ?? '' }),
      },
    };
  },

  parseHTML() {
    return [{ tag: `sup[${FOOTNOTE_ATTR}]` }];
  },

  renderHTML({ HTMLAttributes }) {
    return [
      'sup',
      mergeAttributes(HTMLAttributes, { [FOOTNOTE_ATTR]: 'true', class: 'rte-footnote-ref' }),
    ];
  },

  addCommands() {
    return {
      insertFootnote:
        (note: string) =>
        ({ commands }) =>
          commands.insertContent({ type: this.name, attrs: { note } }),
      updateFootnote:
        (pos: number, note: string) =>
        ({ tr, dispatch }) => {
          const node = tr.doc.nodeAt(pos);
          if (!node || node.type.name !== this.name) return false;
          if (dispatch) tr.setNodeMarkup(pos, undefined, { ...node.attrs, note });
          return true;
        },
      removeFootnote:
        (pos: number) =>
        ({ tr, dispatch }) => {
          const node = tr.doc.nodeAt(pos);
          if (!node || node.type.name !== this.name) return false;
          if (dispatch) tr.delete(pos, pos + node.nodeSize);
          return true;
        },
    };
  },

  addNodeView() {
    const labels = this.options.labels ?? DEFAULT_FOOTNOTE_LABELS;
    return ({ node, view, getPos }) => new FootnoteRefView(node, view, getPos, labels);
  },
});

/**
 * End-of-document summary (on screen): presented as a widget at the end of the document.
 * Decorations are rebuilt only when the document changes, avoiding a re-layout of the summary on
 * every selection change.
 */
const footnoteListKey = new PluginKey<{ deco: DecorationSet }>('footnoteList');

export const FootnoteList = Extension.create<{ labels?: FootnoteLabels }>({
  name: 'footnoteList',

  addOptions() {
    return { labels: DEFAULT_FOOTNOTE_LABELS };
  },

  addProseMirrorPlugins() {
    const labels = this.options.labels ?? DEFAULT_FOOTNOTE_LABELS;
    const build = (doc: PMNode): { deco: DecorationSet } => {
      const notes = collectFootnoteNotes(doc);
      if (notes.length === 0) return { deco: DecorationSet.empty };
      return {
        deco: DecorationSet.create(doc, [
          Decoration.widget(doc.content.size, () => renderFootnoteList(notes, labels), {
            side: 1,
          }),
        ]),
      };
    };
    return [
      new Plugin<{ deco: DecorationSet }>({
        key: footnoteListKey,
        state: {
          init: (_config, state) => build(state.doc),
          apply: (tr, value) => (tr.docChanged ? build(tr.doc) : value),
        },
        props: {
          decorations: (state) => footnoteListKey.getState(state)?.deco ?? DecorationSet.empty,
        },
      }),
    ];
  },
});

declare module '@tiptap/core' {
  interface Commands<ReturnType> {
    footnote: {
      /** Insert a footnote reference at the cursor */
      insertFootnote: (note: string) => ReturnType;
      /** Update the note text at the given position */
      updateFootnote: (pos: number, note: string) => ReturnType;
      /** Remove the footnote reference at the given position */
      removeFootnote: (pos: number) => ReturnType;
    };
  }
}
