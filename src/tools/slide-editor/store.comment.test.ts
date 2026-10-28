import { beforeEach, describe, expect, it } from 'vitest';
import { createDoc, createShapeElement } from './model/factory';
import { useSlideStore } from './store';

/** Slide comment threads: anchoring, replies, resolve and delete (P1-2) */

function reset(): void {
  useSlideStore.setState({
    doc: createDoc('comments'),
    slideIndex: 0,
    selection: [],
    past: [],
    future: [],
    report: null,
    pathEditId: null,
    activePathNode: null,
    groupPath: [],
    commentAuthor: '甲',
    activeThreadId: null,
    viewMode: 'normal',
    masterKind: 'master',
    masterIndex: 0,
  });
}

function addRect(): string {
  const element = createShapeElement(useSlideStore.getState().doc, { kind: 'rect', prst: 'rect' });
  element.width = 80;
  element.height = 60;
  useSlideStore.getState().addElement(element);
  return element.id;
}

describe('slide comments', () => {
  beforeEach(reset);

  it('anchors to the selected element', () => {
    const id = addRect();
    useSlideStore.getState().select([id]);
    useSlideStore.getState().addComment('这里要改', '甲');

    const threads = useSlideStore.getState().doc.comments ?? [];
    expect(threads).toHaveLength(1);
    expect(threads[0].anchor).toMatchObject({ kind: 'element', elementId: id, dx: 0.5, dy: 0.5 });
    expect(threads[0].comments[0]).toMatchObject({ author: '甲', body: '这里要改' });
    expect(useSlideStore.getState().activeThreadId).toBe(threads[0].id);
  });

  it('falls back to a page anchor without a selection', () => {
    useSlideStore.getState().addComment('整页看一遍', '乙');
    const thread = (useSlideStore.getState().doc.comments ?? [])[0];
    const doc = useSlideStore.getState().doc;
    expect(thread.anchor).toEqual({
      kind: 'page',
      slideId: doc.slides[0].id,
      x: Math.round(doc.width / 2),
      y: Math.round(doc.height / 2),
    });
  });

  it('replies, resolves and deletes', () => {
    useSlideStore.getState().addComment('问题', '甲');
    const threadId = (useSlideStore.getState().doc.comments ?? [])[0].id;

    useSlideStore.getState().replyComment(threadId, '已修改', '乙');
    let thread = (useSlideStore.getState().doc.comments ?? [])[0];
    expect(thread.comments.map((entry) => entry.body)).toEqual(['问题', '已修改']);

    useSlideStore.getState().setCommentResolved(threadId, true);
    thread = (useSlideStore.getState().doc.comments ?? [])[0];
    expect(thread.resolved).toBe(true);

    useSlideStore.getState().deleteCommentThread(threadId);
    expect(useSlideStore.getState().doc.comments).toEqual([]);
    expect(useSlideStore.getState().activeThreadId).toBeNull();
  });

  it('keeps one undo step per comment action', () => {
    const before = useSlideStore.getState().past.length;
    useSlideStore.getState().addComment('第一步', '甲');
    expect(useSlideStore.getState().past).toHaveLength(before + 1);

    useSlideStore.getState().undo();
    expect(useSlideStore.getState().doc.comments).toEqual([]);
  });

  it('ignores empty bodies and master view', () => {
    useSlideStore.getState().addComment('   ', '甲');
    expect(useSlideStore.getState().doc.comments).toEqual([]);

    useSlideStore.getState().setViewMode('master');
    useSlideStore.getState().addComment('主版批注', '甲');
    expect(useSlideStore.getState().doc.comments).toEqual([]);
  });
});
