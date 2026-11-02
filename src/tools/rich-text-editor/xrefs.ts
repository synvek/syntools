import { mergeAttributes, Node } from '@tiptap/core';
import type { Node as PmNode } from '@tiptap/pm/model';
import { TextSelection, type EditorState } from '@tiptap/pm/state';
import type { EditorView, NodeView } from '@tiptap/pm/view';
import { collectBookmarks } from './bookmarks';
import { createPageLayoutQuery } from './PageView';

/**
 * 交叉引用（RTE-03 第二批）：指向书签的"活"引用。
 *
 * 两种模式，都是 Word 里能对齐的语义：
 * - `text`：引用书签所在**段落**的文字（书签是零宽锚点，没有自己的文字，所以取所在块）；
 * - `page`：引用书签所在页码。
 *
 * 显示值由 NodeView 实时解析（与 TOC 同一范式）：atom 节点序列化出来只是空壳，
 * 编辑态读"当前文档 + 当前分页"，导出前由 `injectXrefHtml` 把空壳填成文字，
 * 所以草稿 / 打印 / 快照 PDF / Word 看到的是同一份内容。
 */

export type XrefMode = 'text' | 'page';

/** `<span data-xref="书签名" data-xref-mode="text">` */
export const XREF_ATTR = 'data-xref';
export const XREF_MODE_ATTR = 'data-xref-mode';

export interface XrefLabels {
  /** 目标书签已不存在时显示的占位文字 */
  missing: string;
}

export const DEFAULT_XREF_LABELS: XrefLabels = { missing: '引用失效' };

export function normalizeXrefMode(raw: string | null | undefined): XrefMode {
  return raw === 'page' ? 'page' : 'text';
}

/** 解析结果的缓存键：同一个书签的两种模式是两个不同的值 */
export function xrefKey(target: string, mode: XrefMode): string {
  return `${mode}:${target}`;
}

export interface XrefTarget {
  /** 书签锚点在文档中的位置 */
  pos: number;
  /** 书签所在块（段落 / 标题）的文字，已折叠空白 */
  text: string;
}

/** 找到书签位置与其所在块的文字；书签不存在时返回 null（调用方决定怎么提示） */
export function findXrefTarget(doc: PmNode, name: string): XrefTarget | null {
  const bookmark = collectBookmarks(doc).find((entry) => entry.name === name);
  if (!bookmark) return null;
  return { pos: bookmark.pos, text: blockTextAt(doc, bookmark.pos) };
}

/**
 * 取某个位置所在文本块（paragraph / heading）的文字。
 * 书签是行内 atom，`resolve` 的深度链上第一个 textblock 就是它所在的段落。
 */
export function blockTextAt(doc: PmNode, pos: number): string {
  const safe = Math.max(0, Math.min(pos, doc.content.size));
  const $pos = doc.resolve(safe);
  for (let depth = $pos.depth; depth > 0; depth -= 1) {
    const node = $pos.node(depth);
    if (node.isTextblock) return node.textContent.replace(/\s+/g, ' ').trim();
  }
  return '';
}

export interface XrefEntry {
  pos: number;
  target: string;
  mode: XrefMode;
}

/** 按文档顺序收集全部交叉引用 */
export function collectXrefs(doc: PmNode): XrefEntry[] {
  const entries: XrefEntry[] = [];
  doc.descendants((node, pos) => {
    if (node.type.name !== 'xref') return;
    const target = String(node.attrs.target ?? '');
    if (target) entries.push({ pos, target, mode: normalizeXrefMode(node.attrs.mode) });
  });
  return entries;
}

/**
 * 解析一条引用的显示值；`null` 表示目标书签已不存在。
 * 页码通过回调取，保持这个文件与分页实现解耦（单测不需要造分页状态）。
 */
export function resolveXrefValue(
  doc: PmNode,
  target: string,
  mode: XrefMode,
  pageOfPosition: (pos: number) => number,
): string | null {
  const resolved = findXrefTarget(doc, target);
  if (!resolved) return null;
  if (mode === 'page') {
    const page = pageOfPosition(resolved.pos);
    return page > 0 ? String(page) : null;
  }
  return resolved.text || null;
}

/** 一次性解析整篇文档的引用（导出注入用） */
export function resolveAllXrefs(
  doc: PmNode,
  pageOfPosition: (pos: number) => number,
): Map<string, string> {
  const values = new Map<string, string>();
  for (const entry of collectXrefs(doc)) {
    const value = resolveXrefValue(doc, entry.target, entry.mode, pageOfPosition);
    if (value !== null) values.set(xrefKey(entry.target, entry.mode), value);
  }
  return values;
}

/**
 * 把序列化后的空壳引用填成显示值。
 * 与 `injectTocHtml` 同样的位置：在 print / PDF / Word / Markdown 之前调用一次。
 * 保留 `data-xref` / `data-xref-mode` 属性 —— docx 导出要靠它们决定写域还是写链接。
 */
export function injectXrefHtml(
  html: string,
  values: ReadonlyMap<string, string>,
  labels: XrefLabels = DEFAULT_XREF_LABELS,
): string {
  if (!html.includes(XREF_ATTR)) return html;
  const doc = new DOMParser().parseFromString(html, 'text/html');
  const nodes = Array.from(doc.querySelectorAll(`span[${XREF_ATTR}]`));
  if (nodes.length === 0) return html;
  nodes.forEach((el) => {
    const target = el.getAttribute(XREF_ATTR) ?? '';
    const mode = normalizeXrefMode(el.getAttribute(XREF_MODE_ATTR));
    const value = values.get(xrefKey(target, mode));
    el.textContent = value ?? labels.missing;
    el.classList.toggle('rte-xref-missing', value === undefined);
  });
  return doc.body.innerHTML;
}

/** 点击引用跳回书签（与目录条目的跳转同一套逻辑） */
function jumpTo(view: EditorView, target: string): void {
  const resolved = findXrefTarget(view.state.doc, target);
  if (!resolved) return;
  const state = view.state;
  const pos = Math.min(resolved.pos, state.doc.content.size);
  view.dispatch(state.tr.setSelection(TextSelection.near(state.doc.resolve(pos))).scrollIntoView());
  view.focus();
}

class XrefNodeView implements NodeView {
  readonly dom: HTMLSpanElement;

  private node: PmNode;
  private readonly view: EditorView;
  private readonly labels: XrefLabels;

  constructor(node: PmNode, view: EditorView, labels: XrefLabels) {
    this.node = node;
    this.view = view;
    this.labels = labels;
    this.dom = document.createElement('span');
    this.dom.className = 'rte-xref-node';
    this.dom.setAttribute('data-xref-node', 'true');
    this.dom.contentEditable = 'false';
    this.dom.addEventListener('click', (event) => {
      event.preventDefault();
      jumpTo(this.view, String(this.node.attrs.target ?? ''));
    });
    this.render();
  }

  update(node: PmNode): boolean {
    if (node.type !== this.node.type) return false;
    this.node = node;
    // 分页变化会以 state 更新的形式到来，页码必须跟着重算，所以每次 update 都重绘
    this.render();
    return true;
  }

  stopEvent(): boolean {
    return true;
  }

  ignoreMutation(): boolean {
    return true;
  }

  private render(): void {
    const state = this.view.state;
    const target = String(this.node.attrs.target ?? '');
    const mode = normalizeXrefMode(this.node.attrs.mode);
    const query = createPageLayoutQuery(state);
    const value = resolveXrefValue(state.doc, target, mode, (pos) => query.pageIndexOfPos(pos));
    this.dom.textContent = value ?? this.labels.missing;
    this.dom.title = target;
    this.dom.classList.toggle('rte-xref-missing', value === null);
  }
}

declare module '@tiptap/core' {
  interface Commands<ReturnType> {
    crossReference: {
      /** 在光标处插入指向书签的交叉引用；书签不存在时返回 false */
      insertCrossReference: (target: string, mode: XrefMode) => ReturnType;
      /** 删除指定位置的交叉引用 */
      removeCrossReference: (pos: number) => ReturnType;
    };
  }
}

export const DocXref = Node.create<{ labels: XrefLabels }>({
  name: 'xref',
  group: 'inline',
  inline: true,
  atom: true,
  selectable: true,

  addOptions() {
    return { labels: DEFAULT_XREF_LABELS };
  },

  addAttributes() {
    return {
      target: {
        default: '',
        parseHTML: (element: HTMLElement) => element.getAttribute(XREF_ATTR) ?? '',
        renderHTML: (attributes: Record<string, unknown>) => ({
          [XREF_ATTR]: String(attributes.target ?? ''),
        }),
      },
      mode: {
        default: 'text',
        parseHTML: (element: HTMLElement) =>
          normalizeXrefMode(element.getAttribute(XREF_MODE_ATTR)),
        renderHTML: (attributes: Record<string, unknown>) => ({
          [XREF_MODE_ATTR]: normalizeXrefMode(String(attributes.mode ?? 'text')),
        }),
      },
    };
  },

  parseHTML() {
    return [{ tag: `span[${XREF_ATTR}]` }];
  },

  renderHTML({ node, HTMLAttributes }) {
    // atom + NodeView：这里的输出只是导出前的空壳，内容由 injectXrefHtml 填入
    return [
      'span',
      mergeAttributes(HTMLAttributes, {
        class: 'rte-xref',
        [XREF_ATTR]: String(node.attrs.target ?? ''),
        [XREF_MODE_ATTR]: normalizeXrefMode(node.attrs.mode),
      }),
    ];
  },

  addCommands() {
    return {
      insertCrossReference:
        (target: string, mode: XrefMode) =>
        ({ state, dispatch }) => {
          const name = target.trim();
          if (!name) return false;
          if (!findXrefTarget(state.doc, name)) return false;
          const type = state.schema.nodes[this.name];
          if (!type) return false;
          const node = type.create({ target: name, mode: normalizeXrefMode(mode) });
          if (dispatch) {
            const { from, to } = state.selection;
            // 与书签一致：选中文字时插在选区开头，不替换内容
            const tr =
              from === to
                ? state.tr.replaceSelectionWith(node, false)
                : state.tr.insert(from, node);
            dispatch(tr.scrollIntoView());
          }
          return true;
        },

      removeCrossReference:
        (pos: number) =>
        ({ state, dispatch }) => {
          const node = state.doc.nodeAt(pos);
          if (!node || node.type.name !== this.name) return false;
          if (dispatch) dispatch(state.tr.delete(pos, pos + node.nodeSize));
          return true;
        },
    };
  },

  addNodeView() {
    const labels = this.options.labels ?? DEFAULT_XREF_LABELS;
    return ({ node, view }) => new XrefNodeView(node, view, labels);
  },
});

/** 编辑态下当前文档里有多少条引用指向了不存在的书签（导出报告用） */
export function countBrokenXrefs(doc: PmNode): number {
  const names = new Set(collectBookmarks(doc).map((entry) => entry.name));
  return collectXrefs(doc).filter((entry) => !names.has(entry.target)).length;
}

/** 导出/统计需要的分页查询（无分页状态时全部按第 1 页） */
export function pageQuery(state: EditorState): (pos: number) => number {
  return (pos) => createPageLayoutQuery(state).pageIndexOfPos(pos);
}
