import type { ToolResult } from '@/core/types';
import { PDFDocument } from '@cantoo/pdf-lib';
import { mergePdfs, loadPdfFromBytes, fileToBytes, isPdfFile, PDF_MAX_BYTES } from '@/core/pdf';

export { isPdfFile, PDF_MAX_BYTES };

export async function mergePdfFiles(
  files: File[],
  password?: string,
): Promise<ToolResult<Uint8Array>> {
  if (files.length < 2) return { ok: false, error: 'EMPTY' };
  const docs: PDFDocument[] = [];
  for (const f of files) {
    if (!isPdfFile(f)) return { ok: false, error: 'NOT_PDF' };
    if (f.size > PDF_MAX_BYTES) return { ok: false, error: 'TOO_LARGE' };
    const bytes = await fileToBytes(f);
    const loaded = await loadPdfFromBytes(bytes, { password });
    if (!loaded.ok) return loaded;
    docs.push(loaded.value);
  }
  return mergePdfs(docs);
}
