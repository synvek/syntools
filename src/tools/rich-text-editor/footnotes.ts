import { Extension, Node, mergeAttributes } from '@tiptap/core';
import type { Node as PMNode } from '@tiptap/pm/model';
import { NodeSelection, Plugin, PluginKey, type EditorState } from '@tiptap/pm/state';
import { Decoration, DecorationSet } from '@tiptap/pm/view';
import type { EditorView, NodeView } from '@tiptap/pm/view';

/**
 * 脚注（对标 Word 脚注 / 尾注）：
 *
 * - 正文中是行内 atom `footnoteRef`，注释正文存在节点属性 `note` 里——单节点自包含，
 *   不引入「引用 + 列表」两个节点之间的位置耦合，撤销重做与序列化都只有一条数据；
 * - 屏幕上文末汇总区由 widget decoration 派生，不改动文档内容、不进入 getHTML；
 * - 打印 / 快照 PDF / 单文件 HTML / Markdown / Word 导出前统一走 injectFootnotes：
 *   按 DOM 顺序编号、把编号写进 HTML，并追加同一套汇总区。
 */

export interface FootnoteLabels {
  /** 脚注名称：工具栏、弹窗标题与文末汇总区标题共用 */
  name: string;
  /** 空注释占位 */
  empty: string;
}

export const DEFAULT_FOOTNOTE_LABELS: FootnoteLabels = { name: '脚注', empty: '（空脚注）' };

/** 汇总区标记属性：注入幂等性与样式都依赖它 */
const LIST_TAG = 'section';
const LIST_ATTR = 'data-footnote-list';
const LIST_CLASS = 'rte-footnote-list';

/** 引用节点上可供外部（导出层 / 测试）读取的属性 */
export const FOOTNOTE_ATTR = 'data-footnote';

/** 点击引用时派发的自定义事件：NodeView → 工具层打开编辑弹窗 */
export const FOOTNOTE_EDIT_EVENT = 'rte-footnote-edit';

export interface FootnoteEditDetail {
  /** 引用节点在文档中的位置 */
  pos: number;
  /** 当前注释正文 */
  note: string;
}

/* ------------------------------------------------------------------ *
 * 纯逻辑：编号与导出注入
 * ------------------------------------------------------------------ */

/** 按文档顺序收集脚注正文 */
export function collectFootnoteNotes(doc: PMNode): string[] {
  const notes: string[] = [];
  doc.descendants((node) => {
    if (node.type.name !== 'footnoteRef') return;
    notes.push(String(node.attrs.note ?? '').trim());
  });
  return notes;
}

/** 生成文末汇总区 DOM（屏幕 widget 与导出注入共用同一结构） */
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
 * 为脚注引用编号并追加文末汇总区（幂等：重复调用会重新编号并替换旧汇总区）。
 * 输入 HTML 中引用形如 `<sup data-footnote data-note="…">`，
 * 输出为 `<sup data-footnote data-number="n" data-note="…">[n]</sup>` + 汇总区。
 */
export function injectFootnotes(
  html: string,
  labels: FootnoteLabels = DEFAULT_FOOTNOTE_LABELS,
): string {
  if (!html.includes(FOOTNOTE_ATTR)) return html;
  const doc = new DOMParser().parseFromString(html, 'text/html');
  const refs = Array.from(doc.querySelectorAll(`sup[${FOOTNOTE_ATTR}]`));
  if (refs.length === 0) return html;

  // 先清掉上一次注入的汇总区，保证可重复调用
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
 * 引用节点与屏幕汇总区
 * ------------------------------------------------------------------ */

/** 同一份文档只遍历一次：多个引用 NodeView 共享编号结果 */
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
 * 当前操作目标脚注引用：
 * 1) 引用被选中（点击 [n] 后的 NodeSelection）；
 * 2) 光标紧邻引用（插入后光标停在引用之后，是编辑的最常见形态）。
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

/** 脚注引用视图：显示实时编号，点击派发编辑事件 */
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

/** 脚注引用节点 */
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
      /** 注释正文；空字符串表示尚未填写 */
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
 * 文末汇总区（屏幕）：以文档末尾的 widget 呈现。
 * 只在文档变化时重建装饰，避免每次选区变化都重排汇总区。
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
      /** 在光标处插入脚注引用 */
      insertFootnote: (note: string) => ReturnType;
      /** 修改指定位置的脚注正文 */
      updateFootnote: (pos: number, note: string) => ReturnType;
      /** 删除指定位置的脚注引用 */
      removeFootnote: (pos: number) => ReturnType;
    };
  }
}
