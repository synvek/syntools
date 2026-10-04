import { describe, expect, it } from 'vitest';
import { buildSideBySide, buildVersionDiff } from './versionDiff';

/** 版本差异纯逻辑测试：统计、行号、左右对照配对与空状态。 */

describe('buildVersionDiff', () => {
  it('内容一致时标记 identical 且相似度为 1', () => {
    const result = buildVersionDiff('<p>甲</p><p>乙</p>', '<p>甲</p><p>乙</p>');
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.value.identical).toBe(true);
    expect(result.value.similarity).toBe(1);
    expect(result.value.addedLines).toBe(0);
    expect(result.value.removedLines).toBe(0);
    expect(result.value.rows.every((row) => row.kind === 'equal')).toBe(true);
  });

  it('新增一行统计正确且不占用基准行号', () => {
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

  it('删除一行统计正确且不占用当前行号', () => {
    const result = buildVersionDiff('<p>甲</p><p>乙</p>', '<p>乙</p>');
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    const removed = result.value.rows.filter((row) => row.kind === 'delete');
    expect(removed.map((row) => [row.text, row.beforeLine, row.afterLine])).toEqual([
      ['甲', 1, null],
    ]);
    expect(result.value.removedChars).toBe(1);
  });

  it('修改一行的相似度为 0.5（一删一增 / 总行数 4）', () => {
    const result = buildVersionDiff('<p>甲</p><p>乙</p>', '<p>甲</p><p>丙</p>');
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.value.addedLines).toBe(1);
    expect(result.value.removedLines).toBe(1);
    expect(result.value.similarity).toBeCloseTo(0.5, 5);
  });

  it('行号在混合变更下保持连续', () => {
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

  it('一侧为空时全部记为新增', () => {
    const result = buildVersionDiff('', '<p>甲</p><p>乙</p>');
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.value.rows.every((row) => row.kind === 'insert')).toBe(true);
    expect(result.value.beforeLines).toBe(0);
    expect(result.value.afterLines).toBe(2);
  });

  it('两侧都无可对比文本时返回 EMPTY', () => {
    expect(buildVersionDiff('', '')).toEqual({ ok: false, error: 'EMPTY' });
    expect(buildVersionDiff('<p></p>', '<p> </p>')).toEqual({ ok: false, error: 'EMPTY' });
  });
});

describe('buildSideBySide', () => {
  it('连续的删除与插入按序号配对为修改行', () => {
    const diff = buildVersionDiff('<p>a</p><p>b</p>', '<p>x</p><p>y</p>');
    expect(diff.ok).toBe(true);
    if (!diff.ok) return;
    const sides = buildSideBySide(diff.value.rows);
    expect(sides.map((row) => row.kind)).toEqual(['change', 'change']);
    expect(sides[0].left?.text).toBe('a');
    expect(sides[0].right?.text).toBe('x');
  });

  it('一侧多余的行单独成行', () => {
    const diff = buildVersionDiff('<p>a</p>', '<p>x</p><p>y</p>');
    expect(diff.ok).toBe(true);
    if (!diff.ok) return;
    const sides = buildSideBySide(diff.value.rows);
    expect(sides.map((row) => row.kind)).toEqual(['change', 'insert']);
    expect(sides[1].left).toBeNull();
    expect(sides[1].right?.text).toBe('y');
  });

  it('相同行左右复用同一行对象', () => {
    const diff = buildVersionDiff('<p>a</p>', '<p>a</p>');
    expect(diff.ok).toBe(true);
    if (!diff.ok) return;
    const sides = buildSideBySide(diff.value.rows);
    expect(sides).toHaveLength(1);
    expect(sides[0].left).toBe(sides[0].right);
  });

  it('空输入返回空数组', () => {
    expect(buildSideBySide([])).toEqual([]);
  });
});
