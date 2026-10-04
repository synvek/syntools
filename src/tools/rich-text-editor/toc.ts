import { Node, mergeAttributes } from '@tiptap/core';
import type { Node as PMNode } from '@tiptap/pm/model';
import { TextSelection } from '@tiptap/pm/state';
import type { EditorView, NodeView } from '@tiptap/pm/view';
import { buildTableOfContents, type TocEntry } from './docs';
import { createPageLayoutQuery } from './PageView';

/**
 * 动态目录（对标 Word 的目录域）：
 *
 * - 目录是 atom 节点（不存内容，避免分页 ↔ 属性互相触发的事务循环）；
 * - 编辑态由 NodeView 从「当前文档 + 当前分页结果」实时派生，页码随排版自动更新；
 * - 序列化时 atom 只输出空外壳，导出/打印前用 injectTocHtml 补上渲染内容，
 *   Word 侧则映射为可更新的目录域（TableOfContents）。
 */

export interface TocHeading {
  level: number;
  /** 目录条目文本（已 trim） */
  text: string;
  /** 标题节点在文档中的位置，用于点击跳转 */
  pos: number;
}

/** 目录所需文案（由工具层按当前语言注入） */
export interface TocLabels {
  /** 目录标题 */
  title: string;
  /** 没有标题时的空状态提示 */
  empty: string;
}

export const DEFAULT_TOC_LABELS: TocLabels = { title: '目录', empty: '文档暂无标题' };

/** 每一级标题额外缩进（px） */
const TOC_INDENT_PX = 16;

/** 收集文档中的标题；空标题被跳过，保证与目录条目一一对应 */
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
 * 由文档与页码查询生成目录数据。
 * 复用 docs.ts 的 buildTableOfContents（层级别裁剪到 1–6），
 * 页码经 pageOfPosition 回调按标题位置实时计算。
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
 * 渲染目录 DOM：编辑态（可点击跳转）与导出态（纯文本）共用同一结构。
 * 结构固定为 `div[data-toc] > p.rte-toc-title + ul > li[data-level]`，
 * 屏幕 / 打印 / 快照 PDF / Markdown / Word 五端都按这套类名与属性识别。
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
    // 内联缩进：打印与快照 PDF 不依赖外部样式表的加载时序
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

/** 目录的 HTML 字符串（导出/打印/演示用） */
export function renderTocHtml(
  entries: readonly TocEntry[],
  headings: readonly TocHeading[],
  labels: TocLabels = DEFAULT_TOC_LABELS,
): string {
  return renderTocElement(entries, headings, labels).outerHTML;
}

/**
 * 把序列化 HTML 中的空目录节点替换为已渲染的目录内容。
 * `editor.getHTML()` 走 DOMSerializer，atom 节点只输出空外壳；
 * 不做这一步，打印 / 快照 PDF / 单文件 HTML 里的目录就是空的。
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

/** 编辑态目录视图：每次 state 更新都用最新文档与分页结果重绘 */
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

  /** 目录内部只处理自己的按钮点击，不让事件进入编辑器选区逻辑 */
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
      /** 在光标处插入目录 */
      insertTableOfContents: () => ReturnType;
      /** 刷新目录：触发分页重算，页码与条目随之更新 */
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
    // atom 节点没有内容洞：导出前由 injectTocHtml 补内容
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
          // 空事务 + 元数据：分页插件会重新测量，目录 NodeView 随 state 更新重绘。
          // 必须复用命令链的 tr（直接用 state.tr 会与链上其它步骤产生不匹配事务）
          if (dispatch) tr.setMeta('tocRefresh', Date.now());
          return true;
        },
    };
  },

  addNodeView() {
    // configure({ labels: undefined }) 会覆盖默认值，这里显式兜底
    const labels = this.options.labels ?? DEFAULT_TOC_LABELS;
    return ({ node, view }) => new TocNodeView(node, view, labels);
  },
});
