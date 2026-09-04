import { describe, expect, it } from 'vitest';
import { normalizeHex, validatePlaceholder } from './core';

describe('placeholder-image', () => {
  it('校验合法参数', () => {
    const r = validatePlaceholder({
      width: 320,
      height: 180,
      bg: '#333',
      fg: '#ffffff',
      text: '',
    });
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    expect(r.value.bg).toBe('#333333');
    expect(r.value.text).toBe('320×180');
  });

  it('非法尺寸', () => {
    expect(
      validatePlaceholder({ width: 8, height: 100, bg: '#000', fg: '#fff', text: '' }),
    ).toEqual({ ok: false, error: 'INVALID_SIZE' });
  });

  it('normalizeHex', () => {
    expect(normalizeHex('#AbC')).toBe('#aabbcc');
    expect(normalizeHex('red')).toBeNull();
  });
});
