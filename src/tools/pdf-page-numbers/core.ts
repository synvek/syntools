import type { ToolResult } from '@/core/types';
import { loadPdfFromFile, addPageNumbers, type PageNumberPosition, isPdfFile, PDF_MAX_BYTES } from '@/core/pdf';

export { isPdfFile, PDF_MAX_BYTES };
export type { PageNumberPosition };

export async function addNumbersToPdf(
  file: File,
  opts: {
    format: string;
    position: PageNumberPosition;
    fontSize: number;
    startFrom: number;
    password?: string;
  },
): Promise<ToolResult<Uint8Array>> {
  const loaded = await loadPdfFromFile(file, { password: opts.password });
  if (!loaded.ok) return loaded;
  return addPageNumbers(loaded.value, opts);
}
