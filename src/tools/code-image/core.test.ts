import { describe, expect, it } from 'vitest';
import { lineCount } from './core';

describe('code-image', () => {
  it('行数统计', () => {
    expect(lineCount('')).toBe(1);
    expect(lineCount('a')).toBe(1);
    expect(lineCount('a\nb\nc')).toBe(3);
  });
});
