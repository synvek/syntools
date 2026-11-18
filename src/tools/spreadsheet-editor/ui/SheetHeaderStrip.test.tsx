import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { SheetHeaderStrip, type SheetHeaderStripProps } from './SheetHeaderStrip';

vi.mock('react-i18next', () => ({
  useTranslation: () => ({
    t: (key: string, options?: Record<string, unknown>) =>
      options && 'count' in options ? `${key}:${String(options.count)}` : key,
  }),
}));

function makeProps(overrides: Partial<SheetHeaderStripProps> = {}): SheetHeaderStripProps {
  return {
    protectedSheet: false,
    tableCount: 0,
    draftSaved: true,
    statusText: '已保存',
    title: '工作簿',
    onTitleChange: vi.fn(),
    clearDisabled: false,
    onClear: vi.fn(),
    onNewDoc: vi.fn(),
    onPresent: vi.fn(),
    ...overrides,
  };
}

describe('SheetHeaderStrip', () => {
  it('未保护、无表格时只有保存状态与三个动作，不额外占位', () => {
    render(<SheetHeaderStrip {...makeProps()} />);

    expect(screen.queryByTestId('sheet-protected-badge')).toBeNull();
    expect(screen.queryByTestId('sheet-table-badge')).toBeNull();
    expect(screen.getByTitle('已保存')).toBeTruthy();
  });

  it('受保护时出现锁徽标，读屏听到的是完整说明', () => {
    render(<SheetHeaderStrip {...makeProps({ protectedSheet: true })} />);

    const badge = screen.getByTestId('sheet-protected-badge');
    expect(badge).toHaveAttribute('aria-label', 'tools.sheet.protectLockedNotice');
  });

  it('活动表有表格时徽标显示数量，0 时不渲染', () => {
    const { rerender } = render(<SheetHeaderStrip {...makeProps({ tableCount: 3 })} />);

    expect(screen.getByTestId('sheet-table-badge')).toHaveTextContent('3');
    expect(screen.getByTestId('sheet-table-badge')).toHaveAttribute(
      'aria-label',
      'tools.sheet.tableBadge:3',
    );

    rerender(<SheetHeaderStrip {...makeProps({ tableCount: 0 })} />);
    expect(screen.queryByTestId('sheet-table-badge')).toBeNull();
  });

  it('标题是受控输入：每个字符都上报，不在组件里留草稿', () => {
    const onTitleChange = vi.fn();
    render(<SheetHeaderStrip {...makeProps({ onTitleChange })} />);

    fireEvent.change(screen.getByLabelText('tools.sheet.docTitle'), {
      target: { value: '季度预算' },
    });

    expect(onTitleChange).toHaveBeenCalledWith('季度预算');
  });

  it('空文档时清空禁用，有内容时可点', () => {
    const { rerender } = render(<SheetHeaderStrip {...makeProps({ clearDisabled: true })} />);
    expect(screen.getByLabelText('common.clear')).toBeDisabled();

    rerender(<SheetHeaderStrip {...makeProps({ clearDisabled: false })} />);
    expect(screen.getByLabelText('common.clear')).toBeEnabled();
  });

  it('新建与演示都交给调用方（这一层不判断能不能演示）', () => {
    const onNewDoc = vi.fn();
    const onPresent = vi.fn();
    render(<SheetHeaderStrip {...makeProps({ onNewDoc, onPresent })} />);

    fireEvent.click(screen.getByLabelText('common.newDoc'));
    fireEvent.click(screen.getByTestId('sheet-present'));

    expect(onNewDoc).toHaveBeenCalledTimes(1);
    expect(onPresent).toHaveBeenCalledTimes(1);
  });
});
