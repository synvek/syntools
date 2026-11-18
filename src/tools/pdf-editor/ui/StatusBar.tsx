import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import type { PDFDocumentProxy } from 'pdfjs-dist';
import { visiblePages, visiblePageCount } from '../model/doc';
import type { PdfEditorDoc } from '../model/types';
import { formatFileSize, formatPageSize } from './statusFormat';

interface StatusBarProps {
  doc: PdfEditorDoc | null;
  /** Used to read the current page size; omitted in tests without a document proxy */
  pdfDoc?: PDFDocumentProxy | null;
}

/** Bottom strip: page position, zoom, page size, file size and the local-only promise */
export function StatusBar({ doc, pdfDoc }: StatusBarProps) {
  const { t } = useTranslation();
  const total = doc ? visiblePageCount(doc) : 0;
  const [pageSize, setPageSize] = useState<{ width: number; height: number } | null>(null);

  const currentPage = doc ? (visiblePages(doc)[doc.view.page - 1] ?? null) : null;
  // Blank pages have no pdfjs page; inserted attachments are only visible once their proxy is
  // wired in (M2-7), so only the main source can report a size for now
  const mainSourceIndex =
    currentPage && !currentPage.blank && currentPage.sourceKey === doc?.source.key
      ? currentPage.sourceIndex
      : null;

  useEffect(() => {
    setPageSize(null);
    if (!currentPage?.blank) {
      if (!doc || !pdfDoc || mainSourceIndex == null) return;

      let cancelled = false;
      void (async () => {
        try {
          const page = await pdfDoc.getPage(mainSourceIndex + 1);
          const viewport = page.getViewport({ scale: 1 });
          if (!cancelled) setPageSize({ width: viewport.width, height: viewport.height });
        } catch {
          if (!cancelled) setPageSize(null);
        }
      })();

      return () => {
        cancelled = true;
      };
    }

    setPageSize({ width: currentPage.blank.widthPt, height: currentPage.blank.heightPt });
    return undefined;
  }, [doc, pdfDoc, mainSourceIndex, currentPage]);

  const totalBytes = doc
    ? doc.source.bytes.byteLength +
      doc.attachments.reduce((sum, attachment) => sum + attachment.bytes.byteLength, 0)
    : 0;

  return (
    <div
      role="status"
      className="flex flex-wrap items-center gap-x-4 gap-y-1 border-t border-gray-200 px-1 pt-2 text-xs text-gray-500 dark:border-gray-800 dark:text-gray-400"
    >
      <span data-testid="pdf-status-page">
        {doc
          ? t('tools.pdfEditor.statusPage', { page: doc.view.page, total })
          : t('tools.pdfEditor.statusNoFile')}
      </span>
      {doc ? (
        <span data-testid="pdf-status-zoom">
          {t('tools.pdfEditor.cmdZoom')} {Math.round(doc.view.zoom * 100)}%
        </span>
      ) : null}
      {pageSize ? (
        <span data-testid="pdf-status-size">
          {t('tools.pdfEditor.statusPageSize')} {formatPageSize(pageSize.width, pageSize.height)}
        </span>
      ) : null}
      {doc ? (
        <span data-testid="pdf-status-filesize">
          {t('tools.pdfEditor.statusFileSize')} {formatFileSize(totalBytes)}
        </span>
      ) : null}
      <span className="ml-auto">{t('tools.pdfEditor.privacy')}</span>
    </div>
  );
}
