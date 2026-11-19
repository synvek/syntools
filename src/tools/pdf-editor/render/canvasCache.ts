/**
 * LRU of rendered page canvases (M4-5).
 *
 * pdfjs rendering is the most expensive thing the editor does; keeping the last few bitmaps means
 * scrolling back one page is instant, while the cap stops a long continuous scroll from retaining
 * every canvas in memory. Entries hold detached canvases, never DOM nodes inside the document.
 */

/** Plan budget: at most 8 off-screen page bitmaps */
export const CANVAS_CACHE_MAX = 8;

const cache = new Map<string, HTMLCanvasElement>();

interface FingerprintSource {
  fingerprints?: Array<string | null> | null;
}

/** Identity for a rendered bitmap: document + page + zoom + DPR */
export function canvasCacheKey(
  pdfDoc: FingerprintSource | null | undefined,
  pageNumber: number,
  scale: number,
  dpr: number,
): string {
  const docKey =
    pdfDoc?.fingerprints?.filter((value): value is string => Boolean(value)).join('|') ?? 'doc';
  return `${docKey}:${pageNumber}:${scale.toFixed(4)}:${dpr.toFixed(2)}`;
}

/**
 * Move a cached canvas back into the live DOM. The entry is removed so the same bitmap is never
 * attached to two page boxes.
 */
export function takeCachedCanvas(key: string): HTMLCanvasElement | null {
  const canvas = cache.get(key);
  if (!canvas) return null;
  cache.delete(key);
  return canvas;
}

/** Store a finished canvas; the oldest entries are released (backing store set to 0) on overflow */
export function cacheCanvas(key: string, canvas: HTMLCanvasElement): void {
  const existing = cache.get(key);
  if (existing && existing !== canvas) release(existing);
  cache.delete(key);
  cache.set(key, canvas);

  while (cache.size > CANVAS_CACHE_MAX) {
    const oldest = cache.keys().next();
    if (oldest.done) break;
    const evicted = cache.get(oldest.value);
    cache.delete(oldest.value);
    if (evicted) release(evicted);
  }
}

/** Drop every cached bitmap (file closed / editor unmounted) */
export function clearCanvasCache(): void {
  for (const canvas of cache.values()) release(canvas);
  cache.clear();
}

export function canvasCacheSize(): number {
  return cache.size;
}

function release(canvas: HTMLCanvasElement): void {
  // Safari keeps the bitmap until the next GC without this; harmless elsewhere
  canvas.width = 0;
  canvas.height = 0;
}
