import { describe, expect, it } from 'vitest';
import { applyListDiff, diffList } from './history';

interface Item {
  id: string;
  value: number;
}

const a: Item = { id: 'a', value: 1 };
const b: Item = { id: 'b', value: 2 };
const c: Item = { id: 'c', value: 3 };

describe('结构 diff 历史', () => {
  it('未变更的条目不会进入 diff（引用相等短路）', () => {
    const prev = [a, b, c];
    const next = [a, b, c];
    expect(diffList(prev, next)).toEqual([]);
  });

  it('只记录真正变化的条目', () => {
    const b2: Item = { id: 'b', value: 22 };
    const entries = diffList([a, b, c], [a, b2, c]);
    expect(entries).toHaveLength(1);
    expect(entries[0]).toMatchObject({
      id: 'b',
      prevIndex: 1,
      nextIndex: 1,
      before: b,
      after: b2,
    });
  });

  it('记录新增与删除', () => {
    const d: Item = { id: 'd', value: 4 };
    const added = diffList([a, b], [a, b, d]);
    expect(added).toEqual([{ id: 'd', prevIndex: -1, nextIndex: 2, after: d }]);

    const removed = diffList([a, b, c], [a, c]);
    expect(removed.find((e) => e.id === 'b')).toMatchObject({
      prevIndex: 1,
      nextIndex: -1,
      before: b,
    });
    expect(removed.find((e) => e.id === 'b')?.after).toBeUndefined();
    expect(applyListDiff([a, c], removed, 'undo')).toEqual([a, b, c]);
  });

  it('仅位置变化也会被记录（可还原堆叠顺序）', () => {
    const entries = diffList([a, b, c], [c, a, b]);
    // 三个条目都发生了位移
    expect(entries).toHaveLength(3);
    expect(applyListDiff([c, a, b], entries, 'undo')).toEqual([a, b, c]);
  });

  it('undo 反向应用、redo 正向应用，且能还原顺序', () => {
    const d: Item = { id: 'd', value: 4 };
    const before = [a, b, c];
    const after = [d, a, c];
    const entries = diffList(before, after);

    expect(applyListDiff(after, entries, 'undo')).toEqual(before);
    expect(applyListDiff(before, entries, 'redo')).toEqual(after);
  });

  it('空 diff 返回原数组的浅拷贝', () => {
    const list = [a, b];
    const out = applyListDiff(list, [], 'undo');
    expect(out).toEqual(list);
    expect(out).not.toBe(list);
  });
});
