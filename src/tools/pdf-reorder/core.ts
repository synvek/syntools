import type { ToolResult } from '@/core/types';
import { loadPdfFromFile, reorderPages, isPdfFile, PDF_MAX_BYTES } from '@/core/pdf';

export { isPdfFile, PDF_MAX_BYTES };

export async function reorderPdfPages(file: File, order: number[], password?: string): Promise<ToolResult<Uint8Array>> {
  const loaded = await loadPdfFromFile(file, { password });
  if (!loaded.ok) return loaded;
  return reorderPages(loaded.value, order);
}

export function moveIndex(list: number[], from: number, to: number): number[] {
  if (from < 0 || to < 0 || from >= list.length || to >= list.length) return list;
  const next = [...list];
  const [item] = next.splice(from, 1);
  next.splice(to, 0, item);
  return next;
}
