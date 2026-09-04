import type { ToolResult } from '@/core/types';
import { loadPdfFromFile, rotatePages, parsePageSelection, type RotateAngle, isPdfFile, PDF_MAX_BYTES } from '@/core/pdf';

export { isPdfFile, PDF_MAX_BYTES, parsePageSelection };
export type { RotateAngle };

export async function rotatePdfPages(
  file: File,
  selection: string,
  angle: RotateAngle,
  allPages: boolean,
  password?: string,
): Promise<ToolResult<Uint8Array>> {
  const loaded = await loadPdfFromFile(file, { password });
  if (!loaded.ok) return loaded;
  let indices: number[] = [];
  if (!allPages) {
    const pages = parsePageSelection(selection, loaded.value.getPageCount());
    if (!pages.ok) return pages;
    indices = pages.value;
  }
  return rotatePages(loaded.value, indices, angle);
}
