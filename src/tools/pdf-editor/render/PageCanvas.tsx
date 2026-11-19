import { useEffect, useRef, useState } from 'react';
import type { PDFDocumentProxy } from 'pdfjs-dist';
import { cacheCanvas, canvasCacheKey, takeCachedCanvas } from './canvasCache';

interface PageCanvasProps {
  pdfDoc: PDFDocumentProxy;
  /** 1-based page number inside the source file (not the output order) */
  pageNumber: number;
  /** CSS px per PDF point */
  scale: number;
  dpr: number;
  /** Placeholder box in CSS px, so layout is stable before (and while) rendering */
  width: number;
  height: number;
  /** Accessible page caption */
  label: string;
  /** IntersectionObserver margin; large files pass `0px` to stop pre-rendering neighbours (M4-5) */
  rootMargin?: string;
}

/**
 * One rendered page.
 *
 * Render decisions that matter here:
 * - **Lazy**: an IntersectionObserver with a 600px margin decides when to render; jsdom has no IO, so
 *   it renders immediately there.
 * - **Cancellable**: every zoom change or teardown cancels the in-flight `RenderTask`, otherwise pdfjs
 *   throws `Cannot use the same canvas during multiple render()`.
 * - **Fresh canvas per run**: the canvas is created by the effect instead of React, so a cancelled
 *   task can never race with the next one on the same element.
 * - **DPR aware**: the backing store is `viewport * dpr` (capped at 2) with a `transform` matrix, so
 *   text stays sharp on retina screens without quadrupling memory.
 */
export function PageCanvas({
  pdfDoc,
  pageNumber,
  scale,
  dpr,
  width,
  height,
  label,
  rootMargin = '600px 0px',
}: PageCanvasProps) {
  const holderRef = useRef<HTMLDivElement | null>(null);
  const [visible, setVisible] = useState(false);
  const [rendered, setRendered] = useState(false);
  const cacheKey = canvasCacheKey(pdfDoc, pageNumber, scale, dpr);

  useEffect(() => {
    const holder = holderRef.current;
    if (!holder || typeof IntersectionObserver === 'undefined') {
      setVisible(true);
      return;
    }

    const observer = new IntersectionObserver(
      (entries) => {
        // Toggle both ways: pages that leave the margin release their canvas into the LRU, so a
        // continuous scroll never keeps hundreds of bitmaps alive (M4-5)
        const intersecting = entries.some((entry) => entry.isIntersecting);
        setVisible(intersecting);
      },
      { rootMargin },
    );
    observer.observe(holder);
    return () => observer.disconnect();
  }, [rootMargin]);

  useEffect(() => {
    if (!visible) return;
    const holder = holderRef.current;
    if (!holder) return;

    let cancelled = false;
    let cancelRender: (() => void) | null = null;
    let canvas: HTMLCanvasElement | null = null;
    let complete = false;

    const releaseCanvas = () => {
      if (!canvas) return;
      holder.replaceChildren();
      // Only a finished bitmap is safe to reuse; a cancelled render would flash a blank page
      if (complete) {
        cacheCanvas(cacheKey, canvas);
      } else {
        canvas.width = 0;
        canvas.height = 0;
      }
      canvas = null;
    };

    const cached = takeCachedCanvas(cacheKey);
    if (cached) {
      canvas = cached;
      holder.replaceChildren(cached);
      setRendered(true);
      return () => {
        cancelled = true;
        complete = true;
        releaseCanvas();
      };
    }

    setRendered(false);

    void (async () => {
      try {
        const page = await pdfDoc.getPage(pageNumber);
        if (cancelled) return;

        const viewport = page.getViewport({ scale });
        const element = document.createElement('canvas');
        element.width = Math.max(1, Math.ceil(viewport.width * dpr));
        element.height = Math.max(1, Math.ceil(viewport.height * dpr));
        element.style.width = `${viewport.width}px`;
        element.style.height = `${viewport.height}px`;
        element.style.display = 'block';
        element.setAttribute('role', 'img');
        element.setAttribute('aria-label', label);

        const context = element.getContext('2d');
        if (!context) return;

        canvas = element;
        holder.replaceChildren(element);

        const task = page.render({
          canvasContext: context,
          viewport,
          canvas: element,
          transform: dpr === 1 ? undefined : [dpr, 0, 0, dpr, 0, 0],
        });
        cancelRender = () => task.cancel();

        await task.promise;
        complete = true;
        if (!cancelled) setRendered(true);
      } catch {
        // RenderingCancelledException on zoom/teardown, or the document was destroyed mid-flight
      }
    })();

    return () => {
      cancelled = true;
      cancelRender?.();
      releaseCanvas();
    };
  }, [visible, pdfDoc, pageNumber, scale, dpr, label, cacheKey]);

  return (
    <div
      ref={holderRef}
      data-testid="pdf-page-canvas"
      data-rendered={rendered ? 'true' : 'false'}
      style={{ width, height }}
      className="flex items-center justify-center overflow-hidden"
    />
  );
}
