import { describe, expect, it } from 'vitest';
import {
  alignAnnotations,
  annotateDiffSides,
  computeLineDiff,
  diffStats,
  inlineCharDiff,
  MAX_DIFF_LENGTH,
  sideStats,
  splitEditorLines,
} from './core';

describe('computeLineDiff', () => {
  it('相同文本全部为 same', () => {
    const r = computeLineDiff('a\nb\n', 'a\nb\n');
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    expect(r.value).toHaveLength(2);
    expect(r.value.every((row) => row.left?.type === 'same' && row.right?.type === 'same')).toBe(
      true,
    );
  });

  it('行修改左右配对展示', () => {
    const r = computeLineDiff('a\nold\nb', 'a\nnew\nb');
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    const mid = r.value[1];
    expect(mid.left).toEqual({ type: 'removed', text: 'old' });
    expect(mid.right).toEqual({ type: 'added', text: 'new' });
  });

  it('新增行只在右侧', () => {
    const r = computeLineDiff('a', 'a\nb');
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    expect(r.value).toHaveLength(2);
    expect(r.value[1].left).toBeNull();
    expect(r.value[1].right).toEqual({ type: 'added', text: 'b' });
  });

  it('删除行只在左侧', () => {
    const r = computeLineDiff('a\nb', 'a');
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    expect(r.value[1].right).toBeNull();
    expect(r.value[1].left).toEqual({ type: 'removed', text: 'b' });
  });

  it('空行差异正确呈现', () => {
    const r = computeLineDiff('a\n\nb', 'a\nb');
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    const removed = r.value.filter((row) => row.left?.type === 'removed');
    expect(removed).toHaveLength(1);
    expect(removed[0].left?.text).toBe('');
  });

  it('修改块行数不一致时用 empty 占位对齐', () => {
    const r = computeLineDiff('a', 'a\nx\ny');
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    const stats = diffStats(r.value);
    expect(stats.added).toBe(2);
    expect(stats.same).toBe(1);
  });

  it('空文本对比', () => {
    expect(computeLineDiff('', '')).toEqual({ ok: true, value: [] });
  });

  it('超过上限拒绝计算', () => {
    const big = 'a'.repeat(MAX_DIFF_LENGTH + 1);
    const r = computeLineDiff(big, '');
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.error).toBe('TOO_LARGE');
  });
});

describe('annotateDiffSides', () => {
  it('按源行注解左右，无对齐空行', () => {
    const r = annotateDiffSides('a\nold\nb', 'a\nnew\nb');
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    expect(r.value.left.map((l) => l.type)).toEqual(['same', 'removed', 'same']);
    expect(r.value.right.map((l) => l.type)).toEqual(['same', 'added', 'same']);
    expect(r.value.left).toHaveLength(3);
    expect(r.value.right).toHaveLength(3);
  });

  it('修改行仅高亮差异字符', () => {
    const r = annotateDiffSides('hello', 'hallo');
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    expect(r.value.left[0].segments).toEqual([
      { text: 'h', type: 'same' },
      { text: 'e', type: 'removed' },
      { text: 'llo', type: 'same' },
    ]);
    expect(r.value.right[0].segments).toEqual([
      { text: 'h', type: 'same' },
      { text: 'a', type: 'added' },
      { text: 'llo', type: 'same' },
    ]);
  });

  it('新增只出现在右侧', () => {
    const r = annotateDiffSides('a', 'a\nb');
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    expect(r.value.left).toEqual([{ text: 'a', type: 'same', segments: [{ text: 'a', type: 'same' }] }]);
    expect(r.value.right).toEqual([
      { text: 'a', type: 'same', segments: [{ text: 'a', type: 'same' }] },
      { text: 'b', type: 'added', segments: [{ text: 'b', type: 'added' }] },
    ]);
  });

  it('sideStats 与 diffStats 一致', () => {
    const sides = annotateDiffSides('a\nold\nc', 'a\nnew\nc\nd');
    const rows = computeLineDiff('a\nold\nc', 'a\nnew\nc\nd');
    expect(sides.ok && rows.ok).toBe(true);
    if (!sides.ok || !rows.ok) return;
    expect(sideStats(sides.value)).toEqual(diffStats(rows.value));
  });
});

describe('inlineCharDiff', () => {
  it('中文差异按字高亮', () => {
    const { left, right } = inlineCharDiff('你好世界', '你好未来');
    expect(left.segments.some((s) => s.type === 'removed' && s.text.includes('世界'))).toBe(true);
    expect(right.segments.some((s) => s.type === 'added' && s.text.includes('未来'))).toBe(true);
    expect(left.segments.find((s) => s.type === 'same')?.text).toBe('你好');
  });
});

describe('splitEditorLines / alignAnnotations', () => {
  it('保留末尾空行', () => {
    expect(splitEditorLines('a\n')).toEqual(['a', '']);
    expect(splitEditorLines('')).toEqual(['']);
  });

  it('注解行数不足时用 fallback 补齐', () => {
    const aligned = alignAnnotations(
      ['a', 'b', 'c'],
      [{ text: 'a', type: 'removed', segments: [{ text: 'a', type: 'removed' }] }],
      'same',
    );
    expect(aligned.map((l) => l.type)).toEqual(['removed', 'same', 'same']);
    expect(aligned[0].segments[0].type).toBe('removed');
  });
});

describe('diffStats', () => {
  it('统计增/删/未变行数', () => {
    const r = computeLineDiff('a\nold\nc', 'a\nnew\nc\nd');
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    expect(diffStats(r.value)).toEqual({ added: 2, removed: 1, same: 2 });
  });
});
