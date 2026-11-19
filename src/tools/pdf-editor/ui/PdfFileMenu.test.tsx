import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { i18n } from '@/core/i18n';
import { registerPdfEditorStrings } from '../strings';
import type { RibbonMenuItem } from '@/core/components/ribbon/types';
import { PdfFileMenu } from './PdfFileMenu';

registerPdfEditorStrings(i18n);

const items = (onSelect = vi.fn()): RibbonMenuItem[] => [
  { id: 'open', label: '打开…', icon: 'file', onSelect },
  { id: 'save', label: '保存', icon: 'download', separatorBefore: true, onSelect },
  { id: 'docx', label: '导出 Word', icon: 'text', onSelect },
];

describe('PdfFileMenu', () => {
  it('撤销/重做按历史状态禁用', () => {
    const onUndo = vi.fn();
    const onRedo = vi.fn();
    render(<PdfFileMenu canUndo={false} canRedo onUndo={onUndo} onRedo={onRedo} items={items()} />);

    expect(screen.getByTestId('pdf-qat-undo')).toBeDisabled();
    expect(screen.getByTestId('pdf-qat-redo')).toBeEnabled();

    fireEvent.click(screen.getByTestId('pdf-qat-redo'));
    expect(onRedo).toHaveBeenCalledTimes(1);
    fireEvent.click(screen.getByTestId('pdf-qat-undo'));
    expect(onUndo).not.toHaveBeenCalled();
  });

  it('⋯ 打开文件菜单，分隔线与命令顺序正确', () => {
    const onSelect = vi.fn();
    render(
      <PdfFileMenu canUndo canRedo onUndo={vi.fn()} onRedo={vi.fn()} items={items(onSelect)} />,
    );

    expect(screen.queryByRole('menu')).toBeNull();
    fireEvent.click(screen.getByTestId('pdf-file-menu'));

    const menu = screen.getByRole('menu');
    expect(menu).toBeInTheDocument();
    expect(screen.getAllByRole('menuitem').map((item) => item.textContent)).toEqual([
      '打开…',
      '保存',
      '导出 Word',
    ]);
    expect(screen.getAllByRole('separator')).toHaveLength(1);

    fireEvent.click(screen.getByRole('menuitem', { name: '保存' }));
    expect(onSelect).toHaveBeenCalledTimes(1);
    expect(screen.queryByRole('menu')).toBeNull();
  });

  it('Esc 关闭菜单', () => {
    render(<PdfFileMenu canUndo canRedo onUndo={vi.fn()} onRedo={vi.fn()} items={items()} />);
    fireEvent.click(screen.getByTestId('pdf-file-menu'));
    expect(screen.getByRole('menu')).toBeInTheDocument();
    fireEvent.keyDown(window, { key: 'Escape' });
    expect(screen.queryByRole('menu')).toBeNull();
  });
});
