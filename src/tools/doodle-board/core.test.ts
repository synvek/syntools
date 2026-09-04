import { describe, expect, it } from 'vitest';
import { clampBrushSize } from './core';

describe('doodle-board', () => {
  it('钳制画笔', () => {
    expect(clampBrushSize(0)).toBe(1);
    expect(clampBrushSize(40)).toBe(32);
    expect(clampBrushSize(8.6)).toBe(9);
  });
});
