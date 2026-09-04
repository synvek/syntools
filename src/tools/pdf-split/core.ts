import type { ToolResult } from '@/core/types';
import { loadPdfFromFile, splitPdfToPages, isPdfFile, PDF_MAX_BYTES } from '@/core/pdf';

export { isPdfFile, PDF_MAX_BYTES };

export async function splitPdfFile(file: File, password?: string): Promise<ToolResult<Uint8Array[]>> {
  const loaded = await loadPdfFromFile(file, { password });
  if (!loaded.ok) return loaded;
  return splitPdfToPages(loaded.value);
}
