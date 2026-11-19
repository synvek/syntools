import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { i18n } from '@/core/i18n';
import { registerPdfEditorStrings } from '../strings';
import { ExportDocxDialog } from './ExportDocxDialog';

registerPdfEditorStrings(i18n);

describe('ExportDocxDialog', () => {
  it('关闭时不渲染', () => {
    const { container } = render(
      <ExportDocxDialog
        open={false}
        pageCount={3}
        busy={false}
        onClose={vi.fn()}
        onExport={vi.fn()}
      />,
    );
    expect(container).toBeEmptyDOMElement();
  });

  it('默认混合模式、全部页面、无页眉页脚', () => {
    const onExport = vi.fn();
    render(
      <ExportDocxDialog open pageCount={3} busy={false} onClose={vi.fn()} onExport={onExport} />,
    );

    expect(screen.getByTestId('pdf-export-mode-mixed')).toBeChecked();
    fireEvent.click(screen.getByTestId('pdf-export-confirm'));
    expect(onExport).toHaveBeenCalledWith({ mode: 'mixed', pages: [1, 2, 3], headerFooter: false });
  });

  it('切换模式、页码与页眉页脚后回传', () => {
    const onExport = vi.fn();
    render(
      <ExportDocxDialog open pageCount={12} busy={false} onClose={vi.fn()} onExport={onExport} />,
    );

    fireEvent.click(screen.getByTestId('pdf-export-mode-text'));
    fireEvent.change(screen.getByTestId('pdf-export-pages'), { target: { value: '2-4,7' } });
    fireEvent.click(screen.getByTestId('pdf-export-header-footer'));
    fireEvent.click(screen.getByTestId('pdf-export-confirm'));

    expect(onExport).toHaveBeenCalledWith({
      mode: 'text',
      pages: [2, 3, 4, 7],
      headerFooter: true,
    });
  });

  it('非法页码显示错误并禁用导出', () => {
    const onExport = vi.fn();
    render(
      <ExportDocxDialog open pageCount={3} busy={false} onClose={vi.fn()} onExport={onExport} />,
    );

    fireEvent.change(screen.getByTestId('pdf-export-pages'), { target: { value: '9-2' } });
    expect(screen.getByRole('alert')).toBeInTheDocument();
    expect(screen.getByTestId('pdf-export-confirm')).toBeDisabled();

    fireEvent.click(screen.getByTestId('pdf-export-confirm'));
    expect(onExport).not.toHaveBeenCalled();
  });

  it('导出中禁用确认与取消', () => {
    render(<ExportDocxDialog open pageCount={3} busy onClose={vi.fn()} onExport={vi.fn()} />);
    expect(screen.getByTestId('pdf-export-confirm')).toBeDisabled();
    expect(screen.getByTestId('pdf-export-cancel')).toBeDisabled();
  });
});
