/**
 * Outline (bookmarks) loader.
 *
 * pdfjs returns `dest` either as a named destination (string) or as an explicit array whose first
 * element is a page reference; both have to be resolved to a 1-based page number before the tree can
 * drive navigation. Kept out of the component so the resolution rules are unit-testable with a fake
 * document (jsdom has no worker).
 */

import type { PDFDocumentProxy } from 'pdfjs-dist';

export interface OutlineEntry {
  title: string;
  /** 1-based page in the source file; `null` for entries that only open a URL */
  page: number | null;
  items: OutlineEntry[];
}

/** Resolve one `dest` value to a 1-based page number, or `null` when it cannot be navigated */
export async function resolveOutlinePage(
  pdfDoc: PDFDocumentProxy,
  dest: unknown,
): Promise<number | null> {
  try {
    const explicit = typeof dest === 'string' ? await pdfDoc.getDestination(dest) : dest;
    if (!Array.isArray(explicit) || explicit.length === 0) return null;

    const ref = explicit[0] as Parameters<PDFDocumentProxy['getPageIndex']>[0];
    if (typeof ref === 'number') return ref + 1;
    const index = await pdfDoc.getPageIndex(ref);
    return index + 1;
  } catch {
    // Broken or non-navigable destination: keep the title, drop the link
    return null;
  }
}

async function mapNodes(
  pdfDoc: PDFDocumentProxy,
  nodes: Array<{ title?: string; dest?: unknown; items?: unknown[] }>,
): Promise<OutlineEntry[]> {
  const entries: OutlineEntry[] = [];
  for (const node of nodes) {
    const children = Array.isArray(node.items) ? await mapNodes(pdfDoc, node.items as never[]) : [];
    entries.push({
      title: node.title?.trim() || '—',
      page: node.dest == null ? null : await resolveOutlinePage(pdfDoc, node.dest),
      items: children,
    });
  }
  return entries;
}

/** Empty array (not an error) when the file has no outline, so the panel can show its empty state */
export async function loadOutline(pdfDoc: PDFDocumentProxy): Promise<OutlineEntry[]> {
  try {
    const outline = await pdfDoc.getOutline();
    if (!outline || outline.length === 0) return [];
    return await mapNodes(pdfDoc, outline as never[]);
  } catch {
    return [];
  }
}
