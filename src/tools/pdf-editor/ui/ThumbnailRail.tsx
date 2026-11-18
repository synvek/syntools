import { useEffect, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import type { PDFDocumentProxy } from 'pdfjs-dist';
import { renderPageDataUrl } from '@/core/pdf/render';
import { PDF_THUMB_SCALE } from '@/core/pdf/types';
import type { PdfPageState } from '../model/types';

interface ThumbnailRailProps {
  pdfDoc: PDFDocumentProxy;
  /** Visible pages in output order; page number = index + 1 */
  pages: PdfPageState[];
  currentPage: number;
  onSelect(page: number): void;
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
  pdfDoc,
  sourceIndex,
  page,
  selected,
  onSelect,
}: {
  pdfDoc: PDFDocumentProxy;
  sourceIndex: number;
  page: number;
  selected: boolean;
  onSelect(page: number): void;
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

  useEffect(() => {
    if (!visible) return;
    let cancelled = false;
    void (async () => {
      const result = await enqueueThumbnail(() =>
        renderPageDataUrl(pdfDoc, sourceIndex + 1, PDF_THUMB_SCALE),
      );
      if (!cancelled && result.ok) setUrl(result.value);
    })();
    return () => {
      cancelled = true;
    };
  }, [visible, pdfDoc, sourceIndex]);

  return (
    <button
      ref={ref}
      type="button"
      role="option"
      aria-selected={selected}
      aria-label={t('tools.pdfEditor.pageAria', { page })}
      data-testid="pdf-thumbnail"
      data-page={page}
      onClick={() => onSelect(page)}
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

/** Left rail: page thumbnails, click to jump */
export function ThumbnailRail({ pdfDoc, pages, currentPage, onSelect }: ThumbnailRailProps) {
  const { t } = useTranslation();

  return (
    <div
      role="listbox"
      aria-label={t('tools.pdfEditor.thumbTitle')}
      data-testid="pdf-thumbnails"
      className="flex max-h-full w-[7.5rem] shrink-0 flex-col gap-1 overflow-y-auto rounded-lg border border-gray-200 bg-white p-1 dark:border-gray-800 dark:bg-gray-900"
    >
      {pages.map((page, index) => (
        <Thumbnail
          key={page.sourceIndex}
          pdfDoc={pdfDoc}
          sourceIndex={page.sourceIndex}
          page={index + 1}
          selected={index + 1 === currentPage}
          onSelect={onSelect}
        />
      ))}
    </div>
  );
}
