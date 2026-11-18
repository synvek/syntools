import { useEffect, useRef, useState } from 'react';
import type { PDFDocumentProxy } from 'pdfjs-dist';

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
}: PageCanvasProps) {
  const holderRef = useRef<HTMLDivElement | null>(null);
  const [visible, setVisible] = useState(false);
  const [rendered, setRendered] = useState(false);

  useEffect(() => {
    const holder = holderRef.current;
    if (!holder || typeof IntersectionObserver === 'undefined') {
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
      { rootMargin: '600px 0px' },
    );
    observer.observe(holder);
    return () => observer.disconnect();
  }, []);

  useEffect(() => {
    if (!visible) return;
    const holder = holderRef.current;
    if (!holder) return;

    let cancelled = false;
    let cancelRender: (() => void) | null = null;
    let canvas: HTMLCanvasElement | null = null;

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
        if (!cancelled) setRendered(true);
      } catch {
        // RenderingCancelledException on zoom/teardown, or the document was destroyed mid-flight
      }
    })();

    return () => {
      cancelled = true;
      cancelRender?.();
      canvas?.remove();
    };
  }, [visible, pdfDoc, pageNumber, scale, dpr, label]);

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
