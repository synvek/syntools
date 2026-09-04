import type { ToolResult } from '@/core/types';
import { loadPdfFromFile, addHeaderFooter, type HAlign, isPdfFile, PDF_MAX_BYTES } from '@/core/pdf';

export { isPdfFile, PDF_MAX_BYTES };
export type { HAlign };

export async function applyHeaderFooter(
  file: File,
  opts: { header: string; footer: string; align: HAlign; fontSize: number },
): Promise<ToolResult<Uint8Array>> {
  if (!opts.header.trim() && !opts.footer.trim()) return { ok: false, error: 'EMPTY' };
  const loaded = await loadPdfFromFile(file);
  if (!loaded.ok) return loaded;
  return addHeaderFooter(loaded.value, opts);
}
