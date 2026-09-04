import { describe, expect, it } from 'vitest';
import {
  DEFAULT_BUTTON_OPTIONS,
  buildButtonCss,
  buildButtonHtml,
} from './core';

describe('css-button', () => {
  it('生成含 class 的 CSS', () => {
    const css = buildButtonCss({ ...DEFAULT_BUTTON_OPTIONS, bg: '#111111' });
    expect(css).toContain('.btn {');
    expect(css).toContain('background: #111111;');
    expect(css).toContain('.btn:hover');
  });

  it('HTML 转义标签文本', () => {
    expect(buildButtonHtml({ ...DEFAULT_BUTTON_OPTIONS, label: 'a<b>' })).toBe(
      '<button type="button" class="btn">a&lt;b&gt;</button>',
    );
  });
});
