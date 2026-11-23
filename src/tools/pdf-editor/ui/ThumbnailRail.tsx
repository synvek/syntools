import { useEffect, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import type { PDFDocumentProxy } from 'pdfjs-dist';
import { renderPageDataUrl } from '@/core/pdf/render';
import { PDF_THUMB_SCALE } from '@/core/pdf/types';
import type { PdfPageState } from '../model/types';
import { docForPage, type SourceDocs } from '../render/sourceDocs';

/** Page operations offered right on the rail (M2-7); acts on the current page */
export interface ThumbnailPageOps {
  insertBlank(): void;
  /** Open the "insert pages from file" dialog */
  insertFromFile(): void;
  /** Download one PDF per page as a ZIP */
  exportZip(): void;
  remove(): void;
  duplicate(): void;
  rotateLeft(): void;
  rotateRight(): void;
  extract(): void;
  /** Shown when the last page cannot be removed */
  blocked?: string | null;
}

interface ThumbnailRailProps {
  pdfDoc: PDFDocumentProxy;
  /** Proxies per byte source; omitted in tests that only mount the main file */
  docs?: SourceDocs;
  /** Visible pages in output order; page number = index + 1 */
  pages: PdfPageState[];
  currentPage: number;
  onSelect(page: number): void;
  /** Drag or Alt+↑/↓ reorder; both report 1-based page numbers */
  onMove(from: number, to: number): void;
  pageOps?: ThumbnailPageOps;
}

/**
 * Serialize decoding across the whole rail.
 *
 * `renderPageDataUrl` is async and pdfjs decodes in a worker pool; firing 50 of them at once stalls
 * the main viewport on large files. One at a time keeps scrolling responsive.
 */
let thumbnailQueue: Promise<unknown> = Promise.resolve();

function enqueueThumbnail<T>(task: () => Promise<T>): Promise<T> {
  const run = thumbnailQueue.then(task, task);
  thumbnailQueue = run.then(
    () => undefined,
    () => undefined,
  );
  return run;
}

/**
 * One lazily rendered thumbnail.
 *
 * A 50-page file must not render 50 canvases on open, so the image is requested only once the item
 * is (nearly) on screen. `renderPageDataUrl` returns a data URL, which also keeps the page cache
 * independent of the main viewport canvas.
 */
function Thumbnail({
  sourceDoc,
  state,
  page,
  selected,
  onSelect,
  onMove,
  onRemove,
}: {
  /** Proxy of the page's own source; `undefined` while an attachment is still opening */
  sourceDoc?: PDFDocumentProxy;
  state: PdfPageState;
  page: number;
  selected: boolean;
  onSelect(page: number): void;
  onMove(from: number, to: number): void;
  onRemove?(): void;
}) {
  const { t } = useTranslation();
  const ref = useRef<HTMLButtonElement | null>(null);
  const [visible, setVisible] = useState(false);
  const [url, setUrl] = useState<string | null>(null);

  useEffect(() => {
    const element = ref.current;
    if (!element || typeof IntersectionObserver === 'undefined') {
      setVisible(true);
      return;
    }
    const observer = new IntersectionObserver(
      (entries) => {
        if (entries.some((entry) => entry.isIntersecting)) {
          setVisible(true);
          observer.disconnect();
        }
      },
      { rootMargin: '400px 0px' },
    );
    observer.observe(element);
    return () => observer.disconnect();
  }, []);

  // Blank pages and pages whose source proxy is still opening show the placeholder
  const renderable = !state.blank && sourceDoc !== undefined;

  useEffect(() => {
    if (!visible || !renderable || !sourceDoc) return;
    let cancelled = false;
    void (async () => {
      const result = await enqueueThumbnail(() =>
        renderPageDataUrl(sourceDoc, state.sourceIndex + 1, PDF_THUMB_SCALE),
      );
      if (!cancelled && result.ok) setUrl(result.value);
    })();
    return () => {
      cancelled = true;
    };
  }, [visible, renderable, sourceDoc, state.sourceIndex]);

  return (
    <button
      ref={ref}
      type="button"
      role="option"
      aria-selected={selected}
      aria-label={t('tools.pdfEditor.pageAria', { page })}
      data-testid="pdf-thumbnail"
      data-page={page}
      draggable
      onClick={() => onSelect(page)}
      onDragStart={(event) => {
        event.dataTransfer.setData('text/plain', String(page));
        event.dataTransfer.effectAllowed = 'move';
      }}
      onDragOver={(event) => {
        event.preventDefault();
        event.dataTransfer.dropEffect = 'move';
      }}
      onDrop={(event) => {
        event.preventDefault();
        const from = Number(event.dataTransfer.getData('text/plain'));
        if (Number.isFinite(from) && from > 0 && from !== page) onMove(from, page);
      }}
      onKeyDown={(event) => {
        // Keyboard path for the drag: Alt+↑/↓ moves this page one slot, like Office
        if (event.altKey && (event.key === 'ArrowUp' || event.key === 'ArrowDown')) {
          event.preventDefault();
          const to = event.key === 'ArrowUp' ? page - 1 : page + 1;
          if (to >= 1) onMove(page, to);
          return;
        }
        if (event.key === 'Delete' && onRemove) {
          event.preventDefault();
          onRemove();
        }
      }}
      className={`flex w-full flex-col items-center gap-1 rounded-md p-1 transition-colors motion-reduce:transition-none ${
        selected
          ? 'bg-blue-50 ring-1 ring-blue-500 dark:bg-blue-950/40'
          : 'hover:bg-black/[0.04] dark:hover:bg-white/10'
      }`}
    >
      {url ? (
        <img src={url} alt="" loading="lazy" className="w-full rounded-sm shadow-sm" />
      ) : (
        <div className="aspect-[210/297] w-full rounded-sm bg-gray-200 dark:bg-gray-800" />
      )}
      <span className="text-[11px] tabular-nums text-gray-500 dark:text-gray-400">
        {t('tools.pdfEditor.pageAria', { page })}
      </span>
    </button>
  );
}

/** Left rail: page thumbnails, drag or Alt+↑/↓ to reorder, click to jump */
export function ThumbnailRail({
  pdfDoc,
  docs,
  pages,
  currentPage,
  onSelect,
  onMove,
  pageOps,
}: ThumbnailRailProps) {
  const { t } = useTranslation();
  const [announcement, setAnnouncement] = useState('');

  const move = (from: number, to: number) => {
    if (from === to || to < 1 || to > pages.length) return;
    onMove(from, to);
    setAnnouncement(t('tools.pdfEditor.pageMoved', { from, to }));
  };

  const toolButton =
    'rounded border border-gray-300 px-1.5 py-0.5 text-[11px] text-gray-700 transition-colors hover:bg-gray-100 motion-reduce:transition-none dark:border-gray-700 dark:text-gray-200 dark:hover:bg-gray-800';

  return (
    <div className="flex max-h-full w-[7.5rem] shrink-0 flex-col gap-1">
      {pageOps ? (
        <div
          data-testid="pdf-page-toolbar"
          className="flex flex-col gap-1 rounded-lg border border-gray-200 bg-white p-1 dark:border-gray-800 dark:bg-gray-900"
        >
          <button
            type="button"
            data-testid="pdf-page-insert-blank"
            onClick={pageOps.insertBlank}
            className={toolButton}
          >
            {t('tools.pdfEditor.pageOpsInsertBlank')}
          </button>
          <button
            type="button"
            data-testid="pdf-page-insert-from-file"
            onClick={pageOps.insertFromFile}
            className={toolButton}
          >
            {t('tools.pdfEditor.pageOpsInsertFromFile')}
          </button>
          <button
            type="button"
            data-testid="pdf-page-duplicate"
            onClick={pageOps.duplicate}
            className={toolButton}
          >
            {t('tools.pdfEditor.pageOpsDuplicate')}
          </button>
          <div className="flex gap-1">
            <button
              type="button"
              data-testid="pdf-page-rotate-left"
              onClick={pageOps.rotateLeft}
              className={`${toolButton} flex-1`}
            >
              {t('tools.pdfEditor.pageOpsRotateLeft')}
            </button>
            <button
              type="button"
              data-testid="pdf-page-rotate-right"
              onClick={pageOps.rotateRight}
              className={`${toolButton} flex-1`}
            >
              {t('tools.pdfEditor.pageOpsRotateRight')}
            </button>
          </div>
          <button
            type="button"
            data-testid="pdf-page-extract"
            onClick={pageOps.extract}
            className={toolButton}
          >
            {t('tools.pdfEditor.pageOpsExtract')}
          </button>
          <button
            type="button"
            data-testid="pdf-page-export-zip"
            onClick={pageOps.exportZip}
            className={toolButton}
          >
            {t('tools.pdfEditor.pageOpsExportZip')}
          </button>
          <button
            type="button"
            data-testid="pdf-page-delete"
            onClick={pageOps.remove}
            disabled={pages.length <= 1}
            title={pages.length <= 1 ? t('tools.pdfEditor.lastPageBlocked') : undefined}
            className={`${toolButton} border-red-300 text-red-600 hover:bg-red-50 disabled:opacity-40 dark:border-red-800 dark:text-red-400 dark:hover:bg-red-950/40`}
          >
            {t('tools.pdfEditor.pageOpsDelete')}
          </button>
          {pageOps.blocked ? (
            <p
              role="alert"
              className="text-[11px] leading-tight text-amber-600 dark:text-amber-400"
            >
              {pageOps.blocked}
            </p>
          ) : null}
        </div>
      ) : null}

      <div
        role="listbox"
        aria-label={t('tools.pdfEditor.thumbTitle')}
        data-testid="pdf-thumbnails"
        className="flex max-h-full min-h-0 flex-1 flex-col gap-1 overflow-y-auto rounded-lg border border-gray-200 bg-white p-1 dark:border-gray-800 dark:bg-gray-900"
      >
        {pages.map((page, index) => (
          <Thumbnail
            key={page.id}
            sourceDoc={docForPage(docs, page, pdfDoc)}
            state={page}
            page={index + 1}
            selected={index + 1 === currentPage}
            onSelect={onSelect}
            onMove={move}
            onRemove={pageOps?.remove}
          />
        ))}
      </div>

      <p aria-live="polite" className="sr-only" data-testid="pdf-page-announcement">
        {announcement}
      </p>
    </div>
  );
}
