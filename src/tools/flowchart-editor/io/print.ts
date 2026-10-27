/**
 * Paged print export: slice the whole diagram by paper size and emit a multi-page PDF.
 *
 * How it works: first capture the full diagram as a bitmap through the same DOM pipeline as export,
 * then tile it page by page according to the "paper content area"—each page positions the bitmap at a negative offset,
 * and the PDF page's own clipping produces the pagination (no second image crop needed).
 */

import { jsPDF } from 'jspdf';
import type { Node } from '@xyflow/react';
import { capturePage, type CapturedPage } from './raster';
import type { FlowNodeData } from '../model/types';

export type PaperSize = 'a4' | 'a3';

export interface PrintOptions {
  paper: PaperSize;
  /** Landscape printing */
  landscape: boolean;
  /** Capture scale (determines print sharpness) */
  scale: number;
  /** Page margin (px @96dpi) */
  margin: number;
}

export const DEFAULT_PRINT_OPTIONS: PrintOptions = {
  paper: 'a4',
  landscape: false,
  scale: 2,
  margin: 24,
};

/** Paper size in pixels (96dpi) */
const PAPER_PX: Record<PaperSize, { width: number; height: number }> = {
  a4: { width: 794, height: 1123 },
  a3: { width: 1123, height: 1587 },
};

export const PAPER_OPTIONS: PaperSize[] = ['a4', 'a3'];

/** Compute the pagination grid (the exported page numbers and count can be shown to the user from it) */
export function printGrid(
  content: { width: number; height: number },
  options: PrintOptions,
): { cols: number; rows: number; pageWidth: number; pageHeight: number } {
  const paper = PAPER_PX[options.paper];
  const pageWidth = options.landscape ? paper.height : paper.width;
  const pageHeight = options.landscape ? paper.width : paper.height;
  const innerW = Math.max(1, pageWidth - options.margin * 2);
  const innerH = Math.max(1, pageHeight - options.margin * 2);
  return {
    cols: Math.max(1, Math.ceil(content.width / innerW)),
    rows: Math.max(1, Math.ceil(content.height / innerH)),
    pageWidth,
    pageHeight,
  };
}

/** Paper size and content area (one print job shares the same paper, keeping all pages the same size) */
function paperLayout(options: PrintOptions) {
  const { pageWidth, pageHeight } = printGrid({ width: 1, height: 1 }, options);
  return {
    pageWidth,
    pageHeight,
    innerW: pageWidth - options.margin * 2,
    innerH: pageHeight - options.margin * 2,
    orientation: (options.landscape ? 'landscape' : 'portrait') as 'landscape' | 'portrait',
  };
}

/**
 * Append one full-diagram bitmap to the PDF sliced by paper, returning the total page count after appending.
 * The negative offset places the current slice inside the paper content area; the page itself clips the overflow.
 */
function appendSlices(
  pdf: jsPDF,
  shot: { dataUrl: string; width: number; height: number },
  options: PrintOptions,
  layout: ReturnType<typeof paperLayout>,
  startIndex: number,
): number {
  const { cols, rows } = printGrid({ width: shot.width, height: shot.height }, options);
  let pageIndex = startIndex;
  for (let row = 0; row < rows; row += 1) {
    for (let col = 0; col < cols; col += 1) {
      if (pageIndex > 0) pdf.addPage([layout.pageWidth, layout.pageHeight], layout.orientation);
      pdf.addImage(
        shot.dataUrl,
        'PNG',
        options.margin - col * layout.innerW,
        options.margin - row * layout.innerH,
        shot.width,
        shot.height,
      );
      pageIndex += 1;
    }
  }
  return pageIndex;
}

/** Capture the full-diagram bitmap for printing (same pipeline as export, for identical fidelity) */
function captureForPrint(nodes: Node<FlowNodeData>[], options: PrintOptions, name: string) {
  return capturePage(name, nodes, {
    format: 'png',
    scale: options.scale,
    transparent: false,
    padding: 8,
    range: 'current',
  });
}

/**
 * Export a component as a paged PDF.
 * `nodes` must be the node set of the page currently rendered on the canvas.
 */
export async function exportPrintPdf(
  nodes: Node<FlowNodeData>[],
  options: PrintOptions,
  filename: string,
): Promise<{ ok: true; pages: number } | { ok: false; error: string }> {
  const shot = await captureForPrint(nodes, options, filename);
  if (!shot) return { ok: false, error: nodes.length === 0 ? 'EMPTY' : 'EXPORT_FAILED' };

  const layout = paperLayout(options);
  const pdf = new jsPDF({
    unit: 'px',
    format: [layout.pageWidth, layout.pageHeight],
    orientation: layout.orientation,
  });
  const pages = appendSlices(pdf, shot, options, layout, 0);
  pdf.save(`${filename}.pdf`);
  return { ok: true, pages };
}

/**
 * Multi-page printing: slice each page's full-diagram bitmap in turn and merge them into one PDF.
 * The caller must ensure each `dataUrl` was captured while its page was active (as with multi-page bitmap export).
 */
export async function exportPrintPdfSet(
  captures: CapturedPage[],
  options: PrintOptions,
  filename: string,
): Promise<{ ok: true; pages: number } | { ok: false; error: string }> {
  if (captures.length === 0) return { ok: false, error: 'EMPTY' };
  const layout = paperLayout(options);
  const pdf = new jsPDF({
    unit: 'px',
    format: [layout.pageWidth, layout.pageHeight],
    orientation: layout.orientation,
  });
  let pageIndex = 0;
  for (const shot of captures) pageIndex = appendSlices(pdf, shot, options, layout, pageIndex);
  pdf.save(`${filename}.pdf`);
  return { ok: true, pages: pageIndex };
}
