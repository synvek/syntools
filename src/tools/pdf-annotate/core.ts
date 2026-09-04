import type { ToolResult } from '@/core/types';
import {
  loadPdfFromFile,
  annotatePages,
  type AnnotateKind,
  isPdfFile,
  PDF_MAX_BYTES,
} from '@/core/pdf';

export { isPdfFile, PDF_MAX_BYTES };
export type { AnnotateKind };

export type AnnotateDraft = {
  kind: AnnotateKind;
  page: number; // 1-based
  x: number;
  y: number;
  width: number;
  height: number;
  color: string;
};

export async function annotatePdfFile(file: File, drafts: AnnotateDraft[], password?: string): Promise<ToolResult<Uint8Array>> {
  if (drafts.length === 0) return { ok: false, error: 'EMPTY' };
  const loaded = await loadPdfFromFile(file, { password });
  if (!loaded.ok) return loaded;
  const count = loaded.value.getPageCount();
  return annotatePages(
    loaded.value,
    drafts.map((d) => ({
      kind: d.kind,
      pageIndex: d.page - 1,
      x: d.x,
      y: d.y,
      width: d.width,
      height: d.height,
      color: d.color,
    })).filter((a) => a.pageIndex >= 0 && a.pageIndex < count),
  );
}
