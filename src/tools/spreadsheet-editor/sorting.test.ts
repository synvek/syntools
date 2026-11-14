import { describe, expect, it } from 'vitest';
import {
  looksLikeHeader,
  MAX_SORT_KEYS,
  normalizeSortKeys,
  sortBody,
  sortColumns,
} from './sorting';

/**
 * Multi-key sorting rules (P1-5).
 *
 * The engine does the reordering, so what is tested here is the part that can silently corrupt a
 * table: which rows are in the body, and which keys are actually honoured.
 */

const selection = { startRow: 2, startColumn: 1, rows: 10, columns: 4 };

describe('sortBody', () => {
  it('无标题时整段参与排序', () => {
    expect(sortBody(selection, false)).toEqual({ startRow: 2, rows: 10, columns: 4 });
  });

  it('有标题时首行不动，正文从下一行开始', () => {
    expect(sortBody(selection, true)).toEqual({ startRow: 3, rows: 9, columns: 4 });
  });

  it('只有一行（或只有标题）时没有可排序的行', () => {
    expect(sortBody({ ...selection, rows: 1 }, false)).toBeNull();
    expect(sortBody({ ...selection, rows: 1 }, true)).toBeNull();
  });

  it('零列不算有效选区', () => {
    expect(sortBody({ ...selection, columns: 0 }, false)).toBeNull();
  });
});

describe('normalizeSortKeys', () => {
  it('保留顺序与方向', () => {
    expect(
      normalizeSortKeys(
        [
          { column: 2, ascending: false },
          { column: 0, ascending: true },
        ],
        4,
      ),
    ).toEqual([
      { column: 2, ascending: false },
      { column: 0, ascending: true },
    ]);
  });

  it('丢掉越界与非整数键，而不是按错列排序', () => {
    expect(
      normalizeSortKeys(
        [
          { column: -1, ascending: true },
          { column: 9, ascending: true },
          { column: 1.5, ascending: true },
          { column: 2, ascending: false },
        ],
        4,
      ),
    ).toEqual([{ column: 2, ascending: false }]);
  });

  it('同一列重复出现时只取第一次（否则第二次永远不生效）', () => {
    expect(
      normalizeSortKeys(
        [
          { column: 1, ascending: true },
          { column: 1, ascending: false },
        ],
        4,
      ),
    ).toEqual([{ column: 1, ascending: true }]);
  });

  it(`最多保留 ${MAX_SORT_KEYS} 级`, () => {
    expect(
      normalizeSortKeys(
        [
          { column: 0, ascending: true },
          { column: 1, ascending: true },
          { column: 2, ascending: true },
          { column: 3, ascending: true },
        ],
        4,
      ),
    ).toHaveLength(MAX_SORT_KEYS);
  });

  it('一个都不剩时回落到第一列升序，避免空排序', () => {
    expect(normalizeSortKeys([], 4)).toEqual([{ column: 0, ascending: true }]);
    expect(normalizeSortKeys([{ column: 7, ascending: false }], 4)).toEqual([
      { column: 0, ascending: true },
    ]);
  });
});

describe('looksLikeHeader', () => {
  it('文字标题 + 数字数据 = 有标题', () => {
    expect(looksLikeHeader(['名称', '金额'], ['A', 12])).toBe(true);
  });

  it('下方也是文字时不猜标题', () => {
    expect(looksLikeHeader(['名称', '地区'], ['A', '华东'])).toBe(false);
  });

  it('首行含数字时不猜标题', () => {
    expect(looksLikeHeader([2026, '金额'], ['A', 12])).toBe(false);
  });

  it('没有第二行 / 首行全空时不猜标题', () => {
    expect(looksLikeHeader(['名称'], null)).toBe(false);
    expect(looksLikeHeader(['', null], [1, 2])).toBe(false);
  });
});

describe('sortColumns', () => {
  it('用标题文字做标签，空标题回落列字母', () => {
    // 选区从 B 列开始，所以空标题回落到 C / D
    expect(sortColumns(['名称', '', null], 3, 1)).toEqual([
      { index: 0, label: '名称' },
      { index: 1, label: 'C' },
      { index: 2, label: 'D' },
    ]);
  });

  it('无标题时全部用列字母，并尊重起始列', () => {
    expect(sortColumns(null, 2, 3)).toEqual([
      { index: 0, label: 'D' },
      { index: 1, label: 'E' },
    ]);
  });
});
