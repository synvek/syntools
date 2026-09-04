import type { ToolResult } from '@/core/types';
import {
  fileToBytes,
  isPdfFile,
  PDF_MAX_BYTES,
  openPdfjsDoc,
  renderPageDataUrl,
  parsePageSelection,
} from '@/core/pdf';

export { isPdfFile, PDF_MAX_BYTES, parsePageSelection };

export type ImageFormat = 'image/png' | 'image/jpeg';

export async function pdfPagesToImages(
  file: File,
  opts: { format: ImageFormat; scale: number; selection?: string; password?: string },
): Promise<ToolResult<string[]>> {
  if (!isPdfFile(file)) return { ok: false, error: 'NOT_PDF' };
  if (file.size > PDF_MAX_BYTES) return { ok: false, error: 'TOO_LARGE' };
  const bytes = await fileToBytes(file);
  const doc = await openPdfjsDoc(bytes, { password: opts.password });
  if (!doc.ok) return doc;
  try {
    let pages: number[];
    if (opts.selection?.trim()) {
      const sel = parsePageSelection(opts.selection, doc.value.numPages);
      if (!sel.ok) return sel;
      pages = sel.value.map((i) => i + 1);
    } else {
      pages = Array.from({ length: doc.value.numPages }, (_, i) => i + 1);
    }
    const urls: string[] = [];
    for (const p of pages) {
      const r = await renderPageDataUrl(doc.value, p, opts.scale, opts.format);
      if (!r.ok) return r;
      urls.push(r.value);
    }
    await doc.value.cleanup();
    return { ok: true, value: urls };
  } catch {
    return { ok: false, error: 'PROCESS_FAILED' };
  }
}
