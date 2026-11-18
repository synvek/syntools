import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { CellEditSheet } from './CellEditSheet';

vi.mock('react-i18next', () => ({
  useTranslation: () => ({
    t: (key: string, options?: Record<string, unknown>) =>
      options && 'cell' in options ? `${key}:${String(options.cell)}` : key,
  }),
}));

function setup(overrides: Partial<Parameters<typeof CellEditSheet>[0]> = {}) {
  const onCancel = vi.fn();
  const onSubmit = vi.fn();
  const props = {
    open: true,
    address: 'B3',
    value: '42',
    onCancel,
    onSubmit,
    ...overrides,
  };
  const view = render(<CellEditSheet {...props} />);
  return { view, onCancel, onSubmit };
}

describe('CellEditSheet', () => {
  it('关闭时不渲染任何东西', () => {
    setup({ open: false });
    expect(screen.queryByTestId('sheet-cell-edit-sheet')).toBeNull();
  });

  it('打开时输入框带着当前格的原值，标题写明是哪一格', () => {
    setup({ value: '=SUM(A1:A2)' });

    expect(screen.getByTestId('sheet-cell-edit-input')).toHaveValue('=SUM(A1:A2)');
    expect(screen.getByRole('dialog')).toHaveAttribute(
      'aria-label',
      'tools.sheet.cellEditTitle:B3',
    );
  });

  it('提交把输入的原文交给调用方（是否转数值 / 公式由 parseCellInput 决定）', () => {
    const { onSubmit } = setup({ value: '' });

    fireEvent.change(screen.getByTestId('sheet-cell-edit-input'), {
      target: { value: ' 华东 ' },
    });
    fireEvent.click(screen.getByTestId('sheet-cell-edit-apply'));

    expect(onSubmit).toHaveBeenCalledWith(' 华东 ');
  });

  it('回车提交（表单语义），Esc 之外不猜用户意图', () => {
    const { onSubmit } = setup({ value: '' });

    fireEvent.change(screen.getByTestId('sheet-cell-edit-input'), { target: { value: '99' } });
    fireEvent.submit(screen.getByRole('dialog'));

    expect(onSubmit).toHaveBeenCalledWith('99');
  });

  it('取消不提交', () => {
    const { onCancel, onSubmit } = setup();

    fireEvent.change(screen.getByTestId('sheet-cell-edit-input'), { target: { value: 'x' } });
    fireEvent.click(screen.getAllByText('common.cancel')[0]);

    expect(onCancel).toHaveBeenCalledTimes(1);
    expect(onSubmit).not.toHaveBeenCalled();
  });

  it('重新打开时用新的原值刷新草稿（上次没提交的输入不能残留）', () => {
    const { view } = setup({ value: 'A' });

    fireEvent.change(screen.getByTestId('sheet-cell-edit-input'), {
      target: { value: '半截输入' },
    });
    view.rerender(
      <CellEditSheet open address="C7" value="C" onCancel={vi.fn()} onSubmit={vi.fn()} />,
    );

    expect(screen.getByTestId('sheet-cell-edit-input')).toHaveValue('C');
  });
});
