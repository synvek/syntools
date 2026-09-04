import type { ToolResult } from '@/core/types';
import {
  loadPdfFromFile,
  embedImageOnPages,
  parsePageSelection,
  isPdfFile,
  isImageFile,
  PDF_MAX_BYTES,
} from '@/core/pdf';

export { isPdfFile, isImageFile, PDF_MAX_BYTES, parsePageSelection };

export async function signPdfWithImage(
  pdf: File,
  imageBytes: Uint8Array,
  mime: string,
  opts: {
    selection: string;
    allPages: boolean;
    x: number;
    y: number;
    width: number;
    password?: string;
  },
): Promise<ToolResult<Uint8Array>> {
  const loaded = await loadPdfFromFile(pdf, { password: opts.password });
  if (!loaded.ok) return loaded;
  let pageIndices: number[] | undefined;
  if (!opts.allPages) {
    const sel = parsePageSelection(opts.selection, loaded.value.getPageCount());
    if (!sel.ok) return sel;
    pageIndices = sel.value;
  }
  return embedImageOnPages(loaded.value, imageBytes, {
    mime,
    pageIndices,
    x: opts.x,
    y: opts.y,
    width: opts.width,
  });
}

export function dataUrlToBytes(dataUrl: string): { bytes: Uint8Array; mime: string } | null {
  const m = /^data:([^;]+);base64,(.+)$/.exec(dataUrl);
  if (!m) return null;
  const bin = atob(m[2]);
  const bytes = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
  return { bytes, mime: m[1] };
}
