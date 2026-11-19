import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { i18n } from '@/core/i18n';
import { registerPdfEditorStrings } from '../strings';
import { ExportImagesDialog } from './ExportImagesDialog';

registerPdfEditorStrings(i18n);

describe('ExportImagesDialog', () => {
  it('默认 PNG / 150 DPI / 全部页面', () => {
    const onExport = vi.fn();
    render(
      <ExportImagesDialog open pageCount={4} busy={false} onClose={vi.fn()} onExport={onExport} />,
    );

    expect(screen.getByTestId('pdf-image-format-png')).toBeChecked();
    expect(screen.getByTestId('pdf-image-dpi')).toHaveValue('150');
    fireEvent.click(screen.getByTestId('pdf-image-confirm'));
    expect(onExport).toHaveBeenCalledWith({ format: 'png', dpi: 150, pages: [1, 2, 3, 4] });
  });

  it('可切换 JPEG、DPI 与页码', () => {
    const onExport = vi.fn();
    render(
      <ExportImagesDialog open pageCount={10} busy={false} onClose={vi.fn()} onExport={onExport} />,
    );

    fireEvent.click(screen.getByTestId('pdf-image-format-jpeg'));
    fireEvent.change(screen.getByTestId('pdf-image-dpi'), { target: { value: '300' } });
    fireEvent.change(screen.getByTestId('pdf-image-pages'), { target: { value: '3' } });
    fireEvent.click(screen.getByTestId('pdf-image-confirm'));

    expect(onExport).toHaveBeenCalledWith({ format: 'jpeg', dpi: 300, pages: [3] });
  });

  it('非法页码不触发导出', () => {
    const onExport = vi.fn();
    render(
      <ExportImagesDialog open pageCount={4} busy={false} onClose={vi.fn()} onExport={onExport} />,
    );

    fireEvent.change(screen.getByTestId('pdf-image-pages'), { target: { value: 'abc' } });
    fireEvent.click(screen.getByTestId('pdf-image-confirm'));
    expect(onExport).not.toHaveBeenCalled();
  });
});
