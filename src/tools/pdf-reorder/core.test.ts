import { describe, expect, it } from 'vitest';
import { moveIndex } from './core';

describe('pdf-reorder core', () => {
  it('moves indices', () => {
    expect(moveIndex([0, 1, 2], 0, 2)).toEqual([1, 2, 0]);
    expect(moveIndex([0, 1, 2], 2, 0)).toEqual([2, 0, 1]);
    expect(moveIndex([0, 1, 2], -1, 0)).toEqual([0, 1, 2]);
  });
});
