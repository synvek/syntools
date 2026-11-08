import { Editor } from '@tiptap/core';
import { afterEach, describe, expect, it } from 'vitest';
import { createExtensions } from './extensions';
import { DEFAULT_PAGE_SETUP, resolvePageMetrics } from './pageSetup';
import { dirtyBlockRange, incrementalItems } from './PageView';

/** Incremental pagination (implementation plan P1-5): which blocks changed, and how they are re-measured. */

let editor: Editor | null = null;

function makeEditor(content: string): Editor {
  const created = new Editor({
    element: document.createElement('div'),
    extensions: createExtensions({
      placeholder: '输入内容…',
      onLayout: () => {},
      getPageMetrics: () => resolvePageMetrics(DEFAULT_PAGE_SETUP),
    }),
    content,
  });
  editor = created;
  return created;
}

afterEach(() => {
  editor?.destroy();
  editor = null;
});

const geometry = (top: number, height: number) => ({ top, height });

/** Five 100px blocks, no margins: tops are 0 / 100 / 200 / 300 / 400 */
const STACK = [0, 1, 2, 3, 4].map((index) => geometry(index * 100, 100));

describe('dirtyBlockRange', () => {
  it('narrows a text edit to the paragraph it happened in', () => {
    const instance = makeEditor('<p>一</p><p>二</p><p>三</p>');
    const before = instance.state.doc;
    instance.view.dispatch(instance.state.tr.insertText('改', 4));
    expect(dirtyBlockRange(before, instance.state.doc)).toEqual({ first: 1, last: 1 });
  });

  it('sees a mark change, which moves no text but rewraps lines', () => {
    const instance = makeEditor('<p>甲乙丙</p><p>丁戊己</p><p>庚辛壬</p>');
    const before = instance.state.doc;
    instance.view.dispatch(instance.state.tr.addMark(6, 8, instance.schema.marks.bold.create()));
    expect(dirtyBlockRange(before, instance.state.doc)).toEqual({ first: 1, last: 1 });
  });

  it('reports every changed block as one inclusive range', () => {
    const instance = makeEditor('<p>一</p><p>二</p><p>三</p><p>四</p>');
    const before = instance.state.doc;
    instance.view.dispatch(instance.state.tr.insertText('改', 4));
    instance.view.dispatch(instance.state.tr.insertText('改', 11));
    expect(dirtyBlockRange(before, instance.state.doc)).toEqual({ first: 1, last: 3 });
  });

  it('gives up on a block count change or an identical document', () => {
    const instance = makeEditor('<p>一</p><p>二</p>');
    const before = instance.state.doc;
    // Adding a block invalidates the index alignment: the caller must measure everything
    const paragraph = instance.schema.nodes.paragraph.create();
    instance.view.dispatch(instance.state.tr.insert(3, paragraph));
    expect(dirtyBlockRange(before, instance.state.doc)).toBe('all');
    // Identical documents carry no usable block-level detail (the caller short-circuits before this)
    expect(dirtyBlockRange(instance.state.doc, instance.state.doc)).toBe('all');
  });
});

describe('incrementalItems', () => {
  it('re-reads the changed block and shifts everything below it', () => {
    // Block 2 grew by 30px: blocks 3+ keep their height, only their top moves
    const measured = new Map([
      [1, geometry(100, 100)],
      [2, geometry(200, 130)],
      [3, geometry(330, 100)],
      [4, geometry(430, 100)],
    ]);
    expect(incrementalItems(STACK, measured, { first: 2, last: 2 })).toEqual([
      geometry(0, 100),
      geometry(100, 100),
      geometry(200, 130),
      geometry(330, 100),
      geometry(430, 100),
    ]);
  });

  it('handles a change in the first block and in the last block', () => {
    expect(
      incrementalItems(
        STACK,
        new Map([
          [0, geometry(0, 60)],
          [1, geometry(60, 100)],
          [4, geometry(360, 100)],
        ]),
        { first: 0, last: 0 },
      ),
    ).toEqual([
      geometry(0, 60),
      geometry(60, 100),
      geometry(160, 100),
      geometry(260, 100),
      geometry(360, 100),
    ]);
    // Editing the last block leaves nothing to shift
    expect(
      incrementalItems(
        STACK,
        new Map([
          [3, geometry(300, 100)],
          [4, geometry(400, 40)],
        ]),
        { first: 4, last: 4 },
      ),
    ).toEqual([...STACK.slice(0, 4), geometry(400, 40)]);
  });

  it('keeps gaps inside a multi-block range exact', () => {
    // Two paragraphs changed, the second one is taller: the anchor (index 3) reports the real shift
    const measured = new Map([
      [0, geometry(0, 100)],
      [1, geometry(100, 120)],
      [2, geometry(220, 90)],
      [3, geometry(310, 100)],
      [4, geometry(410, 100)],
    ]);
    expect(incrementalItems(STACK, measured, { first: 1, last: 2 })).toEqual([
      geometry(0, 100),
      geometry(100, 120),
      geometry(220, 90),
      geometry(310, 100),
      geometry(410, 100),
    ]);
  });

  it('refuses when the cached geometry above the change is stale', () => {
    // A late image load pushed the guard block down: everything above must be measured again
    const measured = new Map([
      [1, geometry(140, 100)],
      [2, geometry(240, 130)],
      [3, geometry(370, 100)],
      [4, geometry(470, 100)],
    ]);
    expect(incrementalItems(STACK, measured, { first: 2, last: 2 })).toBeNull();
    // ...or when the guard itself resized
    const resizedGuard = new Map([
      [1, geometry(100, 180)],
      [2, geometry(280, 130)],
      [3, geometry(410, 100)],
      [4, geometry(510, 100)],
    ]);
    expect(incrementalItems(STACK, resizedGuard, { first: 2, last: 2 })).toBeNull();
  });

  it('refuses when a block outside the range resized', () => {
    const measured = new Map([
      [1, geometry(100, 100)],
      [2, geometry(200, 130)],
      [3, geometry(330, 100)],
      // Predicted 430: the last block says something below the anchor moved by 15px
      [4, geometry(445, 100)],
    ]);
    expect(incrementalItems(STACK, measured, { first: 2, last: 2 })).toBeNull();
  });

  it('refuses when a probe is missing or the cache is empty', () => {
    expect(incrementalItems([], new Map(), { first: 0, last: 0 })).toBeNull();
    expect(
      incrementalItems(STACK, new Map([[1, geometry(100, 100)]]), { first: 2, last: 2 }),
    ).toBeNull();
  });
});
