import { PDFDocument } from '@cantoo/pdf-lib';
import { GlobalWorkerOptions } from 'pdfjs-dist';
import type { ToolResult } from '@/core/types';
import { fileToBytes, isPdfFile, loadPdfFromBytes, openPdfjsDoc, PDF_MAX_BYTES } from '@/core/pdf';

export type CompressLevel = 'objects' | 'raster';

export interface CompressOptions {
  level: CompressLevel;
  /** raster 模式下的 JPEG 质量 0–1 */
  quality: number;
  /** raster 模式渲染缩放（越大越清晰、体积越大） */
  scale: number;
}

export interface CompressResult {
  bytes: Uint8Array;
  originalSize: number;
  pages: number;
  /** 压缩率（0–1），负数表示变大 */
  ratio: number;
  lossy: boolean;
}

let workerReady = false;
function ensureWorker() {
  if (workerReady) return;
  GlobalWorkerOptions.workerSrc = new URL(
    'pdfjs-dist/build/pdf.worker.min.mjs',
    import.meta.url,
  ).toString();
  workerReady = true;
}

export async function compressPdf(
  file: File,
  password: string,
  opts: CompressOptions,
): Promise<ToolResult<CompressResult>> {
  if (!isPdfFile(file)) return { ok: false, error: 'NOT_PDF' };
  if (file.size > PDF_MAX_BYTES) return { ok: false, error: 'TOO_LARGE' };

  const originalSize = file.size;
  const bytes = await fileToBytes(file);

  if (opts.level === 'objects') {
    const loaded = await loadPdfFromBytes(bytes, { password });
    if (!loaded.ok) return loaded;
    try {
      const out = await loaded.value.save({ useObjectStreams: true });
      return {
        ok: true,
        value: {
          bytes: out,
          originalSize,
          pages: loaded.value.getPageCount(),
          ratio: 1 - out.byteLength / originalSize,
          lossy: false,
        },
      };
    } catch {
      return { ok: false, error: 'PROCESS_FAILED' };
    }
  }

  // raster：逐页重渲染为 JPEG 后重新组装（有损压缩）
  const doc = await openPdfjsDoc(bytes, { password });
  if (!doc.ok) return doc;
  ensureWorker();
  try {
    const out = await PDFDocument.create();
    for (let i = 1; i <= doc.value.numPages; i += 1) {
      const page = await doc.value.getPage(i);
      const viewport = page.getViewport({ scale: opts.scale });
      const canvas = document.createElement('canvas');
      canvas.width = Math.ceil(viewport.width);
      canvas.height = Math.ceil(viewport.height);
      const ctx = canvas.getContext('2d');
      if (!ctx) return { ok: false, error: 'PROCESS_FAILED' };
      await page.render({ canvasContext: ctx, viewport, canvas }).promise;
      const dataUrl = canvas.toDataURL('image/jpeg', opts.quality);
      const base64 = dataUrl.slice(dataUrl.indexOf(',') + 1);
      const bin = atob(base64);
      const imgBytes = new Uint8Array(bin.length);
      for (let k = 0; k < bin.length; k += 1) imgBytes[k] = bin.charCodeAt(k);
      const img = await out.embedJpg(imgBytes);
      const p = out.addPage([viewport.width, viewport.height]);
      p.drawImage(img, { x: 0, y: 0, width: viewport.width, height: viewport.height });
    }
    await doc.value.cleanup();
    const outBytes = await out.save();
    return {
      ok: true,
      value: {
        bytes: outBytes,
        originalSize,
        pages: doc.value.numPages,
        ratio: 1 - outBytes.byteLength / originalSize,
        lossy: true,
      },
    };
  } catch {
    return { ok: false, error: 'PROCESS_FAILED' };
  }
}
