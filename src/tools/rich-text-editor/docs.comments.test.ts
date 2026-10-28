import { describe, expect, it } from 'vitest';
import { addCommentReply, toCommentThread, toCommentThreads, type DocComment } from './docs';

/** Rich-text comments exposed through the shared thread model (P1-2) */

function comment(overrides: Partial<DocComment> = {}): DocComment {
  return {
    id: 'c-1',
    quote: '投标人',
    text: '这里改一下',
    author: '甲',
    createdAt: 100,
    resolved: false,
    ...overrides,
  };
}

describe('toCommentThread', () => {
  it('turns the stored comment into a text-anchored thread', () => {
    const thread = toCommentThread(
      comment({ replies: [{ id: 'r-1', author: '乙', createdAt: 200, body: '好' }] }),
    );
    expect(thread.id).toBe('c-1');
    expect(thread.anchor).toMatchObject({ kind: 'text', quote: '投标人' });
    expect(thread.comments.map((entry) => entry.body)).toEqual(['这里改一下', '好']);
    expect(thread.comments[1]).toMatchObject({ author: '乙', createdAt: 200 });
  });

  it('maps a list in order', () => {
    expect(toCommentThreads([comment(), comment({ id: 'c-2' })])).toHaveLength(2);
  });
});

describe('addCommentReply', () => {
  it('appends a reply without mutating the input', () => {
    const comments = [comment()];
    const next = addCommentReply(comments, 'c-1', {
      id: 'r-1',
      author: '乙',
      createdAt: 300,
      body: '已改',
    });
    expect(next).not.toBe(comments);
    expect(comments[0].replies).toBeUndefined();
    expect(next[0].replies).toHaveLength(1);
  });

  it('ignores empty bodies and unknown comment ids', () => {
    const comments = [comment()];
    expect(
      addCommentReply(comments, 'c-1', { id: 'r', author: '', createdAt: 1, body: '  ' }),
    ).toBe(comments);
    expect(
      addCommentReply(comments, 'missing', { id: 'r', author: '', createdAt: 1, body: 'x' }),
    ).toBe(comments);
  });
});
