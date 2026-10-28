import { describe, expect, it } from 'vitest';
import {
  addReply,
  countUnresolved,
  createThread,
  markOrphaned,
  relocateTextAnchor,
  removeEntry,
  setThreadResolved,
  sortThreads,
  textFingerprint,
  threadsForSlide,
  type CommentThread,
} from './model';

const anchor = { kind: 'page', slideId: 's1', x: 10, y: 20 } as const;

function thread(body = '第一条', createdAt = 1000): CommentThread {
  return createThread(anchor, { author: '甲', body, id: `c${createdAt}`, createdAt });
}

describe('createThread', () => {
  it('trims the body and starts unresolved', () => {
    const created = createThread(anchor, { author: '甲', body: '  注意这里  ', createdAt: 5 });
    expect(created.resolved).toBe(false);
    expect(created.comments).toHaveLength(1);
    expect(created.comments[0]).toMatchObject({ author: '甲', body: '注意这里', createdAt: 5 });
  });
});

describe('addReply', () => {
  it('appends an entry', () => {
    const next = addReply(thread(), { author: '乙', body: '收到', createdAt: 2000 });
    expect(next.comments.map((entry) => entry.body)).toEqual(['第一条', '收到']);
  });

  it('ignores empty replies and keeps the reference', () => {
    const current = thread();
    expect(addReply(current, { author: '乙', body: '   ' })).toBe(current);
  });
});

describe('setThreadResolved', () => {
  it('toggles once and is a no-op when unchanged', () => {
    const current = thread();
    const resolved = setThreadResolved(current, true);
    expect(resolved.resolved).toBe(true);
    expect(setThreadResolved(resolved, true)).toBe(resolved);
  });
});

describe('removeEntry', () => {
  it('deletes a reply but drops the thread when the opener goes', () => {
    const replied = addReply(thread(), { author: '乙', body: '回复', id: 'c2', createdAt: 2000 });
    const trimmed = removeEntry(replied, 'c2');
    expect(trimmed?.comments).toHaveLength(1);
    expect(removeEntry(replied, replied.comments[0].id)).toBeNull();
    expect(removeEntry(replied, 'missing')).toBe(replied);
  });
});

describe('countUnresolved / sortThreads', () => {
  it('counts unresolved threads and orders by latest activity', () => {
    const older = thread('旧', 1000);
    const newer = addReply(thread('新', 2000), { author: '乙', body: '补充', createdAt: 3000 });
    const done = setThreadResolved(thread('已解决', 4000), true);

    expect(countUnresolved([older, newer, done])).toBe(2);
    expect(sortThreads([older, newer, done]).map((item) => item.comments[0].body)).toEqual([
      '已解决',
      '新',
      '旧',
    ]);
  });
});

describe('text anchors', () => {
  it('keeps the position while the fingerprint matches', () => {
    const text = '招标文件 第三章';
    const anchorText = {
      kind: 'text',
      docPos: 4,
      fingerprint: textFingerprint(text),
      quote: '第三章',
    } as const;
    expect(relocateTextAnchor(anchorText, text)).toBe(4);
  });

  it('relocates by a unique quote after edits and rejects ambiguous ones', () => {
    const anchorText = { kind: 'text', docPos: 0, fingerprint: 'stale', quote: '投标人' } as const;
    expect(relocateTextAnchor(anchorText, '须知：投标人应当')).toBe(3);
    expect(relocateTextAnchor(anchorText, '投标人甲，投标人乙')).toBeNull();
    expect(relocateTextAnchor(anchorText, '无关内容')).toBeNull();
  });

  it('ignores whitespace differences in fingerprints', () => {
    expect(textFingerprint('a  b\nc')).toBe(textFingerprint(' a b c '));
  });
});

describe('markOrphaned / threadsForSlide', () => {
  it('marks threads whose target disappeared and keeps untouched references', () => {
    const alive = thread('活', 1000);
    const dead = thread('死', 2000);
    const marked = markOrphaned([alive, dead], (item) => item.comments[0].body === '活');
    expect(marked[0]).toBe(alive);
    expect(marked[1].orphaned).toBe(true);
    expect(markOrphaned(marked, (item) => item.comments[0].body === '活')).toBe(marked);
  });

  it('filters slide threads by slide id', () => {
    const other = createThread(
      { kind: 'page', slideId: 's2', x: 0, y: 0 },
      { author: '甲', body: '另一页' },
    );
    expect(threadsForSlide([thread(), other], 's1')).toHaveLength(1);
  });
});
