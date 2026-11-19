import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { i18n } from '@/core/i18n';
import { registerPdfEditorStrings } from '../strings';
import { StampGallery } from './StampGallery';

registerPdfEditorStrings(i18n);

describe('StampGallery', () => {
  it('关闭时不渲染', () => {
    const { container } = render(<StampGallery open={false} onClose={vi.fn()} onPick={vi.fn()} />);
    expect(container).toBeEmptyDOMElement();
  });

  it('渲染四个预设，点击后回传预设并发起关闭', () => {
    const onPick = vi.fn();
    const onClose = vi.fn();
    render(<StampGallery open onClose={onClose} onPick={onPick} />);

    for (const key of ['approved', 'reviewed', 'void', 'draft']) {
      expect(screen.getByTestId(`pdf-stamp-${key}`)).toBeInTheDocument();
    }

    fireEvent.click(screen.getByTestId('pdf-stamp-void'));
    expect(onPick).toHaveBeenCalledWith('void');
    expect(onClose).toHaveBeenCalled();
  });

  it('关闭按钮只关闭，不选图章', () => {
    const onPick = vi.fn();
    const onClose = vi.fn();
    render(<StampGallery open onClose={onClose} onPick={onPick} />);

    fireEvent.click(screen.getByTestId('pdf-stamp-close'));
    expect(onClose).toHaveBeenCalled();
    expect(onPick).not.toHaveBeenCalled();
  });
});
