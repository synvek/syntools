import type { ToolResult } from '@/core/types';
import { loadPdfFromFile, addTextToPages, parsePageSelection, isPdfFile, PDF_MAX_BYTES } from '@/core/pdf';

export { isPdfFile, PDF_MAX_BYTES, parsePageSelection };

export async function addTextToPdf(
  file: File,
  opts: { text: string; selection: string; allPages: boolean; x: number; y: number; fontSize: number; color: string },
): Promise<ToolResult<Uint8Array>> {
  const loaded = await loadPdfFromFile(file);
  if (!loaded.ok) return loaded;
  let pageIndices: number[] | undefined;
  if (!opts.allPages) {
    const sel = parsePageSelection(opts.selection, loaded.value.getPageCount());
    if (!sel.ok) return sel;
    pageIndices = sel.value;
  }
  return addTextToPages(loaded.value, {
    text: opts.text,
    pageIndices,
    x: opts.x,
    y: opts.y,
    fontSize: opts.fontSize,
    color: opts.color,
  });
}
