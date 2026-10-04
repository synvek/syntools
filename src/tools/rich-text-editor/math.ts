import { Extension, Node, mergeAttributes } from '@tiptap/core';
import type { Node as PMNode } from '@tiptap/pm/model';
import type { NodeView } from '@tiptap/pm/view';
import katex from 'katex';
import 'katex/dist/katex.min.css';

/**
 * 公式（对标 Word 公式）：
 *
 * - 行内 `mathInline` 与块级 `mathBlock` 都是 atom，只存 LaTeX 源码，
 *   预览由 NodeView 用 KaTeX 渲染（渲染结果不进文档，避免序列化冗余）；
 * - 导出前统一走 injectMath：把 LaTeX 渲染成 KaTeX MathML，
 *   无需外部样式表即可在单文件 HTML 中正确显示；
 * - Word 导出走 mathOmml.ts（原生可编辑公式），不支持的语法降级为图片，
 *   降级数量进入导出损耗清单。
 */

/** 该公式能否用 Word 原生公式表达（供导出损耗统计复用） */
export { isOmmlSupported, latexToAst } from './latex';
export type { LatexNode } from './latex';

/* ------------------------------------------------------------------ *
 * 导出注入
 * ------------------------------------------------------------------ */

/** 把序列化 HTML 中的公式节点渲染为 KaTeX MathML（单文件 HTML 无需外部样式即可正确显示） */
export function injectMath(html: string): string {
  if (!html.includes('data-math')) return html;
  const doc = new DOMParser().parseFromString(html, 'text/html');
  const targets = Array.from(doc.querySelectorAll('[data-math]'));
  if (targets.length === 0) return html;
  targets.forEach((target) => {
    const latex = target.getAttribute('data-latex') ?? '';
    const displayMode = target.getAttribute('data-display') === 'true';
    if (!latex) return;
    try {
      target.innerHTML = katex.renderToString(latex, {
        displayMode,
        output: 'mathml',
        // 抛错才能走到下面的源码兜底：导出结果里出现 KaTeX 的红色报错样式并不合适
        throwOnError: true,
      });
    } catch {
      // 渲染失败保留原始 LaTeX，至少不丢内容
      target.textContent = displayMode ? `$$${latex}$$` : `$${latex}$`;
    }
  });
  return doc.body.innerHTML;
}

/* ------------------------------------------------------------------ *
 * 节点
 * ------------------------------------------------------------------ */

/** 公式渲染失败的兜底显示：原样呈现 LaTeX 源码并标注错误 */
function renderLatexInto(container: HTMLElement, latex: string, displayMode: boolean): void {
  try {
    container.innerHTML = katex.renderToString(latex, {
      displayMode,
      throwOnError: true,
      strict: false,
    });
  } catch {
    container.textContent = displayMode ? `$$${latex}$$` : `$${latex}$`;
    container.classList.add('rte-math-error');
  }
}

class MathNodeView implements NodeView {
  readonly dom: HTMLElement;
  private node: PMNode;
  private readonly getPos: () => number | undefined;
  private readonly onSelect: (pos: number, latex: string, display: boolean) => void;

  constructor(
    node: PMNode,
    getPos: () => number | undefined,
    onSelect: (pos: number, latex: string, display: boolean) => void,
    inline: boolean,
  ) {
    this.node = node;
    this.getPos = getPos;
    this.onSelect = onSelect;
    this.dom = document.createElement(inline ? 'span' : 'div');
    this.dom.className = inline ? 'rte-math rte-math-inline' : 'rte-math rte-math-block';
    this.dom.setAttribute('data-math', inline ? 'inline' : 'block');
    this.dom.contentEditable = 'false';
    this.dom.addEventListener('mousedown', (event) => {
      event.preventDefault();
      const pos = this.getPos();
      if (pos === undefined) return;
      this.onSelect(pos, String(this.node.attrs.latex ?? ''), this.node.attrs.display === true);
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
    const latex = String(this.node.attrs.latex ?? '');
    this.dom.setAttribute('data-latex', latex);
    renderLatexInto(this.dom, latex, this.node.attrs.display === true);
  }
}

/** 公式节点属性：LaTeX 源码 + 是否块级展示 */
function mathAttributes() {
  return {
    latex: {
      default: '',
      parseHTML: (el: HTMLElement) => el.getAttribute('data-latex') ?? '',
      renderHTML: (attrs: { latex?: string }) => ({ 'data-latex': attrs.latex ?? '' }),
    },
    display: {
      default: false,
      parseHTML: (el: HTMLElement) => el.getAttribute('data-display') === 'true',
      renderHTML: (attrs: { display?: boolean }) => ({
        'data-display': attrs.display ? 'true' : 'false',
      }),
    },
  };
}

declare module '@tiptap/core' {
  interface Commands<ReturnType> {
    math: {
      /** 在光标处插入行内公式 */
      insertInlineMath: (latex: string) => ReturnType;
      /** 插入块级公式（独占一行居中展示） */
      insertBlockMath: (latex: string) => ReturnType;
      /** 修改指定位置的公式（行内/块级由节点自身决定，不在此切换） */
      updateMath: (pos: number, latex: string) => ReturnType;
      /** 删除指定位置的公式 */
      removeMath: (pos: number) => ReturnType;
    };
  }
}

/** 公式节点选项：点击回调由工具层注入（打开编辑弹窗） */
export interface MathNodeOptions {
  /** 点击公式时回调（工具层打开编辑弹窗） */
  onSelect?: (pos: number, latex: string, display: boolean) => void;
}

function createMathNode(name: string, inline: boolean) {
  return Node.create<MathNodeOptions>({
    name,
    group: inline ? 'inline' : 'block',
    inline,
    atom: true,
    selectable: true,

    addOptions() {
      return { onSelect: undefined };
    },

    addAttributes: mathAttributes,

    parseHTML() {
      return [{ tag: inline ? 'span[data-math]' : 'div[data-math]' }];
    },

    renderHTML({ HTMLAttributes }) {
      return [
        inline ? 'span' : 'div',
        mergeAttributes(HTMLAttributes, {
          'data-math': inline ? 'inline' : 'block',
          class: inline ? 'rte-math rte-math-inline' : 'rte-math rte-math-block',
        }),
      ];
    },

    addCommands() {
      return inline
        ? {
            insertInlineMath:
              (latex: string) =>
              ({ commands }) =>
                commands.insertContent({ type: name, attrs: { latex, display: false } }),
          }
        : {
            insertBlockMath:
              (latex: string) =>
              ({ commands }) =>
                commands.insertContent({
                  type: name,
                  attrs: { latex, display: true },
                }),
          };
    },

    addNodeView() {
      const onSelect = this.options.onSelect;
      return ({ node, getPos }) =>
        new MathNodeView(node, getPos, onSelect ?? (() => undefined), inline);
    },
  });
}

export const MathInline = createMathNode('mathInline', true);
export const MathBlock = createMathNode('mathBlock', false);

/** 改写 / 删除公式的命令（与行内/块级无关，统一由扩展提供） */
export const MathCommands = Extension.create({
  name: 'mathCommands',
  addCommands() {
    const isMath = (name: string) => name === 'mathInline' || name === 'mathBlock';
    return {
      updateMath:
        (pos: number, latex: string) =>
        ({ tr, dispatch }) => {
          const node = tr.doc.nodeAt(pos);
          if (!node || !isMath(node.type.name)) return false;
          if (dispatch) tr.setNodeMarkup(pos, undefined, { ...node.attrs, latex });
          return true;
        },
      removeMath:
        (pos: number) =>
        ({ tr, dispatch }) => {
          const node = tr.doc.nodeAt(pos);
          if (!node || !isMath(node.type.name)) return false;
          if (dispatch) tr.delete(pos, pos + node.nodeSize);
          return true;
        },
    };
  },
});

/** 收集文档中的公式源码（按文档顺序），供导出损耗统计使用 */
export function collectLatex(doc: import('@tiptap/pm/model').Node): string[] {
  const list: string[] = [];
  doc.descendants((node) => {
    if (node.type.name === 'mathInline' || node.type.name === 'mathBlock') {
      list.push(String(node.attrs.latex ?? ''));
    }
  });
  return list;
}
