import type { ToolResult } from '@/core/types';
import { fileToBytes, encryptPdf, isPdfFile, PDF_MAX_BYTES, type PdfPermissionFlags } from '@/core/pdf';

export { isPdfFile, PDF_MAX_BYTES };
export type { PdfPermissionFlags };

export async function encryptPdfFile(
  file: File,
  userPassword: string,
  ownerPassword: string,
  permissions: PdfPermissionFlags,
): Promise<ToolResult<Uint8Array>> {
  if (!isPdfFile(file)) return { ok: false, error: 'NOT_PDF' };
  if (file.size > PDF_MAX_BYTES) return { ok: false, error: 'TOO_LARGE' };
  return encryptPdf(await fileToBytes(file), { userPassword, ownerPassword, permissions });
}
