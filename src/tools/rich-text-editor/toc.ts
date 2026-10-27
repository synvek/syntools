import { Node, mergeAttributes } from '@tiptap/core';
import type { Node as PMNode } from '@tiptap/pm/model';
import { TextSelection } from '@tiptap/pm/state';
import type { EditorView, NodeView } from '@tiptap/pm/view';
import { buildTableOfContents, type TocEntry } from './docs';
import { createPageLayoutQuery } from './PageView';

/**
 * Dynamic table of contents (equivalent to Word's TOC field):
 *
 * - The TOC is an atom node (storing no content, avoiding transaction loops between pagination and attributes);
 * - In the editor a NodeView derives it live from "current document + current pagination", so page numbers follow the layout;
 * - Serialization emits only an empty shell for atoms, so injectTocHtml fills in the rendered content
 *   before export/print, while Word maps it to an updatable TOC field (TableOfContents).
 */

export interface TocHeading {
  level: number;
  /** TOC entry text (trimmed) */
  text: string;
  /** Document position of the heading node, used for click-to-jump */
  pos: number;
}

/** TOC labels (injected by the tool layer for the current language) */
export interface TocLabels {
  /** TOC heading */
  title: string;
  /** Empty-state hint when there are no headings */
  empty: string;
}

export const DEFAULT_TOC_LABELS: TocLabels = { title: '目录', empty: '文档暂无标题' };

/** Extra indent per heading level (px) */
const TOC_INDENT_PX = 16;

/** Collect the document's headings; empty headings are skipped so they map one-to-one with TOC entries */
export function collectHeadings(doc: PMNode): TocHeading[] {
  const headings: TocHeading[] = [];
  doc.descendants((node, pos) => {
    if (node.type.name !== 'heading') return;
    const text = node.textContent.trim();
    if (!text) return;
    headings.push({ level: Number(node.attrs.level ?? 1), text, pos });
  });
  return headings;
}

/**
 * Build TOC data from the document and the page-number query.
 * Reuses buildTableOfContents from docs.ts (levels clamped to 1-6); page numbers are computed live
 * from the heading position via the pageOfPosition callback.
 */
export function buildTocEntries(
  doc: PMNode,
  pageOfPosition: (pos: number) => number,
): { entries: TocEntry[]; headings: TocHeading[] } {
  const headings = collectHeadings(doc);
  const result = buildTableOfContents(headings, (index) => pageOfPosition(headings[index].pos));
  return { entries: result.ok ? result.value.entries : [], headings };
}

/**
 * Render the TOC DOM: the editable state (clickable) and the export state (plain text) share one structure.
 * The structure is fixed as `div[data-toc] > p.rte-toc-title + ul > li[data-level]`, and screen / print /
 * snapshot PDF / Markdown / Word all recognize it by these class names and attributes.
 */
export function renderTocElement(
  entries: readonly TocEntry[],
  headings: readonly TocHeading[],
  labels: TocLabels = DEFAULT_TOC_LABELS,
  onJump?: (pos: number) => void,
): HTMLElement {
  const root = document.createElement('div');
  root.className = 'rte-toc';
  root.setAttribute('data-toc', 'true');

  const title = document.createElement('p');
  title.className = 'rte-toc-title';
  title.textContent = labels.title;
  root.appendChild(title);

  if (entries.length === 0) {
    const empty = document.createElement('p');
    empty.className = 'rte-toc-empty';
    empty.textContent = labels.empty;
    root.appendChild(empty);
    return root;
  }

  const list = document.createElement('ul');
  list.className = 'rte-toc-list';
  entries.forEach((entry, index) => {
    const item = document.createElement('li');
    item.className = 'rte-toc-item';
    item.setAttribute('data-level', String(entry.level));
    // Inline indent: print and snapshot PDF don't depend on external stylesheet load timing
    item.style.paddingLeft = `${(entry.level - 1) * TOC_INDENT_PX}px`;

    const text = document.createElement(onJump ? 'button' : 'span');
    text.className = 'rte-toc-text';
    text.textContent = entry.text;
    if (onJump) {
      const position = headings[index]?.pos;
      if (position !== undefined) {
        const button = text as HTMLButtonElement;
        button.type = 'button';
        item.setAttribute('data-pos', String(position));
        button.addEventListener('click', () => onJump(position));
      }
    }
    item.appendChild(text);

    if (entry.page > 0) {
      const page = document.createElement('span');
      page.className = 'rte-toc-page';
      page.textContent = String(entry.page);
      item.appendChild(page);
    }
    list.appendChild(item);
  });
  root.appendChild(list);
  return root;
}

/** TOC as an HTML string (for export/print/presentation) */
export function renderTocHtml(
  entries: readonly TocEntry[],
  headings: readonly TocHeading[],
  labels: TocLabels = DEFAULT_TOC_LABELS,
): string {
  return renderTocElement(entries, headings, labels).outerHTML;
}

/**
 * Replace empty TOC nodes in serialized HTML with the rendered TOC content.
 * `editor.getHTML()` goes through DOMSerializer, which emits only an empty shell for atom nodes;
 * without this step the TOC is empty in print / snapshot PDF / single-file HTML.
 */
export function injectTocHtml(html: string, renderedToc: string): string {
  if (!renderedToc || !html.includes('data-toc')) return html;
  const doc = new DOMParser().parseFromString(html, 'text/html');
  const targets = doc.querySelectorAll('div[data-toc]');
  if (targets.length === 0) return html;
  targets.forEach((target) => {
    const template = doc.createElement('template');
    template.innerHTML = renderedToc;
    target.replaceWith(template.content);
  });
  return doc.body.innerHTML;
}

/** Editable TOC view: redraws with the latest document and pagination on every state update */
class TocNodeView implements NodeView {
  readonly dom: HTMLElement;

  private node: PMNode;
  private readonly view: EditorView;
  private readonly labels: TocLabels;

  constructor(node: PMNode, view: EditorView, labels: TocLabels) {
    this.node = node;
    this.view = view;
    this.labels = labels;
    this.dom = document.createElement('div');
    this.dom.className = 'rte-toc-node';
    this.dom.setAttribute('data-toc-node', 'true');
    this.dom.contentEditable = 'false';
    this.render();
  }

  update(node: PMNode): boolean {
    if (node.type !== this.node.type) return false;
    this.node = node;
    this.render();
    return true;
  }

  /** The TOC handles its own button clicks, keeping events out of the editor's selection logic */
  stopEvent(): boolean {
    return true;
  }

  ignoreMutation(): boolean {
    return true;
  }

  private render(): void {
    const state = this.view.state;
    const query = createPageLayoutQuery(state);
    const { entries, headings } = buildTocEntries(state.doc, (pos) => query.pageIndexOfPos(pos));
    const element = renderTocElement(entries, headings, this.labels, (pos) => this.jump(pos));
    this.dom.replaceChildren(element);
  }

  private jump(pos: number): void {
    const state = this.view.state;
    const target = Math.min(pos + 1, state.doc.content.size);
    this.view.dispatch(
      state.tr.setSelection(TextSelection.near(state.doc.resolve(target))).scrollIntoView(),
    );
    this.view.focus();
  }
}

declare module '@tiptap/core' {
  interface Commands<ReturnType> {
    tableOfContents: {
      /** Insert a TOC at the cursor */
      insertTableOfContents: () => ReturnType;
      /** Refresh the TOC: trigger a pagination recompute so page numbers and entries follow */
      refreshTableOfContents: () => ReturnType;
    };
  }
}

export const TableOfContents = Node.create<{ labels: TocLabels }>({
  name: 'tableOfContents',
  group: 'block',
  atom: true,
  selectable: true,

  addOptions() {
    return { labels: DEFAULT_TOC_LABELS };
  },

  parseHTML() {
    return [{ tag: 'div[data-toc]' }];
  },

  renderHTML({ HTMLAttributes }) {
    // Atom nodes have no content hole: injectTocHtml fills the content before export
    return ['div', mergeAttributes(HTMLAttributes, { 'data-toc': 'true', class: 'rte-toc' })];
  },

  addCommands() {
    return {
      insertTableOfContents:
        () =>
        ({ commands }) =>
          commands.insertContent({ type: this.name }),
      refreshTableOfContents:
        () =>
        ({ tr, dispatch }) => {
          // Empty transaction + metadata: the pagination plugin re-measures and the TOC NodeView redraws
          // on the state update. Reuse the chain's tr (state.tr would conflict with the other chained steps).
          if (dispatch) tr.setMeta('tocRefresh', Date.now());
          return true;
        },
    };
  },

  addNodeView() {
    // configure({ labels: undefined }) overrides the defaults, so fall back explicitly here
    const labels = this.options.labels ?? DEFAULT_TOC_LABELS;
    return ({ node, view }) => new TocNodeView(node, view, labels);
  },
});
