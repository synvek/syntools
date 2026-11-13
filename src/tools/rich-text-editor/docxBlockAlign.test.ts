import { describe, expect, it } from 'vitest';
import { alignBlocks } from './docxBlockAlign';

/**
 * Block alignment behind every text-based import pass. The interesting cases are the ones where the
 * two sides differ: mammoth adds blocks (table cells), drops blocks (unsupported content), and keeps
 * the rest in order.
 */

const pairs = (left: string[], right: string[]): [number, number][] =>
  [...alignBlocks(left, right).entries()].sort((a, b) => a[0] - b[0]);

describe('alignBlocks', () => {
  it('pairs identical sequences one to one', () => {
    expect(pairs(['一', '二', '三'], ['一', '二', '三'])).toEqual([
      [0, 0],
      [1, 1],
      [2, 2],
    ]);
  });

  it('skips blocks the HTML side added (a table expanded into its own paragraphs)', () => {
    expect(pairs(['一', '二'], ['一', '表格甲', '表格乙', '二'])).toEqual([
      [0, 0],
      [1, 3],
    ]);
  });

  it('skips paragraphs mammoth dropped without shifting the rest', () => {
    expect(pairs(['一', '二', '三'], ['一', '三'])).toEqual([
      [0, 0],
      [2, 1],
    ]);
  });

  it('keeps repeated texts in order instead of pairing the first occurrence twice', () => {
    expect(pairs(['甲', '甲'], ['甲', '甲'])).toEqual([
      [0, 0],
      [1, 1],
    ]);
  });

  it('pairs empty paragraphs with empty blocks', () => {
    expect(pairs(['一', '', '二'], ['一', '', '二'])).toEqual([
      [0, 0],
      [1, 1],
      [2, 2],
    ]);
  });

  it('returns nothing when either side is empty', () => {
    expect(alignBlocks([], ['一']).size).toBe(0);
    expect(alignBlocks(['一'], []).size).toBe(0);
  });
});
