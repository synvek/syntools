import { describe, expect, it, vi } from 'vitest';
import { fireEvent, render, screen } from '@testing-library/react';
import { FileDropZone } from './FileDropZone';

function dropFiles(el: Element, files: File[]) {
  fireEvent.drop(el, { dataTransfer: { files } });
}

describe('FileDropZone', () => {
  it('拖放接受大小内的文件', () => {
    const onFile = vi.fn();
    render(<FileDropZone onFile={onFile} maxBytes={1024} />);
    const file = new File(['hello'], 'a.txt', { type: 'text/plain' });
    dropFiles(screen.getByRole('button', { name: '上传文件' }), [file]);
    expect(onFile).toHaveBeenCalledWith(file);
  });

  it('拒绝超出大小上限的文件并提示', () => {
    const onFile = vi.fn();
    render(<FileDropZone onFile={onFile} maxBytes={4} />);
    dropFiles(screen.getByRole('button', { name: '上传文件' }), [new File(['toolong'], 'big.txt')]);
    expect(onFile).not.toHaveBeenCalled();
    expect(screen.getByText(/文件超出/)).toBeInTheDocument();
  });

  it('点击选择文件同样生效', () => {
    const onFile = vi.fn();
    const { container } = render(<FileDropZone onFile={onFile} maxBytes={1024} />);
    const input = container.querySelector('input[type=file]') as HTMLInputElement;
    const file = new File(['x'], 'x.txt');
    fireEvent.change(input, { target: { files: [file] } });
    expect(onFile).toHaveBeenCalledWith(file);
  });
});
