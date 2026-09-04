import type { ToolResult } from '@/core/types';
import { loadPdfFromFile, extractPages, parsePageSelection, isPdfFile, PDF_MAX_BYTES } from '@/core/pdf';

export { isPdfFile, PDF_MAX_BYTES, parsePageSelection };

export async function extractPdfPages(file: File, selection: string): Promise<ToolResult<Uint8Array>> {
  const loaded = await loadPdfFromFile(file);
  if (!loaded.ok) return loaded;
  const pages = parsePageSelection(selection, loaded.value.getPageCount());
  if (!pages.ok) return pages;
  return extractPages(loaded.value, pages.value);
}
