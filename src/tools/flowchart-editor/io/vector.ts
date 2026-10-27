/**
 * Self-drawn vector export: renders the document as pure SVG (shapes as paths, text as <text>, scalable and selectable).
 *
 * Advantages over DOM capture (html-to-image):
 * - The output is true vector, opens correctly in external tools (Illustrator / Inkscape), and text stays editable and selectable;
 * - No need to switch to the target page before capturing, so multi-page export does not disturb the user's current page;
 * - Shapes share `drawShape` with the canvas, keeping the visuals identical.
 *
 * Limitation: formula nodes rely on KaTeX's HTML output and cannot be vectorized into SVG text,
 * so callers fall back to the DOM capture path when a formula node is present (see `pageHasFormula`).
 */

import { downloadDataUrl } from '@/core/pdf/download';
import { activePageOf } from '../model/migrate';
import type { FlowDoc, FlowPage } from '../model/types';
import { VectorScene } from './VectorScene';

export interface VectorExportOptions {
  /** Export range: selection only / current page / all pages (defaults to the current page) */
  range?: 'selection' | 'current' | 'all';
  /** Padding around the content (pixels) */
  padding?: number;
  /** Transparent background */
  transparent?: boolean;
  /** Node ids to export when `range=selection` */
  selection?: readonly string[];
}

/** Keep only the selected nodes (plus their container ancestors) and the related edges */
function filterPage(page: FlowPage, ids?: readonly string[]): FlowPage {
  if (!ids || ids.length === 0) return page;
  const keep = new Set(ids);
  const nodes = page.nodes.filter(
    (n) => keep.has(n.id) || (n.parentId ? keep.has(n.parentId) : false),
  );
  const keptIds = new Set(nodes.map((n) => n.id));
  return {
    ...page,
    nodes,
    edges: page.edges.filter((e) => keptIds.has(e.source) && keptIds.has(e.target)),
  };
}

/** Whether the page contains formula nodes the vector pipeline cannot render faithfully */
export function pageHasFormula(page: FlowPage): boolean {
  return page.nodes.some((n) => n.type === 'formula');
}

/** Render a single page as a vector SVG string */
export async function pageToVectorSvg(
  page: FlowPage,
  options: VectorExportOptions = {},
): Promise<string> {
  const padding = options.padding ?? 24;
  const transparent = options.transparent ?? false;
  const filtered = filterPage(page, options.selection);
  const { renderToStaticMarkup } = await import('react-dom/server');
  const markup = renderToStaticMarkup(VectorScene({ page: filtered, padding, transparent }));
  return `<?xml version="1.0" encoding="UTF-8"?>\n${markup}`;
}

/** Vector SVG → PNG dataURL (for PDF / bitmap fallback) */
export async function vectorSvgToPngDataUrl(svg: string, scale = 2): Promise<string | null> {
  try {
    const url = URL.createObjectURL(new Blob([svg], { type: 'image/svg+xml;charset=utf-8' }));
    const img = new Image();
    await new Promise<void>((resolve, reject) => {
      img.onload = () => resolve();
      img.onerror = () => reject(new Error('SVG_LOAD_FAILED'));
      img.src = url;
    });
    const width = img.naturalWidth || img.width || 1;
    const height = img.naturalHeight || img.height || 1;
    const canvas = document.createElement('canvas');
    canvas.width = Math.max(1, Math.round(width * scale));
    canvas.height = Math.max(1, Math.round(height * scale));
    const ctx = canvas.getContext('2d');
    if (!ctx) {
      URL.revokeObjectURL(url);
      return null;
    }
    ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
    URL.revokeObjectURL(url);
    return canvas.toDataURL('image/png');
  } catch {
    return null;
  }
}

function safeName(name: string, fallback: string): string {
  const cleaned = name.replace(/[\\/:*?"<>|]+/g, '_').trim();
  return cleaned || fallback;
}

function pagesOf(doc: FlowDoc, options: VectorExportOptions): FlowPage[] {
  if (options.range === 'all') return doc.pages;
  const active = activePageOf(doc);
  return active ? [active] : [];
}

/** Export vector SVG: a single page downloads directly, multiple pages are packed into a ZIP */
export async function exportVectorSvg(
  doc: FlowDoc,
  filename: string,
  options: VectorExportOptions = {},
): Promise<{ ok: true } | { ok: false; error: string }> {
  const pages = pagesOf(doc, options).filter(
    (p) => filterPage(p, options.selection).nodes.length > 0,
  );
  if (pages.length === 0) return { ok: false, error: 'EMPTY' };

  if (pages.length === 1) {
    const svg = await pageToVectorSvg(pages[0], options);
    const url = URL.createObjectURL(new Blob([svg], { type: 'image/svg+xml;charset=utf-8' }));
    downloadDataUrl(url, `${filename}.svg`);
    URL.revokeObjectURL(url);
    return { ok: true };
  }

  const { default: JSZip } = await import('jszip');
  const zip = new JSZip();
  for (let i = 0; i < pages.length; i += 1) {
    const svg = await pageToVectorSvg(pages[i], options);
    zip.file(`${String(i + 1).padStart(2, '0')}-${safeName(pages[i].name, 'page')}.svg`, svg);
  }
  const blob = await zip.generateAsync({ type: 'blob' });
  const url = URL.createObjectURL(blob);
  downloadDataUrl(url, `${filename}.zip`);
  URL.revokeObjectURL(url);
  return { ok: true };
}
