import { fireEvent, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import type { Editor } from '@tiptap/react';

afterEach(() => vi.restoreAllMocks());

vi.mock('react-i18next', () => ({
  useTranslation: () => ({ t: (key: string) => key }),
}));

import { EditorContextMenu, type EditorContextTarget } from './EditorContextMenu';

/** 记录链式命令调用顺序的编辑器替身（只覆盖菜单会用到的命令） */
function stubEditor(selection = { from: 0, to: 0 }) {
  const calls: string[] = [];
  const chain: Record<string, unknown> = {};
  for (const name of [
    'focus',
    'setTextSelection',
    'extendMarkRange',
    'setLink',
    'unsetLink',
    'toggleBold',
    'toggleItalic',
    'toggleUnderline',
    'toggleStrike',
    'toggleHighlight',
    'unsetAllMarks',
    'selectAll',
    'insertContent',
    'setNodeSelection',
    'deleteSelection',
  ]) {
    chain[name] = (...args: unknown[]) => {
      calls.push(`${name}(${args.map((arg) => JSON.stringify(arg)).join(',')})`);
      return chain;
    };
  }
  chain.run = () => {
    calls.push('run');
    return true;
  };
  const editor = {
    chain: () => chain,
    isActive: () => false,
    state: {
      selection,
      // 位置 5 处放一个图片节点，用于验证「删除图片」的目标校验
      doc: { nodeAt: (pos: number) => (pos === 5 ? { type: { name: 'image' } } : null) },
    },
  } as unknown as Editor;
  return { editor, calls };
}

function setup(target: EditorContextTarget, selection = { from: 0, to: 0 }) {
  const { editor, calls } = stubEditor(selection);
  const onClose = vi.fn();
  render(<EditorContextMenu editor={editor} target={target} onClose={onClose} />);
  return { calls, onClose };
}

const linkTarget: EditorContextTarget = {
  x: 120,
  y: 160,
  kind: 'link',
  href: 'https://example.com/a',
};

describe('编辑区右键菜单', () => {
  it('在链接上给出查看 / 编辑 / 移除入口', () => {
    setup(linkTarget, { from: 3, to: 12 });
    expect(screen.getByRole('menu')).toBeTruthy();
    for (const key of ['openLink', 'copyLink', 'editLink', 'removeLink']) {
      expect(screen.getByRole('menuitem', { name: `tools.richText.${key}` })).toBeTruthy();
    }
  });

  it('移除链接：解除整段链接并关闭菜单', () => {
    const { calls, onClose } = setup(linkTarget, { from: 3, to: 12 });
    fireEvent.click(screen.getByRole('menuitem', { name: 'tools.richText.removeLink' }));

    expect(onClose).toHaveBeenCalled();
    expect(calls).toContain('extendMarkRange("link")');
    expect(calls).toContain('unsetLink()');
  });

  it('编辑链接：输入新地址后应用到链接 mark，且输入过程中不再全选', () => {
    const selectSpy = vi.spyOn(HTMLInputElement.prototype, 'select');
    const { calls, onClose } = setup(linkTarget, { from: 3, to: 12 });
    fireEvent.click(screen.getByRole('menuitem', { name: 'tools.richText.editLink' }));

    const input = screen.getByRole('textbox');
    expect(input).toHaveValue('https://example.com/a');
    // 进入输入态时全选一次，便于直接覆盖旧地址
    expect(selectSpy).toHaveBeenCalledTimes(1);

    // 回归：逐字输入期间不能再触发全选，否则下一个字母会把已输入内容整段替换
    fireEvent.change(input, { target: { value: 'https://example.org' } });
    fireEvent.change(input, { target: { value: 'https://example.org/b' } });
    expect(selectSpy).toHaveBeenCalledTimes(1);

    fireEvent.click(screen.getByRole('button', { name: 'tools.richText.apply' }));

    expect(calls).toContain('extendMarkRange("link")');
    expect(calls).toContain('setLink({"href":"https://example.org/b"})');
    expect(onClose).toHaveBeenCalled();
  });

  it('插入链接：为空时清除选中文本上的链接', () => {
    const { calls } = setup({ x: 10, y: 10, kind: 'text' }, { from: 2, to: 6 });
    fireEvent.click(screen.getByRole('menuitem', { name: 'tools.richText.insertLink' }));
    fireEvent.click(screen.getByRole('button', { name: 'tools.richText.apply' }));

    expect(calls).toContain('setTextSelection({"from":2,"to":6})');
    expect(calls).toContain('unsetLink()');
  });

  it('选中文本时给出编辑动作，未选中时只给粘贴 / 全选', () => {
    setup({ x: 10, y: 10, kind: 'text' }, { from: 2, to: 6 });
    expect(screen.getByRole('menuitem', { name: 'tools.richText.cut' })).toBeTruthy();
    expect(screen.getByRole('menuitem', { name: 'common.copy' })).toBeTruthy();
    expect(screen.getByRole('menuitem', { name: 'tools.richText.clearFormat' })).toBeTruthy();
    expect(screen.getByRole('menuitem', { name: 'tools.richText.insertLink' })).toBeTruthy();
  });

  it('未选中文本时剪切 / 复制不可用，且不提供插入链接', () => {
    setup({ x: 10, y: 10, kind: 'empty' });
    expect(screen.getByRole('menuitem', { name: 'tools.richText.cut' })).toBeDisabled();
    expect(screen.getByRole('menuitem', { name: 'common.copy' })).toBeDisabled();
    expect(screen.queryByRole('menuitem', { name: 'tools.richText.insertLink' })).toBeNull();
    expect(screen.getByRole('menuitem', { name: 'tools.richText.selectAll' })).toBeTruthy();
  });

  it('图片上提供删除，且只删除仍指向图片的节点', () => {
    const { calls } = setup({ x: 10, y: 10, kind: 'image', imagePos: 5 });
    fireEvent.click(screen.getByRole('menuitem', { name: 'tools.richText.deleteImage' }));
    expect(calls).toContain('setNodeSelection(5)');
    expect(calls).toContain('deleteSelection()');
  });
});
