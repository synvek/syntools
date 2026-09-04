import { describe, expect, it } from 'vitest';
import {
  buildBorderRadiusCss,
  buildBoxShadowCss,
  buildCss3ForModule,
  buildFilterCss,
  buildTextShadowCss,
  buildTransformCss,
  buildTransitionCss,
  cssDeclToStyle,
  DEFAULT_BORDER_RADIUS,
  DEFAULT_BOX_SHADOW,
  DEFAULT_FILTER,
  DEFAULT_TEXT_SHADOW,
  DEFAULT_TRANSFORM,
  DEFAULT_TRANSITION,
} from './core';

describe('css3-generator', () => {
  it('border-radius linked / unlinked', () => {
    expect(buildBorderRadiusCss({ ...DEFAULT_BORDER_RADIUS, topLeft: 8 })).toBe(
      'border-radius: 8px;',
    );
    expect(
      buildBorderRadiusCss({
        topLeft: 1,
        topRight: 2,
        bottomRight: 3,
        bottomLeft: 4,
        linked: false,
      }),
    ).toBe('border-radius: 1px 2px 3px 4px;');
  });

  it('box-shadow / text-shadow', () => {
    expect(buildBoxShadowCss(DEFAULT_BOX_SHADOW)).toContain('box-shadow:');
    expect(buildBoxShadowCss({ ...DEFAULT_BOX_SHADOW, inset: true })).toContain('inset');
    expect(buildTextShadowCss(DEFAULT_TEXT_SHADOW)).toContain('text-shadow:');
  });

  it('transform / transition / filter', () => {
    expect(buildTransformCss(DEFAULT_TRANSFORM)).toContain('transform:');
    expect(buildTransitionCss(DEFAULT_TRANSITION)).toBe('transition: all 0.3s ease 0s;');
    expect(buildFilterCss(DEFAULT_FILTER)).toContain('blur(0px)');
  });

  it('buildCss3ForModule + cssDeclToStyle', () => {
    const css = buildCss3ForModule('borderRadius', {
      borderRadius: DEFAULT_BORDER_RADIUS,
      boxShadow: DEFAULT_BOX_SHADOW,
      textShadow: DEFAULT_TEXT_SHADOW,
      transform: DEFAULT_TRANSFORM,
      transition: DEFAULT_TRANSITION,
      filter: DEFAULT_FILTER,
    });
    expect(cssDeclToStyle(css)).toEqual({ borderRadius: '12px' });
  });
});
