import { describe, expect, it } from 'vitest';
import { buildColorPicker, toColorInputValue } from './core';

describe('html-color-picker', () => {
  it('生成 CSS/HTML 片段', () => {
    const r = buildColorPicker('#ff0000');
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    expect(r.value.hex).toBe('#ff0000');
    expect(r.value.cssColor).toBe('color: #ff0000;');
    expect(r.value.htmlInline).toBe('style="color: #ff0000"');
  });

  it('规范 color input', () => {
    expect(toColorInputValue('#AABBCC')).toBe('#aabbcc');
  });

  it('非法色值', () => {
    expect(buildColorPicker('not-a-color')).toEqual({ ok: false, error: 'INVALID' });
  });
});
