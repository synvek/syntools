import katex from 'katex';
import type { ToolResult } from '@/core/types';

export {
  CLASSIC_FORMULAS,
  LATEX_CATEGORIES,
  LATEX_CATEGORY_IDS,
  formatSnippetTooltip,
  getClassicFormula,
  getLatexCategory,
  insertAtCursor,
  isLatexCategoryId,
  isLatexExportFormat,
  preferredCursorOffset,
  type ClassicFormula,
  type LatexCategory,
  type LatexExportFormat,
  type LatexSnippet,
} from './snippets';

/**
 * LaTeX 数学公式渲染（KaTeX）。
 */

export type LatexError = 'EMPTY' | 'RENDER';

export interface LatexRenderOptions {
  displayMode: boolean;
  throwOnError?: boolean;
}

export function renderLatex(
  input: string,
  options: LatexRenderOptions,
): ToolResult<string> {
  const src = input.trim();
  if (!src) return { ok: false, error: 'EMPTY' };

  try {
    const html = katex.renderToString(src, {
      displayMode: options.displayMode,
      throwOnError: options.throwOnError ?? true,
      strict: 'ignore',
      output: 'html',
    });
    return { ok: true, value: html };
  } catch (err) {
    return {
      ok: false,
      error: 'RENDER',
      params: {
        message: err instanceof Error ? err.message : String(err),
      },
    };
  }
}

/** 包一层便于复制的 HTML 片段 */
export function wrapLatexHtml(inner: string, displayMode: boolean): string {
  const tag = displayMode ? 'div' : 'span';
  return `<${tag} class="katex-embed">${inner}</${tag}>`;
}

