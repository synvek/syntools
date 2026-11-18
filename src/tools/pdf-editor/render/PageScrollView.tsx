import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import type { PointerEvent as ReactPointerEvent, ReactNode } from 'react';
import { useTranslation } from 'react-i18next';
import type { PDFDocumentProxy } from 'pdfjs-dist';
import type { PdfPageState, ViewMode, ZoomMode } from '../model/types';
import { PageCanvas } from './PageCanvas';
import { renderDpr, usePageMetrics } from './usePageMetrics';
import type { ContainerSize } from './usePageMetrics';

export interface PageScrollViewProps {
  pdfDoc: PDFDocumentProxy;
  /** Visible pages in output order */
  pages: PdfPageState[];
  view: { mode: ViewMode; zoom: number; zoomMode: ZoomMode; page: number };
  tool: 'select' | 'hand';
  darkCanvas: boolean;
  /** Fit modes only: report the resolved scale so the ribbon can show the real percentage */
  onResolvedScale(scale: number): void;
  /** Scrolling in continuous mode updates the current page */
  onPageChange(page: number): void;
  /** Object layer per page (absolute, above the canvas) */
  overlay?(page: PdfPageState, scale: number): ReactNode;
  /** ⌘/Ctrl + wheel zoom; the factor is relative (1.1 = one step in) */
  onZoomBy?(factor: number): void;
}

/**
 * The page viewport.
 *
 * Single and continuous modes share the same renderer. In continuous mode every page keeps a
 * placeholder box (sized from the current page) so the scrollbar never jumps, and the page nearest
 * the top edge becomes the current page for the status bar and ribbon.
 */
export function PageScrollView({
  pdfDoc,
  pages,
  view,
  tool,
  darkCanvas,
  onResolvedScale,
  onPageChange,
  overlay,
  onZoomBy,
}: PageScrollViewProps) {
  const { t } = useTranslation();
  const scrollRef = useRef<HTMLDivElement | null>(null);
  const pageRefs = useRef<Array<HTMLDivElement | null>>([]);
  const lastPageRef = useRef(view.page);
  const reportedScaleRef = useRef<number | null>(null);
  const rafRef = useRef<number | null>(null);
  const dragRef = useRef<{ x: number; y: number; left: number; top: number } | null>(null);

  const [container, setContainer] = useState<ContainerSize | null>(null);

  const { pageSize, scale } = usePageMetrics({
    pdfDoc,
    pageNumber: view.page,
    mode: view.zoomMode,
    zoom: view.zoom,
    container,
  });

  const dpr = renderDpr();
  const boxWidth = pageSize ? pageSize.width * scale : 0;
  const boxHeight = pageSize ? pageSize.height * scale : 0;

  const orderedPages = useMemo(
    () => (view.mode === 'single' ? pages.slice(Math.max(0, view.page - 1), view.page) : pages),
    [pages, view.mode, view.page],
  );

  // Measure the viewport; jsdom reports 0 and fit modes then fall back to 100%
  useEffect(() => {
    const element = scrollRef.current;
    if (!element) return;

    const measure = () =>
      setContainer({ width: element.clientWidth, height: element.clientHeight });
    measure();

    if (typeof ResizeObserver === 'undefined') {
      window.addEventListener('resize', measure);
      return () => window.removeEventListener('resize', measure);
    }
    const observer = new ResizeObserver(measure);
    observer.observe(element);
    return () => observer.disconnect();
  }, []);

  // ⌘/Ctrl + wheel must zoom the document, not the browser page. React's onWheel is passive at the
  // root, so the listener is attached natively with `passive: false` to be able to preventDefault.
  useEffect(() => {
    const element = scrollRef.current;
    if (!element || !onZoomBy) return;

    const handleWheel = (event: WheelEvent) => {
      if (!event.ctrlKey && !event.metaKey) return;
      event.preventDefault();
      onZoomBy(event.deltaY < 0 ? 1.1 : 1 / 1.1);
    };

    element.addEventListener('wheel', handleWheel, { passive: false });
    return () => element.removeEventListener('wheel', handleWheel);
  }, [onZoomBy]);

  // Tell the ribbon what "fit" resolved to (custom zoom is user intent, never overwritten)
  useEffect(() => {
    if (view.zoomMode === 'custom') {
      reportedScaleRef.current = null;
      return;
    }
    if (reportedScaleRef.current === scale) return;
    reportedScaleRef.current = scale;
    onResolvedScale(scale);
  }, [scale, view.zoomMode, onResolvedScale]);

  const syncCurrentPage = useCallback(() => {
    const element = scrollRef.current;
    if (!element || view.mode !== 'continuous') return;

    const anchor = element.getBoundingClientRect().top + 8;
    let current = 1;
    pageRefs.current.forEach((pageElement, index) => {
      if (pageElement && pageElement.getBoundingClientRect().top <= anchor) current = index + 1;
    });

    if (current !== lastPageRef.current) {
      lastPageRef.current = current;
      onPageChange(current);
    }
  }, [onPageChange, view.mode]);

  const handleScroll = useCallback(() => {
    if (rafRef.current !== null) return;
    rafRef.current = window.requestAnimationFrame(() => {
      rafRef.current = null;
      syncCurrentPage();
    });
  }, [syncCurrentPage]);

  useEffect(
    () => () => {
      if (rafRef.current !== null) window.cancelAnimationFrame(rafRef.current);
    },
    [],
  );

  // Ribbon jumps (page box / prev / next) scroll the target page to the top
  useEffect(() => {
    if (lastPageRef.current === view.page) return;
    lastPageRef.current = view.page;
    if (view.mode !== 'continuous') return;

    const pageElement = pageRefs.current[view.page - 1];
    const element = scrollRef.current;
    if (pageElement && element) element.scrollTop = Math.max(0, pageElement.offsetTop - 8);
  }, [view.page, view.mode]);

  const onPointerDown = (event: ReactPointerEvent<HTMLDivElement>) => {
    if (tool !== 'hand' || event.button !== 0) return;
    const element = scrollRef.current;
    if (!element) return;
    dragRef.current = {
      x: event.clientX,
      y: event.clientY,
      left: element.scrollLeft,
      top: element.scrollTop,
    };
    element.setPointerCapture?.(event.pointerId);
  };

  const onPointerMove = (event: ReactPointerEvent<HTMLDivElement>) => {
    const drag = dragRef.current;
    const element = scrollRef.current;
    if (!drag || !element) return;
    element.scrollLeft = drag.left - (event.clientX - drag.x);
    element.scrollTop = drag.top - (event.clientY - drag.y);
  };

  const onPointerUp = (event: ReactPointerEvent<HTMLDivElement>) => {
    dragRef.current = null;
    scrollRef.current?.releasePointerCapture?.(event.pointerId);
  };

  return (
    <div
      ref={scrollRef}
      data-testid="pdf-scroll-view"
      data-dark={darkCanvas ? 'true' : 'false'}
      onScroll={handleScroll}
      onPointerDown={onPointerDown}
      onPointerMove={onPointerMove}
      onPointerUp={onPointerUp}
      onPointerCancel={onPointerUp}
      /* p-6 is 24px, matching PAGE_PADDING in usePageMetrics.ts */
      className={`relative min-h-0 flex-1 overflow-auto rounded-lg border p-6 ${
        darkCanvas
          ? 'border-gray-700 bg-gray-900'
          : 'border-gray-200 bg-gray-100 dark:border-gray-800 dark:bg-gray-950'
      } ${tool === 'hand' ? 'cursor-grab active:cursor-grabbing' : ''}`}
    >
      {pageSize ? (
        <div className="flex flex-col items-center gap-4">
          {orderedPages.map((page, index) => {
            const displayPage = view.mode === 'single' ? view.page : index + 1;
            return (
              <div
                key={page.id}
                data-testid="pdf-page"
                data-page={displayPage}
                data-page-id={page.id}
                ref={(element) => {
                  pageRefs.current[displayPage - 1] = element;
                }}
                style={{ width: boxWidth, height: boxHeight }}
                className="relative shrink-0 bg-white shadow-sm ring-1 ring-black/10"
              >
                {page.blank ? (
                  // Inserted blank pages have no pdfjs page to render
                  <div
                    data-testid="pdf-blank-page"
                    aria-label={t('tools.pdfEditor.pageAria', { page: displayPage })}
                    className="h-full w-full"
                  />
                ) : (
                  <PageCanvas
                    pdfDoc={pdfDoc}
                    pageNumber={page.sourceIndex + 1}
                    scale={scale}
                    dpr={dpr}
                    width={boxWidth}
                    height={boxHeight}
                    label={t('tools.pdfEditor.pageAria', { page: displayPage })}
                  />
                )}
                {overlay?.(page, scale)}
              </div>
            );
          })}
        </div>
      ) : (
        <p role="status" className="py-10 text-center text-sm text-gray-500 dark:text-gray-400">
          {t('common.loading')}
        </p>
      )}
    </div>
  );
}
