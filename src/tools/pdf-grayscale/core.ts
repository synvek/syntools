import type { ToolResult } from '@/core/types';
import { fileToBytes, pdfToGrayscaleVisual, isPdfFile, PDF_MAX_BYTES } from '@/core/pdf';

export { isPdfFile, PDF_MAX_BYTES };

export async function grayscalePdfFile(file: File): Promise<ToolResult<Uint8Array>> {
  if (!isPdfFile(file)) return { ok: false, error: 'NOT_PDF' };
  if (file.size > PDF_MAX_BYTES) return { ok: false, error: 'TOO_LARGE' };
  return pdfToGrayscaleVisual(await fileToBytes(file));
}
