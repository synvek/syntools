import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import type { PDFDocumentProxy } from 'pdfjs-dist';
import type { PdfPageState } from '../model/types';
import { i18n } from '@/core/i18n';
import { registerPdfEditorStrings } from '../strings';

registerPdfEditorStrings(i18n);
import { ThumbnailRail } from './ThumbnailRail';

// The rail only needs the pdfjs proxy for lazy thumbnails; decoding is out of scope here
vi.mock('@/core/pdf/render', () => ({
  renderPageDataUrl: vi.fn(async () => ({ ok: false, error: 'stub' })),
}));

const pdfDoc = {} as PDFDocumentProxy;

function pages(count = 3): PdfPageState[] {
  return Array.from({ length: count }, (_, index) => ({
    id: `page-${index}`,
    sourceKey: 'main',
    sourceIndex: index,
    rotation: 0 as const,
  }));
}

function pageOps() {
  return {
    insertBlank: vi.fn(),
    remove: vi.fn(),
    duplicate: vi.fn(),
    rotateLeft: vi.fn(),
    rotateRight: vi.fn(),
    extract: vi.fn(),
  };
}

function setup(count = 3) {
  const onMove = vi.fn();
  const onSelect = vi.fn();
  const ops = pageOps();
  render(
    <ThumbnailRail
      pdfDoc={pdfDoc}
      pages={pages(count)}
      currentPage={1}
      onSelect={onSelect}
      onMove={onMove}
      pageOps={ops}
    />,
  );
  return { onMove, onSelect, ops };
}

describe('ThumbnailRail 重排与页面操作', () => {
  it('Alt+↓ 把当前页下移一位，Alt+↑ 在首位移不动', () => {
    const { onMove } = setup();
    const [first] = screen.getAllByTestId('pdf-thumbnail');

    fireEvent.keyDown(first, { key: 'ArrowDown', altKey: true });
    expect(onMove).toHaveBeenCalledWith(1, 2);

    onMove.mockClear();
    fireEvent.keyDown(first, { key: 'ArrowUp', altKey: true });
    expect(onMove).not.toHaveBeenCalled();
  });

  it('拖放把源页放到目标页位置', () => {
    const { onMove } = setup();
    const nodes = screen.getAllByTestId('pdf-thumbnail');

    fireEvent.drop(nodes[2], { dataTransfer: { getData: () => '1' } });

    expect(onMove).toHaveBeenCalledWith(1, 3);
  });

  it('拖到自身不触发重排', () => {
    const { onMove } = setup();
    const nodes = screen.getAllByTestId('pdf-thumbnail');

    fireEvent.drop(nodes[0], { dataTransfer: { getData: () => '1' } });

    expect(onMove).not.toHaveBeenCalled();
  });

  it('Delete 删除当前缩略图对应的页', () => {
    const { ops } = setup();
    fireEvent.keyDown(screen.getAllByTestId('pdf-thumbnail')[1], { key: 'Delete' });

    expect(ops.remove).toHaveBeenCalledTimes(1);
  });

  it('工具栏按钮接到页面命令', () => {
    const { ops } = setup();

    fireEvent.click(screen.getByTestId('pdf-page-insert-blank'));
    fireEvent.click(screen.getByTestId('pdf-page-duplicate'));
    fireEvent.click(screen.getByTestId('pdf-page-rotate-left'));
    fireEvent.click(screen.getByTestId('pdf-page-rotate-right'));
    fireEvent.click(screen.getByTestId('pdf-page-extract'));

    expect(ops.insertBlank).toHaveBeenCalledTimes(1);
    expect(ops.duplicate).toHaveBeenCalledTimes(1);
    expect(ops.rotateLeft).toHaveBeenCalledTimes(1);
    expect(ops.rotateRight).toHaveBeenCalledTimes(1);
    expect(ops.extract).toHaveBeenCalledTimes(1);
  });

  it('只剩一页时删除按钮禁用', () => {
    setup(1);

    expect(screen.getByTestId('pdf-page-delete')).toBeDisabled();
  });

  it('重排后通过 aria-live 播报', () => {
    setup();

    fireEvent.keyDown(screen.getAllByTestId('pdf-thumbnail')[0], {
      key: 'ArrowDown',
      altKey: true,
    });

    expect(screen.getByTestId('pdf-page-announcement')).toHaveTextContent('第 1 页移到第 2 页');
  });
});
