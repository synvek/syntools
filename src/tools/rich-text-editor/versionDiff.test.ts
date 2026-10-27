import { describe, expect, it } from 'vitest';
import { buildSideBySide, buildVersionDiff } from './versionDiff';

/** Pure-logic version diff tests: stats, line numbers, side-by-side pairing, and empty state. */

describe('buildVersionDiff', () => {
  it('marks identical content and a similarity of 1', () => {
    const result = buildVersionDiff('<p>甲</p><p>乙</p>', '<p>甲</p><p>乙</p>');
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.value.identical).toBe(true);
    expect(result.value.similarity).toBe(1);
    expect(result.value.addedLines).toBe(0);
    expect(result.value.removedLines).toBe(0);
    expect(result.value.rows.every((row) => row.kind === 'equal')).toBe(true);
  });

  it('counts an added line correctly without consuming a base line number', () => {
    const result = buildVersionDiff('<p>甲</p>', '<p>甲</p><p>乙</p>');
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    const inserted = result.value.rows.filter((row) => row.kind === 'insert');
    expect(inserted.map((row) => [row.text, row.beforeLine, row.afterLine])).toEqual([
      ['乙', null, 2],
    ]);
    expect(result.value.addedChars).toBe(1);
    expect(result.value.identical).toBe(false);
  });

  it('counts a deleted line correctly without consuming a current line number', () => {
    const result = buildVersionDiff('<p>甲</p><p>乙</p>', '<p>乙</p>');
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    const removed = result.value.rows.filter((row) => row.kind === 'delete');
    expect(removed.map((row) => [row.text, row.beforeLine, row.afterLine])).toEqual([
      ['甲', 1, null],
    ]);
    expect(result.value.removedChars).toBe(1);
  });

  it('reports 0.5 similarity for a modified line (one delete plus one insert over 4 lines)', () => {
    const result = buildVersionDiff('<p>甲</p><p>乙</p>', '<p>甲</p><p>丙</p>');
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.value.addedLines).toBe(1);
    expect(result.value.removedLines).toBe(1);
    expect(result.value.similarity).toBeCloseTo(0.5, 5);
  });

  it('keeps line numbers contiguous under mixed changes', () => {
    const result = buildVersionDiff('<p>a</p><p>b</p><p>c</p>', '<p>a</p><p>x</p><p>c</p>');
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(
      result.value.rows.map((row) => [row.kind, row.text, row.beforeLine, row.afterLine]),
    ).toEqual([
      ['equal', 'a', 1, 1],
      ['delete', 'b', 2, null],
      ['insert', 'x', null, 2],
      ['equal', 'c', 3, 3],
    ]);
  });

  it('treats everything as added when one side is empty', () => {
    const result = buildVersionDiff('', '<p>甲</p><p>乙</p>');
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.value.rows.every((row) => row.kind === 'insert')).toBe(true);
    expect(result.value.beforeLines).toBe(0);
    expect(result.value.afterLines).toBe(2);
  });

  it('returns EMPTY when neither side has comparable text', () => {
    expect(buildVersionDiff('', '')).toEqual({ ok: false, error: 'EMPTY' });
    expect(buildVersionDiff('<p></p>', '<p> </p>')).toEqual({ ok: false, error: 'EMPTY' });
  });
});

describe('buildSideBySide', () => {
  it('pairs consecutive deletes and inserts by index as modified rows', () => {
    const diff = buildVersionDiff('<p>a</p><p>b</p>', '<p>x</p><p>y</p>');
    expect(diff.ok).toBe(true);
    if (!diff.ok) return;
    const sides = buildSideBySide(diff.value.rows);
    expect(sides.map((row) => row.kind)).toEqual(['change', 'change']);
    expect(sides[0].left?.text).toBe('a');
    expect(sides[0].right?.text).toBe('x');
  });

  it('keeps leftover rows on one side as standalone rows', () => {
    const diff = buildVersionDiff('<p>a</p>', '<p>x</p><p>y</p>');
    expect(diff.ok).toBe(true);
    if (!diff.ok) return;
    const sides = buildSideBySide(diff.value.rows);
    expect(sides.map((row) => row.kind)).toEqual(['change', 'insert']);
    expect(sides[1].left).toBeNull();
    expect(sides[1].right?.text).toBe('y');
  });

  it('reuses the same row object for unchanged lines on both sides', () => {
    const diff = buildVersionDiff('<p>a</p>', '<p>a</p>');
    expect(diff.ok).toBe(true);
    if (!diff.ok) return;
    const sides = buildSideBySide(diff.value.rows);
    expect(sides).toHaveLength(1);
    expect(sides[0].left).toBe(sides[0].right);
  });

  it('returns an empty array for empty input', () => {
    expect(buildSideBySide([])).toEqual([]);
  });
});
