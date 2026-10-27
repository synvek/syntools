import type { ToolResult } from '@/core/types';
import { fileToBytes, isPdfFile, loadPdfFromBytes, PDF_MAX_BYTES } from '@/core/pdf';

export interface DecryptResult {
  bytes: Uint8Array;
  pages: number;
  originalEncrypted: boolean;
}

/** Validate the input and return the file bytes (wraps size and type checks for unit testing) */
export async function readPdfBytes(file: File): Promise<ToolResult<Uint8Array>> {
  if (!isPdfFile(file)) return { ok: false, error: 'NOT_PDF' };
  if (file.size > PDF_MAX_BYTES) return { ok: false, error: 'TOO_LARGE' };
  return { ok: true, value: await fileToBytes(file) };
}

/**
 * Remove a PDF password: load with the password and save as-is (without re-encrypting) to get an unprotected file.
 * Equivalent to qpdf --decrypt.
 */
export async function decryptPdf(file: File, password: string): Promise<ToolResult<DecryptResult>> {
  const bytesResult = await readPdfBytes(file);
  if (!bytesResult.ok) return bytesResult;

  const loaded = await loadPdfFromBytes(bytesResult.value, { password });
  if (!loaded.ok) return loaded;

  try {
    const bytes = await loaded.value.save();
    return {
      ok: true,
      value: { bytes, pages: loaded.value.getPageCount(), originalEncrypted: true },
    };
  } catch {
    return { ok: false, error: 'PROCESS_FAILED' };
  }
}
