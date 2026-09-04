import { describe, expect, it } from 'vitest';
import {
  DEFAULT_CARD_STYLE,
  normalizeHexColor,
  prepareMarkdownHtml,
  resolveCardStyle,
  toCardCss,
} from './core';

describe('md-to-image', () => {
  it('渲染并消毒标题', () => {
    const r = prepareMarkdownHtml('# Title');
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    expect(r.value).toContain('<h1');
    expect(r.value).toContain('Title');
  });

  it('剥离 script', () => {
    const r = prepareMarkdownHtml('<script>alert(1)</script>\n\nHello');
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    expect(r.value.toLowerCase()).not.toContain('<script');
    expect(r.value).toContain('Hello');
  });

  it('空输入', () => {
    expect(prepareMarkdownHtml('')).toEqual({ ok: false, error: 'EMPTY' });
    expect(prepareMarkdownHtml('   ')).toEqual({ ok: false, error: 'EMPTY' });
  });
});

describe('card style', () => {
  it('normalizeHexColor', () => {
    expect(normalizeHexColor('#abc')).toBe('#aabbcc');
    expect(normalizeHexColor('#112233')).toBe('#112233');
    expect(normalizeHexColor('red')).toBeNull();
  });

  it('默认样式合法且含深色前景', () => {
    const r = resolveCardStyle();
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    expect(r.value.color).toBe('#111827');
    expect(r.value.background).toBe('#ffffff');
    const css = toCardCss(r.value);
    expect(css.color).toBe('#111827');
    expect(css.fontSize).toBe(`${DEFAULT_CARD_STYLE.fontSize}px`);
    expect(css.width).toBe(`${DEFAULT_CARD_STYLE.width}px`);
    expect(css.minWidth).toBe(css.width);
    expect(css.maxWidth).toBe(css.width);
  });

  it('自定义宽度写入 CSS 且不被 100% 覆盖', () => {
    const r = resolveCardStyle({ width: 800 });
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    const css = toCardCss(r.value);
    expect(css.width).toBe('800px');
    expect(css.maxWidth).toBe('800px');
  });

  it('非法颜色 / 尺寸', () => {
    expect(resolveCardStyle({ color: 'nope' }).ok).toBe(false);
    expect(resolveCardStyle({ fontSize: 3 }).ok).toBe(false);
    expect(resolveCardStyle({ width: 10 }).ok).toBe(false);
  });
});
