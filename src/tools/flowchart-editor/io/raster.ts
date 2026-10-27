/**
 * Bitmap / vector / PDF export.
 * All paths go through DOM capture (html-to-image), which is more faithful than hand-drawing:
 * React Flow's output is just DOM + SVG, so a screenshot reproduces the styles as they are.
 *
 * Export range (`range`):
 * - `selection` exports only the selected nodes;
 * - `current`   exports every node on the current page;
 * - `all`       exports page by page (the UI switches pages and calls `capturePage`), packing multi-page results into a ZIP or a merged PDF.
 */

import { getNodesBounds, getViewportForBounds, type Node } from '@xyflow/react';
import { toJpeg, toPng, toSvg } from 'html-to-image';
import { jsPDF } from 'jspdf';
import { downloadDataUrl } from '@/core/pdf/download';
import { absolutePositionOf } from '../core';
import type { FlowNodeData } from '../model/types';

export type RasterFormat = 'png' | 'jpeg' | 'svg' | 'pdf';

/** Export range */
export type ExportRange = 'selection' | 'current' | 'all';

export interface RasterExportOptions {
  format: RasterFormat;
  /** Export scale factor: larger is sharper (and uses more memory) */
  scale: number;
  /** Transparent background (jpeg does not support transparency) */
  transparent: boolean;
  /** Padding around the content */
  padding: number;
  /** Export range */
  range: ExportRange;
}

export const DEFAULT_RASTER_OPTIONS: RasterExportOptions = {
  format: 'png',
  scale: 2,
  transparent: false,
  padding: 24,
  range: 'current',
};

/** Selectable scale factors (including the common 1x/2x/3x presets) */
export const SCALE_OPTIONS = [0.5, 1, 1.5, 2, 3, 4];
/** Adjustable margin range */
export const PADDING_MIN = 0;
export const PADDING_MAX = 200;

const EXT: Record<RasterFormat, string> = { png: 'png', jpeg: 'jpg', svg: 'svg', pdf: 'pdf' };

/** Compute the export area: child coordinates are converted to absolute first so elements inside swimlanes are not cropped */
export function exportBoundsOf(
  nodes: ReadonlyArray<Node<FlowNodeData>>,
  padding: number,
): { x: number; y: number; width: number; height: number } {
  const byId = new Map(nodes.map((n) => [n.id, n] as const));
  const absolute = nodes.map((n) => ({ ...n, position: absolutePositionOf(n, byId) }));
  const b = getNodesBounds(absolute);
  return {
    x: b.x,
    y: b.y,
    width: Math.max(1, Math.ceil(b.width)),
    height: Math.max(1, Math.ceil(b.height)),
    ...(padding ? {} : {}),
  };
}

/** Build the capture options (reused by toPng / toJpeg / toSvg) */
function captureOptions(
  bounds: { x: number; y: number; width: number; height: number },
  opts: RasterExportOptions,
) {
  const pad = opts.padding;
  const width = bounds.width + pad * 2;
  const height = bounds.height + pad * 2;
  const transform = getViewportForBounds(bounds, width, height, 0.5, 2, pad);
  return {
    width,
    height,
    pixelRatio: opts.scale,
    backgroundColor: opts.transparent ? undefined : '#ffffff',
    style: {
      width: `${width}px`,
      height: `${height}px`,
      transform: `translate(${transform.x}px, ${transform.y}px) scale(${transform.zoom})`,
    },
  };
}

function viewportEl(): HTMLElement | null {
  return document.querySelector('.react-flow__viewport') as HTMLElement | null;
}

/**
 * Capture the current canvas as a dataURL (without writing to disk).
 * Present mode reuses the same DOM capture pipeline so it matches the export result.
 */
export async function captureViewportDataUrl(
  nodes: Node<FlowNodeData>[],
  options: RasterExportOptions = DEFAULT_RASTER_OPTIONS,
): Promise<string | null> {
  const captured = await capturePage('', nodes, { ...options, format: 'png' });
  return captured?.dataUrl ?? null;
}

/** One captured page (the dataUrl format follows options.format; PDF uses png internally) */
export interface CapturedPage {
  name: string;
  dataUrl: string;
  width: number;
  height: number;
}

/**
 * Capture the page currently rendered on the canvas.
 * For multi-page export the caller switches pages and calls this; null means the canvas is missing or the page is not exportable.
 */
export async function capturePage(
  name: string,
  nodes: Node<FlowNodeData>[],
  options: RasterExportOptions,
): Promise<CapturedPage | null> {
  try {
    if (nodes.length === 0) return null;
    const viewport = viewportEl();
    if (!viewport) return null;
    const capture = captureOptions(exportBoundsOf(nodes, options.padding), options);
    let dataUrl: string;
    if (options.format === 'svg') dataUrl = await toSvg(viewport, capture);
    else if (options.format === 'jpeg') dataUrl = await toJpeg(viewport, capture);
    else dataUrl = await toPng(viewport, capture);
    return { name, dataUrl, width: capture.width, height: capture.height };
  } catch {
    return null;
  }
}

/** dataURL → binary (for ZIP packing) */
function dataUrlToUint8(dataUrl: string): Uint8Array {
  const comma = dataUrl.indexOf(',');
  const payload = comma >= 0 ? dataUrl.slice(comma + 1) : dataUrl;
  const binary = atob(payload);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i += 1) bytes[i] = binary.charCodeAt(i);
  return bytes;
}

/** Make a file name safe (page names may contain spaces or slashes) */
function safeName(name: string, fallback: string): string {
  const cleaned = name.replace(/[\\/:*?"<>|]+/g, '_').trim();
  return cleaned || fallback;
}

/**
 * Single-page export (PNG / JPEG / SVG / PDF).
 * `nodes` is the set to export (pass the selection to export only that).
 */
export async function exportRaster(
  nodes: Node<FlowNodeData>[],
  options: RasterExportOptions,
  filename: string,
): Promise<{ ok: true } | { ok: false; error: string }> {
  if (nodes.length === 0) return { ok: false, error: 'EMPTY' };
  const page = await capturePage(filename, nodes, options);
  if (!page) return { ok: false, error: nodes.length === 0 ? 'EMPTY' : 'EXPORT_FAILED' };

  if (options.format === 'pdf') {
    const pdf = new jsPDF({
      orientation: page.width >= page.height ? 'landscape' : 'portrait',
      unit: 'px',
      format: [page.width, page.height],
    });
    pdf.addImage(page.dataUrl, 'PNG', 0, 0, page.width, page.height);
    pdf.save(`${filename}.pdf`);
    return { ok: true };
  }

  downloadDataUrl(page.dataUrl, `${filename}.${EXT[options.format]}`);
  return { ok: true };
}

/**
 * Multi-page export: pack into a ZIP (png/jpeg/svg) or merge into a multi-page PDF.
 * The caller must ensure each `dataUrl` was captured while its page was active.
 */
export async function exportRasterSet(
  pages: CapturedPage[],
  options: RasterExportOptions,
  filename: string,
): Promise<{ ok: true } | { ok: false; error: string }> {
  if (pages.length === 0) return { ok: false, error: 'EMPTY' };

  if (options.format === 'pdf') {
    const first = pages[0];
    const pdf = new jsPDF({
      orientation: first.width >= first.height ? 'landscape' : 'portrait',
      unit: 'px',
      format: [first.width, first.height],
    });
    pages.forEach((page, index) => {
      if (index > 0) pdf.addPage([page.width, page.height]);
      pdf.addImage(page.dataUrl, 'PNG', 0, 0, page.width, page.height);
    });
    pdf.save(`${filename}.pdf`);
    return { ok: true };
  }

  const { default: JSZip } = await import('jszip');
  const zip = new JSZip();
  const ext = EXT[options.format];
  pages.forEach((page, index) => {
    zip.file(
      `${String(index + 1).padStart(2, '0')}-${safeName(page.name, 'page')}.${ext}`,
      dataUrlToUint8(page.dataUrl),
    );
  });
  const blob = await zip.generateAsync({ type: 'blob' });
  const url = URL.createObjectURL(blob);
  downloadDataUrl(url, `${filename}.zip`);
  URL.revokeObjectURL(url);
  return { ok: true };
}
