import { useEffect, useRef, useState } from 'react';
import type { PDFDocumentProxy } from 'pdfjs-dist';
import { fitPageScale, fitWidthScale } from '../model/coords';
import { clampZoom } from '../model/doc';
import type { ZoomMode } from '../model/types';

/** Breathing room around the page (matches the scroll container padding) */
export const PAGE_PADDING = 24;

export interface PageSize {
  width: number;
  height: number;
}

export interface ContainerSize {
  width: number;
  height: number;
}

/**
 * Resolve the CSS scale (px per pt) for the current zoom mode.
 *
 * Fit modes are recomputed from the measured container, `custom` uses the stored zoom. Clamped to
 * 50%–400% like the ribbon, so a very wide window cannot blow past the agreed range.
 */
export function resolveScale(input: {
  mode: ZoomMode;
  zoom: number;
  pageSize: PageSize | null;
  container: ContainerSize | null;
  padding?: number;
}): number {
  const padding = input.padding ?? PAGE_PADDING;
  if (input.mode === 'custom' || !input.pageSize || !input.container) return clampZoom(input.zoom);
  if (input.mode === 'fit-page') {
    return clampZoom(fitPageScale(input.pageSize, input.container, padding));
  }
  return clampZoom(fitWidthScale(input.pageSize, input.container.width, padding));
}

/** Cap at 2 so a 3x retina screen does not quadruple canvas memory for little gain */
export function renderDpr(): number {
  const dpr = globalThis.devicePixelRatio;
  if (!dpr || dpr <= 0) return 1;
  return Math.min(dpr, 2);
}

/**
 * Visual size of the current page plus the resolved scale.
 *
 * One metric drives every placeholder: mixed-size PDFs will settle once each page renders (M2 can
 * measure per page, but per-page `getPage()` calls on a 500-page file are not worth it in M1).
 */
export function usePageMetrics({
  pdfDoc,
  pageNumber,
  mode,
  zoom,
  container,
  padding = PAGE_PADDING,
}: {
  pdfDoc: PDFDocumentProxy | null;
  pageNumber: number;
  mode: ZoomMode;
  zoom: number;
  container: ContainerSize | null;
  padding?: number;
}): { pageSize: PageSize | null; scale: number } {
  const [pageSize, setPageSize] = useState<PageSize | null>(null);
  /** Which document the cached size belongs to: only a new document may clear it */
  const docRef = useRef<PDFDocumentProxy | null>(null);

  useEffect(() => {
    /*
     * Do not blank the size on every page change. `pageSize === null` collapses every placeholder box
     * to 0 px, the scroll container loses its content, and the browser clamps `scrollTop` back to 0 —
     * which showed up as "scroll to page 2 and the viewport jumps back to page 1". The previous size
     * stays until the new page resolves; sizes differ only slightly for mixed-size PDFs.
     */
    if (docRef.current !== pdfDoc) {
      docRef.current = pdfDoc;
      setPageSize(null);
    }
    if (!pdfDoc) return;

    let cancelled = false;
    void (async () => {
      try {
        const page = await pdfDoc.getPage(pageNumber);
        if (cancelled) return;
        const viewport = page.getViewport({ scale: 1 });
        setPageSize({ width: viewport.width, height: viewport.height });
      } catch {
        if (!cancelled) setPageSize(null);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [pdfDoc, pageNumber]);

  return { pageSize, scale: resolveScale({ mode, zoom, pageSize, container, padding }) };
}
