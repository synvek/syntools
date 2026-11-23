import { renderHook, waitFor } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import type { PDFDocumentProxy } from 'pdfjs-dist';
import type { PdfPageState, PdfSource } from '../model/types';
import { docForPage, useAttachmentDocs } from './sourceDocs';

const mocks = vi.hoisted(() => {
  const opened: Array<{ numPages: number; destroy: ReturnType<typeof vi.fn> }> = [];
  const open = vi.fn(async () => {
    const proxy = { numPages: 1, destroy: vi.fn(async () => undefined) };
    opened.push(proxy);
    return { ok: true as const, value: proxy as unknown as PDFDocumentProxy };
  });
  return { opened, open };
});

vi.mock('@/core/pdf/render', () => ({ openPdfjsDoc: mocks.open }));

const page = (overrides: Partial<PdfPageState>): PdfPageState => ({
  id: 'page-main-0',
  sourceKey: 'main',
  sourceIndex: 0,
  rotation: 0,
  ...overrides,
});

const attachment = (key: string, fingerprint = 'fp-1'): PdfSource => ({
  key,
  bytes: new Uint8Array([1, 2, 3]),
  pageCount: 2,
  encrypted: false,
  fingerprint,
});

/** `destroy` lives on the loading task, so the proxy typings do not expose it */
const destroyOf = (doc: PDFDocumentProxy | undefined) =>
  (doc as unknown as { destroy: ReturnType<typeof vi.fn> }).destroy;

describe('docForPage', () => {
  const main = { numPages: 3 } as unknown as PDFDocumentProxy;
  const attached = { numPages: 2 } as unknown as PDFDocumentProxy;

  it('主文件与附件各用自己的代理', () => {
    const docs = { main, 'attach-1': attached };
    expect(docForPage(docs, page({}))).toBe(main);
    expect(docForPage(docs, page({ sourceKey: 'attach-1', id: 'page-attach-1-0' }))).toBe(attached);
  });

  it('空白页没有代理，缺失的来源返回 undefined', () => {
    const docs = { main, 'attach-1': attached };
    expect(docForPage(docs, page({ blank: { widthPt: 100, heightPt: 200 } }))).toBeUndefined();
    expect(docForPage(docs, page({ sourceKey: 'attach-2' }))).toBeUndefined();
  });

  it('未传代理表时只回退主文件，绝不把主文件当附件页渲染', () => {
    expect(docForPage(undefined, page({}), main)).toBe(main);
    expect(docForPage(undefined, page({ sourceKey: 'attach-1' }), main)).toBeUndefined();
  });
});

describe('useAttachmentDocs', () => {
  it('为每个附件打开一次代理，并在移除后释放', async () => {
    mocks.opened.length = 0;
    mocks.open.mockClear();

    const { result, rerender } = renderHook(
      ({ sources }: { sources: PdfSource[] }) => useAttachmentDocs(sources),
      { initialProps: { sources: [attachment('attach-1')] } },
    );

    await waitFor(() => expect(result.current['attach-1']).toBeDefined());
    expect(mocks.open).toHaveBeenCalledTimes(1);

    // 同一份字节的重复渲染不重新打开
    rerender({ sources: [attachment('attach-1')] });
    expect(mocks.open).toHaveBeenCalledTimes(1);

    const proxy = result.current['attach-1'];
    rerender({ sources: [] });
    await waitFor(() => expect(result.current['attach-1']).toBeUndefined());
    expect(destroyOf(proxy)).toHaveBeenCalled();
  });

  it('同一 key 换成另一份字节时重新打开', async () => {
    mocks.opened.length = 0;
    mocks.open.mockClear();

    const { result, rerender } = renderHook(
      ({ sources }: { sources: PdfSource[] }) => useAttachmentDocs(sources),
      { initialProps: { sources: [attachment('attach-1', 'fp-1')] } },
    );
    await waitFor(() => expect(result.current['attach-1']).toBeDefined());
    const first = result.current['attach-1'];

    rerender({ sources: [attachment('attach-1', 'fp-2')] });
    await waitFor(() => expect(result.current['attach-1']).not.toBe(first));
    expect(mocks.open).toHaveBeenCalledTimes(2);
    expect(destroyOf(first)).toHaveBeenCalled();
  });
});
