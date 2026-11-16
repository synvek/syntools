import { act, renderHook } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import type { CommentThread } from '../../../core/comments/model';
import type { SheetCommentMap } from '../comments';
import {
  useSheetComments,
  type CommentEngine,
  type UseSheetCommentsOptions,
} from './useSheetComments';

function fakeEngine(overrides: Partial<CommentEngine> = {}): CommentEngine {
  return {
    getActiveSheetId: () => 's1',
    getActiveRange: () => ({ startRow: 2, startColumn: 1 }),
    ...overrides,
  };
}

function setup(overrides: Partial<UseSheetCommentsOptions> = {}) {
  const handleRef = { current: fakeEngine() as CommentEngine | null };
  const onCommit = vi.fn();
  const options: UseSheetCommentsOptions = {
    handleRef,
    fallbackSheetId: () => 's1',
    onCommit,
    anonymousAuthor: '匿名',
    ...overrides,
  };
  const view = renderHook(() => useSheetComments(options));
  return { view, handleRef, onCommit };
}

function threadOf(view: ReturnType<typeof setup>['view'], index = 0): CommentThread {
  return view.result.current.comments.s1[index];
}

describe('useSheetComments', () => {
  it('打开面板时把锚点定在当前选区左上角', () => {
    const { view } = setup();
    act(() => view.result.current.openPanel());
    expect(view.result.current.panelOpen).toBe(true);
    expect(view.result.current.cell).toEqual({ row: 2, col: 1 });
  });

  it('新增：挂在当前表当前格、作者为空时用匿名文案、并显式落盘', () => {
    const { view, onCommit } = setup();
    act(() => view.result.current.openPanel());
    act(() => view.result.current.add('  第一行  '));

    const thread = threadOf(view);
    expect(thread.anchor).toEqual({ kind: 'cell', sheetId: 's1', row: 2, col: 1 });
    expect(thread.comments[0]).toMatchObject({ author: '匿名', body: '第一行' });
    expect(onCommit).toHaveBeenCalledTimes(1);
  });

  it('新增：作者输入被 trim 后使用', () => {
    const { view } = setup();
    act(() => view.result.current.openPanel());
    act(() => view.result.current.setAuthor('  张三 '));
    act(() => view.result.current.add('正文'));
    expect(threadOf(view).comments[0].author).toBe('张三');
  });

  it('没有锚点（面板没打开过）时不建线程，也不落盘', () => {
    const { view, onCommit } = setup();
    act(() => view.result.current.add('孤儿批注'));
    expect(view.result.current.comments).toEqual({});
    expect(onCommit).not.toHaveBeenCalled();
  });

  it('没有活动工作表时不建线程（引擎未就绪且无回落）', () => {
    const { view, onCommit } = setup({
      handleRef: { current: fakeEngine({ getActiveSheetId: () => null }) },
      fallbackSheetId: () => null,
    });
    act(() => view.result.current.openPanel());
    act(() => view.result.current.add('正文'));
    expect(view.result.current.comments).toEqual({});
    expect(onCommit).not.toHaveBeenCalled();
  });

  it('回复与标记已解决只改目标线程', () => {
    const { view, onCommit } = setup();
    act(() => view.result.current.openPanel());
    act(() => view.result.current.add('第一条'));
    const id = threadOf(view).id;
    act(() => view.result.current.reply(id, '跟进'));
    expect(threadOf(view).comments).toHaveLength(2);
    expect(threadOf(view).comments[1].body).toBe('跟进');

    act(() => view.result.current.toggleResolved(id, true));
    expect(threadOf(view).resolved).toBe(true);
    expect(onCommit).toHaveBeenCalledTimes(3);
  });

  it('重复设置同一个已解决状态：不算改动，不落盘', () => {
    const { view, onCommit } = setup();
    act(() => view.result.current.openPanel());
    act(() => view.result.current.add('正文'));
    const id = threadOf(view).id;

    act(() => view.result.current.toggleResolved(id, false));
    expect(onCommit).toHaveBeenCalledTimes(1);

    act(() => view.result.current.toggleResolved(id, true));
    expect(onCommit).toHaveBeenCalledTimes(2);
    act(() => view.result.current.toggleResolved(id, true));
    expect(onCommit).toHaveBeenCalledTimes(2);
  });

  it('删除线程：表上的键一起消失（不留空数组）', () => {
    const { view } = setup();
    act(() => view.result.current.openPanel());
    act(() => view.result.current.add('正文'));
    act(() => view.result.current.remove(threadOf(view).id));
    expect(view.result.current.comments).toEqual({});
  });

  it('删除不存在的线程：空操作，不落盘', () => {
    const { view, onCommit } = setup();
    act(() => view.result.current.openPanel());
    act(() => view.result.current.add('正文'));
    act(() => view.result.current.remove('t_missing'));
    expect(onCommit).toHaveBeenCalledTimes(1);
  });

  it('adoptOnce 只采纳第一次：StrictMode 重建 / 换主题不会覆盖用户新写的批注', () => {
    const { view } = setup();
    const fromSnapshot: SheetCommentMap = { s1: [threadFixture('t1')] };
    let adopted = false;
    act(() => {
      adopted = view.result.current.adoptOnce(fromSnapshot);
    });
    expect(adopted).toBe(true);
    expect(view.result.current.comments).toEqual(fromSnapshot);

    let second = true;
    act(() => {
      second = view.result.current.adoptOnce({});
    });
    expect(second).toBe(false);
    expect(view.result.current.comments).toEqual(fromSnapshot);
  });

  it('reset 无条件替换：换文档时上一份的批注不能留下', () => {
    const { view } = setup();
    act(() => view.result.current.reset({ s1: [threadFixture('old')] }));
    act(() => view.result.current.reset({ s2: [threadFixture('new')] }));
    expect(Object.keys(view.result.current.comments)).toEqual(['s2']);
    // 采纳过的文档再打开另一份，仍然要能替换
    act(() => view.result.current.adoptOnce({ s3: [threadFixture('x')] }));
    expect(Object.keys(view.result.current.comments)).toEqual(['s2']);
  });
});

function threadFixture(id: string): CommentThread {
  return {
    id,
    anchor: { kind: 'cell', sheetId: 's1', row: 0, col: 0 },
    resolved: false,
    comments: [{ id: `${id}-c`, author: 'A', createdAt: 1, body: 'b' }],
  };
}
