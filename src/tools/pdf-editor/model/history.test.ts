import { describe, expect, it } from 'vitest';
import { createDoc, isDirty, touch } from './doc';
import {
  canRedo,
  canUndo,
  createHistory,
  currentDoc,
  MERGE_WINDOW_MS,
  record,
  redo,
  redoDepth,
  resetHistory,
  syncPresent,
  undo,
  undoDepth,
} from './history';
import type { PdfEditorDoc, PdfSource } from './types';

const source: PdfSource = {
  bytes: new Uint8Array([1, 2, 3]),
  pageCount: 2,
  encrypted: false,
  fingerprint: 'fp-history',
};

/** Fresh document object per revision so identity assertions stay meaningful */
const docAt = (revision: number): PdfEditorDoc => ({
  ...createDoc({ name: 'a.pdf', source, id: 'doc-h', now: 0 }),
  revision,
  updatedAt: revision,
});

describe('createHistory', () => {
  it('初始没有可撤销/可重做步骤', () => {
    const doc = docAt(0);
    const history = createHistory(doc, { now: 10 });

    expect(canUndo(history)).toBe(false);
    expect(canRedo(history)).toBe(false);
    expect(currentDoc(history)).toBe(doc);
    expect(history.present.label).toBe('open');
    expect(history.present.at).toBe(10);
    expect(undoDepth(history)).toBe(0);
    expect(redoDepth(history)).toBe(0);
  });
});

describe('record / undo / redo', () => {
  it('记录内容变更并入栈', () => {
    const d0 = docAt(0);
    const d1 = docAt(1);
    const history = record(createHistory(d0), d1, { label: '添加文本', at: 100 });

    expect(undoDepth(history)).toBe(1);
    expect(canUndo(history)).toBe(true);
    expect(currentDoc(history)).toBe(d1);
    expect(history.present.label).toBe('添加文本');
  });

  it('reducer 无变化（同一对象）时不入栈', () => {
    const d0 = docAt(0);
    const history = createHistory(d0);
    expect(record(history, d0, { label: 'noop' })).toBe(history);
  });

  it('撤销与重做恢复快照', () => {
    const d0 = docAt(0);
    const d1 = docAt(1);
    const d2 = docAt(2);
    const history = record(record(createHistory(d0), d1, { label: 'a', at: 1 }), d2, {
      label: 'b',
      at: 2,
    });

    const backOnce = undo(history);
    expect(currentDoc(backOnce)).toBe(d1);
    expect(redoDepth(backOnce)).toBe(1);

    const backTwice = undo(backOnce);
    expect(currentDoc(backTwice)).toBe(d0);
    expect(canUndo(backTwice)).toBe(false);

    const forward = redo(backTwice);
    expect(currentDoc(forward)).toBe(d1);

    const top = redo(forward);
    expect(currentDoc(top)).toBe(d2);
    // 到顶后重做是空操作
    expect(redo(top)).toBe(top);
  });

  it('栈底撤销 / 栈顶重做是空操作（返回原对象）', () => {
    const history = createHistory(docAt(0));
    expect(undo(history)).toBe(history);
    expect(redo(history)).toBe(history);
  });

  it('新记录清空重做栈', () => {
    const history = record(createHistory(docAt(0)), docAt(1), { label: 'a', at: 1 });
    const undone = undo(history);
    expect(canRedo(undone)).toBe(true);

    const branched = record(undone, docAt(1), { label: 'b', at: 2 });
    expect(canRedo(branched)).toBe(false);
  });
});

describe('拖动合并（mergeKey）', () => {
  const base = () => createHistory(docAt(0), { now: 0 });

  it('同一 mergeKey 且窗口内合并为一步', () => {
    const first = record(base(), docAt(1), { label: '拖动', mergeKey: 'obj-1:move', at: 100 });
    const second = record(first, docAt(2), {
      label: '拖动',
      mergeKey: 'obj-1:move',
      at: 100 + MERGE_WINDOW_MS,
    });

    expect(undoDepth(second)).toBe(1);
    expect(currentDoc(second).revision).toBe(2);
    expect(currentDoc(undo(second)).revision).toBe(0);
  });

  it('超出窗口后拆成两步', () => {
    const first = record(base(), docAt(1), { label: '拖动', mergeKey: 'obj-1:move', at: 100 });
    const later = record(first, docAt(2), {
      label: '拖动',
      mergeKey: 'obj-1:move',
      at: 100 + MERGE_WINDOW_MS + 1,
    });

    expect(undoDepth(later)).toBe(2);
  });

  it('不同 mergeKey 不合并', () => {
    const first = record(base(), docAt(1), { label: '拖动', mergeKey: 'obj-1:move', at: 100 });
    const other = record(first, docAt(2), { label: '拖动', mergeKey: 'obj-2:move', at: 110 });
    expect(undoDepth(other)).toBe(2);
  });

  it('没有 mergeKey 时永不合并', () => {
    const first = record(base(), docAt(1), { label: 'a', at: 100 });
    const second = record(first, docAt(2), { label: 'a', at: 101 });
    expect(undoDepth(second)).toBe(2);
  });

  it('合并时保留合并前的撤销目标', () => {
    const d0 = docAt(0);
    const first = record(createHistory(d0), docAt(1), { label: '拖动', mergeKey: 'k', at: 10 });
    const merged = record(first, docAt(2), { label: '拖动', mergeKey: 'k', at: 20 });

    expect(currentDoc(undo(merged))).toBe(d0);
  });
});

describe('步数上限', () => {
  it('默认上限 50 步，超出丢弃最旧', () => {
    let history = createHistory(docAt(0));
    for (let index = 1; index <= 60; index += 1) {
      history = record(history, docAt(index), { label: `step ${index}`, at: index });
    }

    expect(undoDepth(history)).toBe(50);

    let current = history;
    for (let index = 0; index < 50; index += 1) current = undo(current);
    expect(undoDepth(current)).toBe(0);
    // 最旧的 10 步已经丢弃，撤销到底停在 revision 10
    expect(currentDoc(current).revision).toBe(10);
    expect(undo(current)).toBe(current);
  });

  it('自定义更小的上限', () => {
    let history = createHistory(docAt(0), { limit: 2 });
    history = record(history, docAt(1), { label: 'a', at: 1 });
    history = record(history, docAt(2), { label: 'b', at: 2 });
    history = record(history, docAt(3), { label: 'c', at: 3 });
    expect(undoDepth(history)).toBe(2);
  });
});

describe('syncPresent（视图/保存状态）', () => {
  it('替换当前快照但不增加撤销步数', () => {
    const d0 = docAt(0);
    const d1 = docAt(1);
    const history = record(createHistory(d0), d1, { label: 'a', at: 1 });

    const zoomed: PdfEditorDoc = { ...d1, view: { ...d1.view, zoom: 2 } };
    const synced = syncPresent(history, zoomed);

    expect(undoDepth(synced)).toBe(1);
    expect(currentDoc(synced)).toBe(zoomed);
    expect(currentDoc(undo(synced))).toBe(d0);
    expect(currentDoc(redo(undo(synced)))).toBe(zoomed);
  });

  it('同一对象时返回原 history', () => {
    const history = createHistory(docAt(0));
    expect(syncPresent(history, currentDoc(history))).toBe(history);
  });
});

describe('撤销与脏状态', () => {
  it('撤销回已保存状态时 dirty 消失', () => {
    const clean = createDoc({ name: 'a.pdf', source, id: 'doc-clean', now: 0 });
    const dirty = touch(clean);
    const history = record(createHistory(clean), dirty, { label: 'rotate', at: 1 });

    expect(isDirty(currentDoc(history))).toBe(true);
    expect(isDirty(currentDoc(undo(history)))).toBe(false);
  });

  it('resetHistory 清空两侧并保留上限', () => {
    let history = createHistory(docAt(0), { limit: 7 });
    history = record(history, docAt(1), { label: 'a', at: 1 });
    history = undo(history);
    expect(canRedo(history)).toBe(true);

    const next = docAt(5);
    const reset = resetHistory(history, next, 99);
    expect(canUndo(reset)).toBe(false);
    expect(canRedo(reset)).toBe(false);
    expect(currentDoc(reset)).toBe(next);
    expect(reset.limit).toBe(7);
    expect(reset.present.at).toBe(99);
  });
});
