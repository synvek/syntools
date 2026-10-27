import { Extension, Node, mergeAttributes } from '@tiptap/core';
import type { Node as PMNode } from '@tiptap/pm/model';
import type { NodeView } from '@tiptap/pm/view';
import katex from 'katex';
import 'katex/dist/katex.min.css';

/**
 * Formulas (modeled on Word equations):
 *
 * - Inline `mathInline` and block `mathBlock` are both atoms storing only LaTeX source; the preview is
 *   rendered by a NodeView with KaTeX (never written into the document, avoiding serialization bloat);
 * - Export runs through injectMath: LaTeX is rendered to KaTeX MathML, which displays correctly in a
 *   single-file HTML without any external stylesheet;
 * - Word export goes through mathOmml.ts (native editable equations); unsupported syntax degrades to
 *   images, and the count feeds the export loss report.
 */

/** Whether the formula can be expressed as a native Word equation (reused by the export loss scan) */
export { isOmmlSupported, latexToAst } from './latex';
export type { LatexNode } from './latex';

/* ------------------------------------------------------------------ *
 * Export injection
 * ------------------------------------------------------------------ */

/** Render formula nodes in serialized HTML to KaTeX MathML (single-file HTML displays them without external styles) */
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
        // Throw so the source fallback below runs: KaTeX's red error styling looks wrong in an exported file
        throwOnError: true,
      });
    } catch {
      // On render failure keep the raw LaTeX so nothing is lost
      target.textContent = displayMode ? `$$${latex}$$` : `$${latex}$`;
    }
  });
  return doc.body.innerHTML;
}

/* ------------------------------------------------------------------ *
 * Nodes
 * ------------------------------------------------------------------ */

/** Fallback when rendering fails: show the raw LaTeX source and mark it as an error */
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

/** Formula node attributes: LaTeX source + whether it displays as a block */
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
      /** Insert an inline formula at the cursor */
      insertInlineMath: (latex: string) => ReturnType;
      /** Insert a block formula (a centered line of its own) */
      insertBlockMath: (latex: string) => ReturnType;
      /** Update the formula at the given position (inline/block is decided by the node itself, not switched here) */
      updateMath: (pos: number, latex: string) => ReturnType;
      /** Remove the formula at the given position */
      removeMath: (pos: number) => ReturnType;
    };
  }
}

/** Formula node options: the click callback is injected by the tool layer (to open the edit dialog) */
export interface MathNodeOptions {
  /** Callback on formula click (the tool layer opens the edit dialog) */
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

/** Commands to update / remove formulas (independent of inline/block, provided by one extension) */
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

/** Collect formula sources in document order for the export loss scan */
export function collectLatex(doc: import('@tiptap/pm/model').Node): string[] {
  const list: string[] = [];
  doc.descendants((node) => {
    if (node.type.name === 'mathInline' || node.type.name === 'mathBlock') {
      list.push(String(node.attrs.latex ?? ''));
    }
  });
  return list;
}
