import { describe, expect, it } from 'vitest';
import {
  CLASSIC_FORMULAS,
  LATEX_CATEGORIES,
  formatSnippetTooltip,
  insertAtCursor,
  preferredCursorOffset,
  renderLatex,
  wrapLatexHtml,
} from './core';

describe('latex-editor', () => {
  it('渲染简单公式', () => {
    const r = renderLatex('E = mc^2', { displayMode: false });
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    expect(r.value).toContain('katex');
  });

  it('非法公式', () => {
    const r = renderLatex('\\frac{1}{', { displayMode: true });
    expect(r.ok).toBe(false);
    if (r.ok) return;
    expect(r.error).toBe('RENDER');
  });

  it('空输入', () => {
    expect(renderLatex('', { displayMode: true })).toEqual({ ok: false, error: 'EMPTY' });
  });

  it('wrapLatexHtml', () => {
    expect(wrapLatexHtml('<span/>', true)).toContain('div');
    expect(wrapLatexHtml('<span/>', false)).toContain('span');
  });

  it('符号库与经典公式非空', () => {
    expect(LATEX_CATEGORIES.length).toBeGreaterThanOrEqual(10);
    for (const cat of LATEX_CATEGORIES) {
      expect(cat.items.length).toBeGreaterThan(0);
      for (const item of cat.items) {
        expect(item.hintZh.length).toBeGreaterThan(0);
        expect(item.hintEn.length).toBeGreaterThan(0);
      }
    }
    expect(CLASSIC_FORMULAS.length).toBeGreaterThan(5);
  });

  it('经典公式可渲染', () => {
    for (const f of CLASSIC_FORMULAS) {
      const r = renderLatex(f.latex, { displayMode: true });
      expect(r.ok, f.id).toBe(true);
    }
  });

  it('insertAtCursor 落入空大括号', () => {
    expect(preferredCursorOffset('\\frac{}{}')).toBe(6);
    const r = insertAtCursor('ab', 1, 1, '\\sqrt{}');
    expect(r.value).toBe('a\\sqrt{}b');
    expect(r.cursor).toBe(1 + preferredCursorOffset('\\sqrt{}'));
  });

  it('formatSnippetTooltip', () => {
    const item = LATEX_CATEGORIES[0].items[0];
    expect(formatSnippetTooltip(item, 'zh-CN')).toContain(item.hintZh);
    expect(formatSnippetTooltip(item, 'zh-CN')).toContain(item.latex);
    expect(formatSnippetTooltip(item, 'en')).toContain(item.hintEn);
  });
});
