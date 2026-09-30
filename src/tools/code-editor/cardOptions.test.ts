import { describe, expect, it } from 'vitest';
import {
  cardBackground,
  cardCssVars,
  cardStyleBlock,
  DEFAULT_CARD_STYLE,
  exportBackgroundCss,
  isHighlightedLine,
  normalizeCardStyle,
  shadowCssOf,
} from './cardOptions';

describe('normalizeCardStyle', () => {
  it('未知枚举回落默认值', () => {
    const style = normalizeCardStyle({
      windowStyle: 'unknown' as never,
      shadow: 'huge' as never,
      background: 'rainbow' as never,
    });
    expect(style.windowStyle).toBe(DEFAULT_CARD_STYLE.windowStyle);
    expect(style.shadow).toBe(DEFAULT_CARD_STYLE.shadow);
    expect(style.background).toBe(DEFAULT_CARD_STYLE.background);
  });

  it('数值钳制到边界并取整', () => {
    const style = normalizeCardStyle({
      padding: 999,
      radius: -5,
      fontSize: 11.6,
      watermarkOpacity: 3,
    });
    expect(style.padding).toBe(128);
    expect(style.radius).toBe(0);
    expect(style.fontSize).toBe(12);
    expect(style.watermarkOpacity).toBe(1);
  });

  it('非法数值回落默认，水印文本截断', () => {
    const style = normalizeCardStyle({
      padding: Number.NaN,
      fontSize: Number.POSITIVE_INFINITY,
      watermarkText: 'x'.repeat(200),
    });
    expect(style.padding).toBe(DEFAULT_CARD_STYLE.padding);
    expect(style.fontSize).toBe(DEFAULT_CARD_STYLE.fontSize);
    expect(style.watermarkText).toHaveLength(60);
  });

  it('反向高亮区间视为未设置', () => {
    expect(normalizeCardStyle({ highlightFrom: 8, highlightTo: 3 }).highlightFrom).toBe(0);
    expect(normalizeCardStyle({ highlightFrom: 2, highlightTo: 5 }).highlightFrom).toBe(2);
    expect(normalizeCardStyle(null).highlightTo).toBe(0);
  });
});

describe('isHighlightedLine', () => {
  it('命中区间按闭区间判定', () => {
    const style = normalizeCardStyle({ highlightFrom: 2, highlightTo: 4 });
    expect(isHighlightedLine(style, 1)).toBe(false);
    expect(isHighlightedLine(style, 2)).toBe(true);
    expect(isHighlightedLine(style, 4)).toBe(true);
    expect(isHighlightedLine(style, 5)).toBe(false);
    expect(isHighlightedLine(DEFAULT_CARD_STYLE, 1)).toBe(false);
  });
});

describe('卡片样式派生', () => {
  it('CSS 变量包含版式与同步后的行高', () => {
    const vars = cardCssVars(normalizeCardStyle({ fontSize: 15, padding: 40, radius: 8 }));
    expect(vars['--ce-card-padding']).toBe('40px');
    expect(vars['--ce-card-radius']).toBe('8px');
    expect(vars['--ce-line-h']).toBe('24px');
    expect(vars['--ce-card-shadow']).toBe(shadowCssOf('soft'));
  });

  it('背景按选项派生，导出底色避免透明', () => {
    const theme = '#1e1e1e';
    expect(cardBackground(normalizeCardStyle({ background: 'theme' }), theme, '#fff')).toEqual({
      backgroundImage: 'none',
      backgroundColor: theme,
    });
    expect(
      cardBackground(normalizeCardStyle({ background: 'transparent' }), theme, '#fff')
        .backgroundColor,
    ).toBe('transparent');
    expect(
      cardBackground(normalizeCardStyle({ background: 'gradient' }), theme, '#fff').backgroundImage,
    ).toContain('linear-gradient');
    expect(
      cardBackground(normalizeCardStyle({ background: 'grid' }), theme, '#fff').backgroundImage,
    ).toContain('repeating-linear-gradient');
    expect(exportBackgroundCss(normalizeCardStyle({ background: 'theme' }), theme, true)).toBe(
      theme,
    );
    expect(
      exportBackgroundCss(normalizeCardStyle({ background: 'transparent' }), theme, true),
    ).not.toBe('transparent');
  });

  it('导出样式块内嵌同样的变量', () => {
    const css = cardStyleBlock(normalizeCardStyle({ fontSize: 14 }));
    expect(css).toContain('--ce-card-font-size: 14px');
    expect(css).toContain('--ce-line-h: 22px');
    expect(css).toContain('.code-card');
  });
});
