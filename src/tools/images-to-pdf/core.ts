import type { ToolResult } from '@/core/types';
import { fileToBytes, imagesToPdf, isImageFile, PDF_MAX_BYTES } from '@/core/pdf';

export { isImageFile, PDF_MAX_BYTES };

export async function convertImagesToPdf(files: File[]): Promise<ToolResult<Uint8Array>> {
  if (files.length === 0) return { ok: false, error: 'EMPTY' };
  const images: Array<{ bytes: Uint8Array; mime: string }> = [];
  for (const f of files) {
    if (!isImageFile(f)) return { ok: false, error: 'NOT_IMAGE' };
    if (f.size > PDF_MAX_BYTES) return { ok: false, error: 'TOO_LARGE' };
    images.push({ bytes: await fileToBytes(f), mime: f.type || 'image/jpeg' });
  }
  return imagesToPdf(images);
}
