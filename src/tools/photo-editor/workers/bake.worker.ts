import { applyPixelPassToData } from '../render/pixelPass';
import type { Adjustments, FilterSpec } from '../model/types';

/**
 * Full-resolution bake Worker.
 *
 * The main thread turns the source canvas into an `ImageBitmap` and transfers it in; here `OffscreenCanvas` replays the
 * same pipeline (CSS filters + the per-pixel pass, the very implementation in `render/filters.ts`) and transfers a bitmap back.
 *
 * Division of labor: the main thread only runs the **downsampled** live preview and all full-resolution pixel work lands
 * here, so painting / dragging sliders never stalls the main thread on a full `getImageData` plus a per-pixel loop.
 */

export interface BakeWorkerRequest {
  id: number;
  width: number;
  height: number;
  bitmap: ImageBitmap;
  /** The part of the filter CSS can express (a `ctx.filter` string) */
  cssFilter: string;
  adjustments: Adjustments;
  filters: FilterSpec[];
}

export interface BakeWorkerResponse {
  id: number;
  bitmap: ImageBitmap | null;
}

interface WorkerScope {
  onmessage: ((event: MessageEvent<BakeWorkerRequest>) => void) | null;
  postMessage: (message: unknown, transfer?: Transferable[]) => void;
}

/** One bake: unit tests can override it by injecting a fake OffscreenCanvas (the real environment uses the worker global) */
export async function bakeToBitmap(
  request: BakeWorkerRequest,
  createCanvas: (width: number, height: number) => OffscreenCanvas,
): Promise<ImageBitmap | null> {
  const canvas = createCanvas(request.width, request.height);
  const ctx = canvas.getContext('2d') as OffscreenCanvasRenderingContext2D | null;
  if (!ctx) return null;
  ctx.filter = request.cssFilter || 'none';
  ctx.drawImage(request.bitmap, 0, 0, request.width, request.height);
  ctx.filter = 'none';
  const frame = ctx.getImageData(0, 0, request.width, request.height);
  applyPixelPassToData(
    request.width,
    request.height,
    frame.data,
    request.adjustments,
    request.filters,
  );
  ctx.putImageData(frame, 0, 0);
  return canvas.transferToImageBitmap();
}

export function attachBakeWorker(scope: WorkerScope): void {
  scope.onmessage = (event) => {
    const request = event.data;
    const respond = (bitmap: ImageBitmap | null) => {
      const message: BakeWorkerResponse = { id: request.id, bitmap };
      scope.postMessage(message, bitmap ? [bitmap] : []);
    };
    void bakeToBitmap(request, (width, height) => new OffscreenCanvas(width, height))
      .then(respond)
      .catch(() => respond(null));
  };
}

// Only mount in a real Worker environment (importing this module must not throw under tests / SSR)
if (typeof self !== 'undefined' && typeof (self as unknown as Worker).postMessage === 'function') {
  attachBakeWorker(self as unknown as WorkerScope);
}
