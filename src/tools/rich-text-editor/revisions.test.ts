import { Editor } from '@tiptap/core';
import { describe, expect, it } from 'vitest';
import { createExtensions } from './extensions';
import { DEFAULT_PAGE_SETUP, resolvePageMetrics } from './pageSetup';
import { planComparison } from './revisions';
import { findChangeRange } from './marks';
import { anchoredCommentIds } from './docs';

/** P2-3 第二批：比较 → 修订标记（一次事务）→ 接受 / 拒绝 */

function makeEditor(content: string): Editor {
  return new Editor({
    element: document.createElement('div'),
    extensions: createExtensions({
      placeholder: '输入内容…',
      onLayout: () => {},
      getPageMetrics: () => resolvePageMetrics(DEFAULT_PAGE_SETUP),
    }),
    content,
  });
}

/** Compare `before` with `after` and apply the comparison to the editor holding `before` */
function compare(before: string, after: string): { editor: Editor; target: Editor; ids: string[] } {
  const editor = makeEditor(before);
  const target = makeEditor(after);
  const plan = planComparison(editor.state, target.state.doc);
  if (plan) editor.view.dispatch(plan.tr);
  return { editor, target, ids: plan?.entries.map((entry) => entry.id) ?? [] };
}

const text = (editor: Editor): string =>
  editor.state.doc.textBetween(0, editor.state.doc.content.size, '\n').replace(/\s+/g, ' ').trim();

function countMarks(editor: Editor, name: string): number {
  let count = 0;
  editor.state.doc.descendants((node) => {
    if (node.isText && node.marks.some((mark) => mark.type.name === name)) count += 1;
  });
  return count;
}

describe('planComparison', () => {
  it('returns null when the documents are identical', () => {
    const editor = makeEditor('<p>一样</p>');
    const target = makeEditor('<p>一样</p>');
    expect(planComparison(editor.state, target.state.doc)).toBeNull();
    editor.destroy();
    target.destroy();
  });

  it('marks an inserted block instead of silently adding it', () => {
    const { editor, ids } = compare('<p>甲</p><p>丙</p>', '<p>甲</p><p>乙</p><p>丙</p>');
    expect(ids).toHaveLength(1);
    expect(countMarks(editor, 'trackedInsert')).toBe(1);
    const blocks: string[] = [];
    editor.state.doc.forEach((node) => blocks.push(node.textContent));
    expect(blocks).toEqual(['甲', '乙', '丙']);
    editor.destroy();
  });

  it('keeps deleted text with a delete mark', () => {
    const { editor } = compare('<p>甲</p><p>要删的</p>', '<p>甲</p>');
    expect(countMarks(editor, 'trackedDelete')).toBe(1);
    const blocks: string[] = [];
    editor.state.doc.forEach((node) => blocks.push(node.textContent));
    expect(blocks).toEqual(['甲', '要删的']);
    editor.destroy();
  });

  it('splices a one-word rewrite inline and keeps the untouched text unmarked', () => {
    const { editor } = compare('<p>第一段内容。</p>', '<p>第一段正文。</p>');
    expect(countMarks(editor, 'trackedDelete')).toBe(1);
    expect(countMarks(editor, 'trackedInsert')).toBe(1);
    // Deleted tokens are kept (struck through), the new ones sit exactly where the old ones were
    expect(text(editor)).toBe('第一段内容正文。');
    editor.destroy();
  });

  it('records a block-kind change as a format revision and applies the new kind', () => {
    const { editor } = compare('<p>标题</p>', '<h2>标题</h2>');
    const first = editor.state.doc.firstChild;
    expect(first?.type.name).toBe('heading');
    expect(countMarks(editor, 'trackedFormat')).toBe(1);
    editor.destroy();
  });

  it('marks structured blocks as a whole instead of splicing table rows', () => {
    const { editor } = compare(
      '<table><tbody><tr><td>18</td></tr></tbody></table>',
      '<table><tbody><tr><td>20</td></tr></tbody></table>',
    );
    // A structured block cannot be spliced inline: the old table is marked deleted and the new one inserted
    expect(countMarks(editor, 'trackedDelete')).toBe(1);
    expect(countMarks(editor, 'trackedInsert')).toBe(1);
    editor.destroy();
  });
});

describe('accept / reject', () => {
  it('accepting everything leaves exactly the target text', () => {
    const { editor, target } = compare(
      '<p>甲</p><p>要删的</p><p>旧词</p>',
      '<p>甲</p><p>新词</p><p>新增</p>',
    );
    editor.commands.acceptAllTracked();
    expect(text(editor)).toBe(text(target).replace(/\s+/g, ' '));
    editor.destroy();
    target.destroy();
  });

  it('rejecting everything restores the base text', () => {
    const { editor } = compare('<p>甲</p><p>要删的</p>', '<p>甲</p><p>新增</p>');
    editor.commands.rejectAllTracked();
    expect(text(editor)).toBe('甲 要删的');
    editor.destroy();
  });

  it('rejects a single change and leaves the others pending', () => {
    const { editor, ids } = compare('<p>甲</p><p>乙</p>', '<p>甲</p><p>丙</p><p>丁</p>');
    expect(ids.length).toBeGreaterThanOrEqual(2);
    const rejected = editor.commands.rejectTrackedChange(ids[ids.length - 1]);
    expect(rejected).toBe(true);
    // The inserted tail block is gone, the rewritten block is still tracked
    expect(countMarks(editor, 'trackedDelete')).toBe(1);
    expect(countMarks(editor, 'trackedInsert')).toBeGreaterThanOrEqual(1);
    editor.destroy();
  });

  it('treats one comparison as a single undo step', () => {
    const { editor } = compare('<p>甲</p><p>旧词</p>', '<p>甲</p><p>新词</p><p>新增</p>');
    expect(text(editor)).not.toBe('甲 旧词');
    editor.commands.undo();
    // Block insertion, inline tokens and marks all came from one transaction, so one undo removes them
    expect(text(editor)).toBe('甲 旧词');
    expect(countMarks(editor, 'trackedInsert')).toBe(0);
    expect(countMarks(editor, 'trackedDelete')).toBe(0);
    editor.destroy();
  });

  it('restores the previous block kind when a format revision is rejected', () => {
    const { editor, ids } = compare('<p>标题</p>', '<h2>标题</h2>');
    expect(editor.state.doc.firstChild?.type.name).toBe('heading');
    editor.commands.rejectTrackedChange(ids[0]);
    expect(editor.state.doc.firstChild?.type.name).toBe('paragraph');
    expect(countMarks(editor, 'trackedFormat')).toBe(0);
    editor.destroy();
  });
});

describe('revision × comment boundary', () => {
  it('locates the range of a revision by id so the panel can jump to it', () => {
    const { editor, ids } = compare('<p>甲</p>', '<p>甲</p><p>乙</p>');
    const range = findChangeRange(editor.state.doc, ids[0]);
    expect(range).not.toBeNull();
    expect(range && range.to).toBeGreaterThan(range ? range.from : -1);
    // Unknown ids are not an error: the panel may hold an entry whose marks were already merged away
    expect(findChangeRange(editor.state.doc, 'missing')).toBeNull();
    editor.destroy();
  });

  it('loses the comment anchor only when accepting really deletes the commented text', () => {
    const editor = makeEditor('<p>要删的</p><p>保留</p>');
    editor.commands.setTextSelection({ from: 1, to: 4 });
    editor.commands.setComment('c-1');
    expect(anchoredCommentIds(editor.state.doc).has('c-1')).toBe(true);

    const target = makeEditor('<p>保留</p>');
    const plan = planComparison(editor.state, target.state.doc);
    expect(plan).not.toBeNull();
    editor.view.dispatch(plan!.tr);
    // Pending deletion keeps the text (and its anchor): the comment is still reviewable at this point
    expect(anchoredCommentIds(editor.state.doc).has('c-1')).toBe(true);
    editor.commands.acceptAllTracked();
    expect(anchoredCommentIds(editor.state.doc).has('c-1')).toBe(false);
    editor.destroy();
    target.destroy();
  });

  it('keeps the anchor when the change is rejected (text comes back)', () => {
    const editor = makeEditor('<p>旧词</p>');
    editor.commands.setTextSelection({ from: 1, to: 3 });
    editor.commands.setComment('c-2');
    const target = makeEditor('<p>新词</p>');
    const plan = planComparison(editor.state, target.state.doc);
    editor.view.dispatch(plan!.tr);
    editor.commands.rejectAllTracked();
    expect(anchoredCommentIds(editor.state.doc).has('c-2')).toBe(true);
    editor.destroy();
    target.destroy();
  });
});
