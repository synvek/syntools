import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { MenuButton } from './MenuButton';

/**
 * 通用下拉菜单按钮的交互契约：文档头「导入 / 导出」与工具栏下拉共用同一套行为，
 * 这里锁住展开、选择后收起、外部关闭与禁用态。
 */
describe('通用下拉菜单按钮', () => {
  const setup = (props: Partial<Parameters<typeof MenuButton>[0]> = {}) => {
    const onPick = vi.fn();
    render(
      <MenuButton
        label="导出"
        items={[{ key: 'pdf', label: '导出 PDF', onClick: onPick }]}
        {...props}
      />,
    );
    return { onPick };
  };

  it('header 形态展示图标与文字，点击展开菜单', () => {
    setup({ variant: 'header', icon: 'download', tone: 'primary' });
    const trigger = screen.getByRole('button', { name: '导出' });
    expect(trigger.textContent).toContain('导出');
    expect(trigger.getAttribute('aria-expanded')).toBe('false');

    fireEvent.click(trigger);
    expect(trigger.getAttribute('aria-expanded')).toBe('true');
    expect(screen.getByRole('menu')).toBeTruthy();
  });

  it('选中菜单项后执行回调并收起菜单', () => {
    const { onPick } = setup({ variant: 'header' });
    fireEvent.click(screen.getByRole('button', { name: '导出' }));
    fireEvent.click(screen.getByRole('menuitem', { name: '导出 PDF' }));

    expect(onPick).toHaveBeenCalledTimes(1);
    expect(screen.queryByRole('menu')).toBeNull();
  });

  it('按 Esc 或点击面板外部收起菜单', () => {
    setup({ variant: 'header' });

    fireEvent.click(screen.getByRole('button', { name: '导出' }));
    fireEvent.keyDown(document, { key: 'Escape' });
    expect(screen.queryByRole('menu')).toBeNull();

    fireEvent.click(screen.getByRole('button', { name: '导出' }));
    fireEvent.mouseDown(document.body);
    expect(screen.queryByRole('menu')).toBeNull();
  });

  it('禁用时不展开菜单', () => {
    setup({ variant: 'header', disabled: true });
    const trigger = screen.getByRole('button', { name: '导出' });
    expect(trigger).toBeDisabled();

    fireEvent.click(trigger);
    expect(screen.queryByRole('menu')).toBeNull();
  });
});
