import type { ToolResult } from '@/core/types';
import { loadPdfFromFile, cropPages, isPdfFile, PDF_MAX_BYTES } from '@/core/pdf';

export { isPdfFile, PDF_MAX_BYTES };

export async function cropPdfFile(
  file: File,
  margins: { top: number; right: number; bottom: number; left: number },
): Promise<ToolResult<Uint8Array>> {
  for (const v of Object.values(margins)) {
    if (!Number.isFinite(v) || v < 0) return { ok: false, error: 'INVALID_RANGE' };
  }
  const loaded = await loadPdfFromFile(file);
  if (!loaded.ok) return loaded;
  return cropPages(loaded.value, margins);
}
