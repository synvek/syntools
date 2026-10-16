import { applyPixelPassToData } from '../render/pixelPass';
import type { Adjustments, FilterSpec } from '../model/types';

/**
 * 全分辨率烘焙 Worker。
 *
 * 主线程把源画布转成 `ImageBitmap` 转移进来，这里用 `OffscreenCanvas` 重放同一条管线
 * （CSS 滤镜 + 逐像素通道，与 `render/filters.ts` 的实现同源），再以位图形式转移回去。
 *
 * 与主线程分工：主线程只跑**降采样**的实时预览，全分辨率的像素运算全部落在 Worker 里，
 * 因此拖滑杆 / 落笔期间主线程不会因为一次全量 `getImageData` + 逐像素循环而卡住。
 */

export interface BakeWorkerRequest {
  id: number;
  width: number;
  height: number;
  bitmap: ImageBitmap;
  /** CSS 能表达的滤镜部分（`ctx.filter` 的字符串） */
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

/** 单次烘焙：可被单测以「注入伪造 OffscreenCanvas」的方式覆盖（真实环境走 worker 全局） */
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

// 只有在真正的 Worker 环境里才挂载（单测 / SSR 下 import 本模块不应报错）
if (typeof self !== 'undefined' && typeof (self as unknown as Worker).postMessage === 'function') {
  attachBakeWorker(self as unknown as WorkerScope);
}
