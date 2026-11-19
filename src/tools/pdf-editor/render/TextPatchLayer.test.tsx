import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import type { PDFDocumentProxy } from 'pdfjs-dist';
import { i18n } from '@/core/i18n';
import { registerPdfEditorStrings } from '../strings';
import { TextPatchLayer } from './TextPatchLayer';

registerPdfEditorStrings(i18n);

/** Minimal pdfjs proxy: one 600×800 page with a single 12 pt line at PDF (72, 700) */
function fakeDoc(
  items: unknown[] = [{ str: 'Hello', transform: [12, 0, 0, 12, 72, 700], width: 30, height: 12 }],
): PDFDocumentProxy {
  const page = {
    getViewport: () => ({
      width: 600,
      height: 800,
      transform: [1, 0, 0, -1, 0, 800],
    }),
    getTextContent: async () => ({ items }),
  };
  return { getPage: async () => page } as unknown as PDFDocumentProxy;
}

/** jsdom has no layout: give the layer the page box it would have on screen */
function stubBox(element: HTMLElement) {
  element.getBoundingClientRect = () =>
    ({ left: 0, top: 0, width: 600, height: 800, right: 600, bottom: 800 }) as DOMRect;
}

describe('TextPatchLayer（M3-1 / M3-2）', () => {
  it('按行渲染覆盖框，点击行回传原文与行框', async () => {
    const onPatch = vi.fn();
    render(
      <TextPatchLayer pdfDoc={fakeDoc()} pageNumber={1} pageId="page-main-0" onPatch={onPatch} />,
    );

    const line = await screen.findByTestId('pdf-text-line');
    expect(line).toBeInTheDocument();

    stubBox(screen.getByTestId('pdf-text-layer'));
    // Line center: x = 72 + 15, y ≈ 100 - 5 in visual points
    fireEvent(
      screen.getByTestId('pdf-text-layer'),
      new MouseEvent('pointerdown', { bubbles: true, button: 0, clientX: 87, clientY: 95 }),
    );

    expect(onPatch).toHaveBeenCalledTimes(1);
    const [pageId, patchLine] = onPatch.mock.calls[0];
    expect(pageId).toBe('page-main-0');
    expect(patchLine.text).toBe('Hello');
    expect(patchLine.rect.w).toBeCloseTo(30 / 600, 5);
  });

  it('没有文本层时给出扫描件提示，点击不创建对象', async () => {
    const onPatch = vi.fn();
    render(
      <TextPatchLayer pdfDoc={fakeDoc([])} pageNumber={1} pageId="page-main-0" onPatch={onPatch} />,
    );

    await waitFor(() => {
      expect(screen.queryByTestId('pdf-text-line')).not.toBeInTheDocument();
    });
    expect(screen.getByRole('status')).toHaveTextContent(i18n.t('tools.pdfEditor.patchNoText'));

    stubBox(screen.getByTestId('pdf-text-layer'));
    fireEvent(
      screen.getByTestId('pdf-text-layer'),
      new MouseEvent('pointerdown', { bubbles: true, button: 0, clientX: 100, clientY: 100 }),
    );
    expect(onPatch).not.toHaveBeenCalled();
  });
});
