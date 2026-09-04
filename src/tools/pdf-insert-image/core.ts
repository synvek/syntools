import type { ToolResult } from '@/core/types';
import {
  loadPdfFromFile,
  embedImageOnPages,
  fileToBytes,
  parsePageSelection,
  isPdfFile,
  isImageFile,
  PDF_MAX_BYTES,
} from '@/core/pdf';

export { isPdfFile, isImageFile, PDF_MAX_BYTES, parsePageSelection };

export async function insertImageIntoPdf(
  pdf: File,
  image: File,
  opts: {
    selection: string;
    allPages: boolean;
    x: number;
    y: number;
    width: number;
    password?: string;
  },
): Promise<ToolResult<Uint8Array>> {
  if (!isImageFile(image)) return { ok: false, error: 'NOT_IMAGE' };
  const loaded = await loadPdfFromFile(pdf, { password: opts.password });
  if (!loaded.ok) return loaded;
  let pageIndices: number[] | undefined;
  if (!opts.allPages) {
    const sel = parsePageSelection(opts.selection, loaded.value.getPageCount());
    if (!sel.ok) return sel;
    pageIndices = sel.value;
  }
  return embedImageOnPages(loaded.value, await fileToBytes(image), {
    mime: image.type,
    pageIndices,
    x: opts.x,
    y: opts.y,
    width: opts.width,
  });
}
