import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { i18n } from '@/core/i18n';
import { registerPdfEditorStrings } from '../strings';
import { SignaturePad } from './SignaturePad';

registerPdfEditorStrings(i18n);

describe('SignaturePad', () => {
  it('关闭时不渲染', () => {
    const { container } = render(<SignaturePad open={false} onClose={vi.fn()} onApply={vi.fn()} />);
    expect(container).toBeEmptyDOMElement();
  });

  it('初始状态撤销/清空禁用，空签名不能提交', () => {
    const onApply = vi.fn();
    render(<SignaturePad open onClose={vi.fn()} onApply={onApply} />);

    expect(screen.getByTestId('pdf-signature-undo')).toBeDisabled();
    expect(screen.getByTestId('pdf-signature-clear')).toBeDisabled();
    expect(screen.getByTestId('pdf-signature-canvas')).toBeInTheDocument();

    fireEvent.click(screen.getByTestId('pdf-signature-apply'));
    expect(onApply).not.toHaveBeenCalled();
    expect(screen.getByRole('alert')).toBeInTheDocument();
  });

  it('落笔后撤销/清空可用，清空后回到空态', () => {
    render(<SignaturePad open onClose={vi.fn()} onApply={vi.fn()} />);
    const canvas = screen.getByTestId('pdf-signature-canvas');

    // jsdom has no PointerEvent (fireEvent.pointerDown drops button/clientX): dispatch MouseEvent
    // under the pointer type name so React's handlers see the real DOM fields
    const pointer = (type: string, init: MouseEventInit) =>
      new MouseEvent(type, { bubbles: true, cancelable: true, ...init });

    fireEvent(canvas, pointer('pointerdown', { button: 0, clientX: 10, clientY: 10 }));
    fireEvent(canvas, pointer('pointermove', { clientX: 30, clientY: 24 }));
    fireEvent(canvas, pointer('pointerup', { clientX: 30, clientY: 24 }));

    expect(screen.getByTestId('pdf-signature-undo')).toBeEnabled();
    expect(screen.getByTestId('pdf-signature-clear')).toBeEnabled();

    fireEvent.click(screen.getByTestId('pdf-signature-clear'));
    expect(screen.getByTestId('pdf-signature-clear')).toBeDisabled();
  });
});
