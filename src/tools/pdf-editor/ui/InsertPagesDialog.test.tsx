import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { i18n } from '@/core/i18n';
import type { PdfSource } from '../model/types';
import { registerPdfEditorStrings } from '../strings';
import { InsertPagesDialog } from './InsertPagesDialog';

// Only the file reader is mocked: parsePageRange must stay real, it is the unit under test too
vi.mock('../io/pageImport', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../io/pageImport')>();
  return { ...actual, readPdfFile: vi.fn() };
});

import { readPdfFile } from '../io/pageImport';

registerPdfEditorStrings(i18n);

const readMock = vi.mocked(readPdfFile);

function source(pageCount = 3): PdfSource {
  return {
    key: '',
    bytes: new Uint8Array([1]),
    pageCount,
    encrypted: false,
    fingerprint: 'other.pdf:1:0',
  };
}

function setup() {
  const onInsert = vi.fn();
  const onClose = vi.fn();
  render(<InsertPagesDialog open onClose={onClose} onInsert={onInsert} />);
  return { onInsert, onClose };
}

function pickFile(name = 'other.pdf') {
  const file = new File([new Uint8Array([1])], name, { type: 'application/pdf' });
  fireEvent.change(screen.getByTestId('pdf-insert-pages-file'), { target: { files: [file] } });
  return file;
}

describe('InsertPagesDialog', () => {
  beforeEach(() => {
    readMock.mockReset();
  });

  it('未选文件时不能确认', () => {
    setup();
    expect(screen.getByTestId('pdf-insert-pages-confirm')).toBeDisabled();
  });

  it('选文件后默认全选并插入全部页', async () => {
    readMock.mockResolvedValue({ ok: true, value: source(3) });
    const { onInsert, onClose } = setup();

    pickFile();
    await waitFor(() => expect(screen.getByTestId('pdf-insert-pages-range')).toHaveValue('1-3'));

    fireEvent.click(screen.getByTestId('pdf-insert-pages-confirm'));

    expect(onInsert).toHaveBeenCalledWith(source(3), [0, 1, 2]);
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it('按输入的页码范围插入', async () => {
    readMock.mockResolvedValue({ ok: true, value: source(5) });
    const { onInsert } = setup();

    pickFile();
    await waitFor(() => expect(screen.getByTestId('pdf-insert-pages-range')).toHaveValue('1-5'));
    fireEvent.change(screen.getByTestId('pdf-insert-pages-range'), {
      target: { value: '2-3,5' },
    });
    fireEvent.click(screen.getByTestId('pdf-insert-pages-confirm'));

    expect(onInsert).toHaveBeenCalledWith(source(5), [1, 2, 4]);
  });

  it('非法范围给出提示且不提交', async () => {
    readMock.mockResolvedValue({ ok: true, value: source(3) });
    const { onInsert, onClose } = setup();

    pickFile();
    await waitFor(() => expect(screen.getByTestId('pdf-insert-pages-range')).toHaveValue('1-3'));
    fireEvent.change(screen.getByTestId('pdf-insert-pages-range'), {
      target: { value: '5-9' },
    });
    fireEvent.click(screen.getByTestId('pdf-insert-pages-confirm'));

    expect(screen.getByTestId('pdf-insert-pages-error')).toHaveTextContent('页码范围无效');
    expect(onInsert).not.toHaveBeenCalled();
    expect(onClose).not.toHaveBeenCalled();
  });

  it('加密文件提示先解密', async () => {
    readMock.mockResolvedValue({ ok: false, error: 'NEED_PASSWORD' });
    setup();

    pickFile('secret.pdf');

    await waitFor(() =>
      expect(screen.getByTestId('pdf-insert-pages-error')).toHaveTextContent(
        '该 PDF 已加密，请先解密',
      ),
    );
    expect(screen.getByTestId('pdf-insert-pages-confirm')).toBeDisabled();
  });

  it('关闭时不渲染', () => {
    render(<InsertPagesDialog open={false} onClose={vi.fn()} onInsert={vi.fn()} />);
    expect(screen.queryByTestId('pdf-insert-pages-dialog')).toBeNull();
  });
});
