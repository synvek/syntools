import {
  GlobalWorkerOptions,
  getDocument,
  PasswordResponses,
  type PDFDocumentProxy,
} from 'pdfjs-dist';
import type { ToolResult } from '@/core/types';

let workerReady = false;

export function ensurePdfjsWorker() {
  if (workerReady) return;
  // Vite: 将 worker 作为独立资源
  GlobalWorkerOptions.workerSrc = new URL(
    'pdfjs-dist/build/pdf.worker.min.mjs',
    import.meta.url,
  ).toString();
  workerReady = true;
}

export type OpenPdfjsOptions = {
  password?: string;
};

export async function openPdfjsDoc(
  bytes: Uint8Array,
  opts?: OpenPdfjsOptions,
): Promise<ToolResult<PDFDocumentProxy>> {
  try {
    ensurePdfjsWorker();
    const data = bytes.slice();
    const password = opts?.password?.trim() || undefined;
    const task = getDocument({ data, useSystemFonts: true, password });
    const doc = await task.promise;
    if (doc.numPages < 1) return { ok: false, error: 'NO_PAGES' };
    return { ok: true, value: doc };
  } catch (err) {
    const code = (err as { code?: number })?.code;
    if (code === PasswordResponses.NEED_PASSWORD) return { ok: false, error: 'NEED_PASSWORD' };
    if (code === PasswordResponses.INCORRECT_PASSWORD) {
      return { ok: false, error: 'WRONG_PASSWORD' };
    }
    const msg = String((err as Error)?.message ?? err);
    if (/password incorrect|incorrect password/i.test(msg)) {
      return { ok: false, error: 'WRONG_PASSWORD' };
    }
    if (/no password|password required|need.?password|encrypted/i.test(msg)) {
      return { ok: false, error: 'NEED_PASSWORD' };
    }
    return { ok: false, error: 'LOAD_FAILED' };
  }
}

export async function renderPageToCanvas(
  doc: PDFDocumentProxy,
  pageNumber1Based: number,
  scale = 1.5,
): Promise<ToolResult<HTMLCanvasElement>> {
  try {
    const page = await doc.getPage(pageNumber1Based);
    const viewport = page.getViewport({ scale });
    const canvas = document.createElement('canvas');
    canvas.width = Math.ceil(viewport.width);
    canvas.height = Math.ceil(viewport.height);
    const ctx = canvas.getContext('2d');
    if (!ctx) return { ok: false, error: 'PROCESS_FAILED' };
    await page.render({ canvasContext: ctx, viewport, canvas }).promise;
    return { ok: true, value: canvas };
  } catch {
    return { ok: false, error: 'PROCESS_FAILED' };
  }
}

export async function renderPageDataUrl(
  doc: PDFDocumentProxy,
  pageNumber1Based: number,
  scale = 1.5,
  format: 'image/png' | 'image/jpeg' = 'image/png',
  quality = 0.92,
): Promise<ToolResult<string>> {
  const canvasResult = await renderPageToCanvas(doc, pageNumber1Based, scale);
  if (!canvasResult.ok) return canvasResult;
  try {
    const url =
      format === 'image/jpeg'
        ? canvasResult.value.toDataURL('image/jpeg', quality)
        : canvasResult.value.toDataURL('image/png');
    return { ok: true, value: url };
  } catch {
    return { ok: false, error: 'PROCESS_FAILED' };
  }
}

/** 将 canvas 转为灰度 */
export function canvasToGrayscale(source: HTMLCanvasElement): HTMLCanvasElement {
  const canvas = document.createElement('canvas');
  canvas.width = source.width;
  canvas.height = source.height;
  const ctx = canvas.getContext('2d');
  if (!ctx) return source;
  ctx.drawImage(source, 0, 0);
  const image = ctx.getImageData(0, 0, canvas.width, canvas.height);
  const d = image.data;
  for (let i = 0; i < d.length; i += 4) {
    const g = Math.round(0.299 * d[i] + 0.587 * d[i + 1] + 0.114 * d[i + 2]);
    d[i] = g;
    d[i + 1] = g;
    d[i + 2] = g;
  }
  ctx.putImageData(image, 0, 0);
  return canvas;
}
