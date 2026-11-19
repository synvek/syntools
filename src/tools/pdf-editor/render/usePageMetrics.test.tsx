import { renderHook, waitFor } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import type { PDFDocumentProxy } from 'pdfjs-dist';
import { usePageMetrics } from './usePageMetrics';

/** Minimal pdfjs stand-in: every page reports the size from the map (600×800 by default) */
function fakeDoc(sizes: Record<number, { width: number; height: number }> = {}) {
  return {
    getPage: vi.fn(async (pageNumber: number) => ({
      getViewport: () => sizes[pageNumber] ?? { width: 600, height: 800 },
    })),
  } as unknown as PDFDocumentProxy;
}

const CONTAINER = { width: 800, height: 900 };

function useMetrics(pdfDoc: PDFDocumentProxy, pageNumber: number) {
  return usePageMetrics({ pdfDoc, pageNumber, mode: 'custom', zoom: 1, container: CONTAINER });
}

describe('usePageMetrics', () => {
  it('翻页时保留上一页尺寸，占位盒不会塌陷（滚动位置才不会跳回首页）', async () => {
    const doc = fakeDoc();
    const { result, rerender } = renderHook(
      ({ pageNumber }: { pageNumber: number }) => useMetrics(doc, pageNumber),
      { initialProps: { pageNumber: 1 } },
    );

    await waitFor(() => expect(result.current.pageSize).toEqual({ width: 600, height: 800 }));

    rerender({ pageNumber: 2 });

    // 同步渲染阶段就必须还是旧的尺寸：置 null 会让所有页面盒子变成 0 高，
    // 浏览器把 scrollTop 夹回 0，表现为"滚到第 2 页自动跳回第 1 页"
    expect(result.current.pageSize).toEqual({ width: 600, height: 800 });
  });

  it('换文档时清空尺寸，避免沿用上一份文件的页面大小', async () => {
    const first = fakeDoc();
    const second = fakeDoc({ 1: { width: 400, height: 400 } });
    const { result, rerender } = renderHook(
      ({ pdfDoc }: { pdfDoc: PDFDocumentProxy }) => useMetrics(pdfDoc, 1),
      { initialProps: { pdfDoc: first } },
    );

    await waitFor(() => expect(result.current.pageSize).toEqual({ width: 600, height: 800 }));

    rerender({ pdfDoc: second });

    expect(result.current.pageSize).toBeNull();
    await waitFor(() => expect(result.current.pageSize).toEqual({ width: 400, height: 400 }));
  });
});
