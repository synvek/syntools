import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { i18n } from '@/core/i18n';
import type { PdfImageObject } from '../model/types';
import { registerPdfEditorStrings } from '../strings';
import { ImageCropDialog } from './ImageCropDialog';

registerPdfEditorStrings(i18n);

const image: PdfImageObject = {
  id: 'img-1',
  page: 'page-main-0',
  kind: 'image',
  rect: { x: 0.1, y: 0.1, w: 0.4, h: 0.3 },
  rotation: 0,
  opacity: 1,
  z: 1,
  dataUrl: 'data:image/png;base64,AAAA',
  naturalW: 200,
  naturalH: 100,
  fit: 'contain',
};

describe('ImageCropDialog', () => {
  it('关闭或无图时不渲染', () => {
    const { container } = render(
      <ImageCropDialog open={false} object={image} onClose={vi.fn()} onApply={vi.fn()} />,
    );
    expect(container).toBeEmptyDOMElement();
  });

  it('默认全图，直接应用等于清除裁剪', () => {
    const onApply = vi.fn();
    render(<ImageCropDialog open object={image} onClose={vi.fn()} onApply={onApply} />);
    fireEvent.click(screen.getByTestId('pdf-crop-apply'));
    expect(onApply).toHaveBeenCalledWith(undefined);
  });

  it('拖右下角缩小后回传归一化裁剪框', () => {
    const box = {
      x: 0,
      y: 0,
      left: 0,
      top: 0,
      right: 200,
      bottom: 100,
      width: 200,
      height: 100,
      toJSON: () => ({}),
    } as DOMRect;
    const spy = vi.spyOn(HTMLElement.prototype, 'getBoundingClientRect').mockReturnValue(box);
    const onApply = vi.fn();

    try {
      render(<ImageCropDialog open object={image} onClose={vi.fn()} onApply={onApply} />);
      const handle = screen.getByTestId('pdf-crop-rect').querySelector('[data-crop-handle="se"]');
      expect(handle).not.toBeNull();

      fireEvent(
        handle as Element,
        new MouseEvent('pointerdown', { bubbles: true, clientX: 200, clientY: 100 }),
      );
      fireEvent(
        screen.getByTestId('pdf-crop-frame'),
        new MouseEvent('pointermove', { bubbles: true, clientX: 150, clientY: 75 }),
      );
      fireEvent(
        screen.getByTestId('pdf-crop-frame'),
        new MouseEvent('pointerup', { bubbles: true, clientX: 150, clientY: 75 }),
      );

      fireEvent.click(screen.getByTestId('pdf-crop-apply'));
      expect(onApply).toHaveBeenCalledWith({ x: 0, y: 0, w: 0.75, h: 0.75 });
    } finally {
      spy.mockRestore();
    }
  });

  it('重置后应用等于清除裁剪', () => {
    const onApply = vi.fn();
    render(
      <ImageCropDialog
        open
        object={{ ...image, crop: { x: 0.2, y: 0.2, w: 0.5, h: 0.5 } }}
        onClose={vi.fn()}
        onApply={onApply}
      />,
    );
    fireEvent.click(screen.getByTestId('pdf-crop-reset'));
    fireEvent.click(screen.getByTestId('pdf-crop-apply'));
    expect(onApply).toHaveBeenCalledWith(undefined);
  });

  it('取消不提交', () => {
    const onApply = vi.fn();
    const onClose = vi.fn();
    render(<ImageCropDialog open object={image} onClose={onClose} onApply={onApply} />);
    fireEvent.click(screen.getByTestId('pdf-crop-cancel'));
    expect(onClose).toHaveBeenCalled();
    expect(onApply).not.toHaveBeenCalled();
  });
});
