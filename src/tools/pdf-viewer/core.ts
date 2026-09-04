import { isPdfFile, PDF_MAX_BYTES, fileToBytes, openPdfjsDoc, renderPageToCanvas } from '@/core/pdf';
import type { ToolResult } from '@/core/types';
import type { PDFDocumentProxy } from 'pdfjs-dist';

export { isPdfFile, PDF_MAX_BYTES };

export async function openViewerDoc(
  file: File,
  password?: string,
): Promise<ToolResult<PDFDocumentProxy>> {
  if (!isPdfFile(file)) return { ok: false, error: 'NOT_PDF' };
  if (file.size > PDF_MAX_BYTES) return { ok: false, error: 'TOO_LARGE' };
  return openPdfjsDoc(await fileToBytes(file), { password });
}

export async function renderViewerPage(
  doc: PDFDocumentProxy,
  page: number,
  scale: number,
): Promise<ToolResult<HTMLCanvasElement>> {
  return renderPageToCanvas(doc, page, scale);
}
