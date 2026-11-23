import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { i18n } from '@/core/i18n';
import type { PdfDecoration } from '../model/types';
import { registerPdfEditorStrings } from '../strings';
import { PageDecorationDialog } from './PageDecorationDialog';

registerPdfEditorStrings(i18n);

const renderDialog = (initial: PdfDecoration | null = null) => {
  const onApply = vi.fn<(decoration: PdfDecoration | undefined) => void>();
  const onClose = vi.fn();
  render(<PageDecorationDialog open initial={initial} onClose={onClose} onApply={onApply} />);
  return { onApply, onClose };
};

/** Last payload passed to `onApply`, asserting that a decoration was actually produced */
function appliedDecoration(onApply: ReturnType<typeof vi.fn>): PdfDecoration {
  const applied = (onApply as unknown as { mock: { calls: Array<[PdfDecoration?]> } }).mock
    .calls[0]?.[0];
  if (!applied) throw new Error('onApply was not called with a decoration');
  return applied;
}

describe('PageDecorationDialog', () => {
  it('默认不输出任何装饰：无输入时应用等于清除', () => {
    const { onApply } = renderDialog();
    fireEvent.click(screen.getByTestId('pdf-decoration-apply'));
    expect(onApply).toHaveBeenCalledWith(undefined);
  });

  it('启用页码并修改格式/位置后带回一份完整规则', () => {
    const { onApply } = renderDialog();

    fireEvent.click(screen.getByTestId('pdf-decoration-numbers'));
    fireEvent.change(screen.getByTestId('pdf-decoration-number-format'), {
      target: { value: '第 {n} 页' },
    });
    fireEvent.change(screen.getByTestId('pdf-decoration-number-position'), {
      target: { value: 'bottom-right' },
    });
    fireEvent.change(screen.getByTestId('pdf-decoration-number-start'), { target: { value: '3' } });
    fireEvent.click(screen.getByTestId('pdf-decoration-apply'));

    const applied = appliedDecoration(onApply);
    expect(applied.numbers).toMatchObject({
      enabled: true,
      format: '第 {n} 页',
      position: 'bottom-right',
      startFrom: 3,
    });
  });

  it('页眉与水印文字参与输出，空文字不输出', () => {
    const { onApply } = renderDialog();

    fireEvent.change(screen.getByTestId('pdf-decoration-header'), {
      target: { value: '内部资料' },
    });
    fireEvent.change(screen.getByTestId('pdf-decoration-watermark'), {
      target: { value: '机密' },
    });
    fireEvent.click(screen.getByTestId('pdf-decoration-watermark-tiled'));
    fireEvent.click(screen.getByTestId('pdf-decoration-apply'));

    const applied = appliedDecoration(onApply);
    expect(applied.header?.text).toBe('内部资料');
    expect(applied.watermark?.text).toBe('机密');
    expect(applied.watermark?.tiled).toBe(true);
    expect(applied.numbers?.enabled).toBe(false);
  });

  it('数值越界被夹回允许区间，不会把 NaN 写进模型', () => {
    const { onApply } = renderDialog();

    fireEvent.click(screen.getByTestId('pdf-decoration-numbers'));
    fireEvent.change(screen.getByTestId('pdf-decoration-number-size'), {
      target: { value: '999' },
    });
    fireEvent.change(screen.getByTestId('pdf-decoration-number-margin'), {
      target: { value: '' },
    });
    fireEvent.click(screen.getByTestId('pdf-decoration-apply'));

    const applied = appliedDecoration(onApply);
    expect(applied.numbers?.fontSize).toBe(36);
    expect(applied.numbers?.margin).toBe(24);
  });

  it('打开时回填已有装饰，清除按钮直接回调 undefined', () => {
    const { onApply } = renderDialog({
      numbers: {
        enabled: true,
        format: '{n}',
        position: 'bottom-center',
        fontSize: 12,
        color: '#111111',
        margin: 30,
        startFrom: 1,
      },
    });

    expect(screen.getByTestId('pdf-decoration-numbers')).toBeChecked();
    expect(screen.getByTestId('pdf-decoration-number-format')).toHaveValue('{n}');

    fireEvent.click(screen.getByTestId('pdf-decoration-clear'));
    expect(onApply).toHaveBeenCalledWith(undefined);
  });

  it('关闭时不渲染', () => {
    render(<PageDecorationDialog open={false} onClose={vi.fn()} onApply={vi.fn()} />);
    expect(screen.queryByTestId('pdf-decoration-dialog')).toBeNull();
  });
});
