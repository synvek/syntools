/**
 * "Export as images" (M4-4).
 *
 * The document is flattened first so annotations, covers and inserted images are part of the output —
 * rendering the original file would silently drop every edit. Pages are rendered at 96/150/300 DPI and
 * either downloaded directly (one page) or packed into a ZIP (several pages).
 */

import { createFidelityReport, type FidelityReport } from '@/core/fidelity';
import { downloadDataUrl } from '@/core/pdf/download';
import { openPdfjsDoc, renderPageDataUrl } from '@/core/pdf/render';
import type { ToolResult } from '@/core/types';
import type { PdfEditorDoc } from '../model/types';
import { flattenPdf } from './savePdf';

export type ImageFormat = 'png' | 'jpeg';
export const IMAGE_DPI_OPTIONS = [96, 150, 300] as const;
export type ImageDpi = (typeof IMAGE_DPI_OPTIONS)[number];

export interface ImageExportOptions {
  format: ImageFormat;
  dpi: ImageDpi;
}

/** pdfjs renders at 72 DPI by definition, so the scale is simply `dpi / 72` */
export function pdfPixelScale(dpi: number): number {
  return dpi / 72;
}

/** `report.pdf` → `report` */
export function exportBaseName(docName: string): string {
  return docName.replace(/\.pdf$/i, '').trim() || 'document';
}

/**
 * `report.pdf`, page 3 of 12, PNG → `report-p03.png`.
 * A single-page export drops the suffix: `report.png`.
 */
export function imageFileName(
  docName: string,
  pageNumber: number,
  format: ImageFormat,
  pageCount: number,
): string {
  const base = exportBaseName(docName);
  const extension = format === 'jpeg' ? 'jpg' : 'png';
  if (pageCount <= 1) return `${base}.${extension}`;
  return `${base}-p${String(pageNumber).padStart(2, '0')}.${extension}`;
}

export function imageZipName(docName: string): string {
  return `${exportBaseName(docName)}-images.zip`;
}

async function downloadImageZip(
  entries: Array<{ name: string; dataUrl: string }>,
  zipName: string,
): Promise<void> {
  const JSZip = (await import('jszip')).default;
  const zip = new JSZip();
  for (const entry of entries) {
    // Data URLs are base64; feeding the payload directly avoids a second encode
    zip.file(entry.name, entry.dataUrl.split(',')[1] ?? '', { base64: true });
  }
  const blob = await zip.generateAsync({ type: 'blob' });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement('a');
  anchor.href = url;
  anchor.download = zipName;
  anchor.click();
  URL.revokeObjectURL(url);
}

/**
 * Render the given pages (1-based, document order) and download them.
 *
 * Returns a fidelity report because a raster export is always a loss: text is no longer selectable.
 */
export async function exportPdfImages(
  doc: PdfEditorDoc,
  pageNumbers: readonly number[],
  options: ImageExportOptions,
): Promise<ToolResult<{ count: number; report: FidelityReport }>> {
  if (pageNumbers.length === 0) return { ok: false, error: 'NO_PAGES' };

  const flattened = await flattenPdf(doc);
  if (!flattened.ok) return flattened;

  const opened = await openPdfjsDoc(flattened.value.bytes);
  if (!opened.ok) return opened;

  const scale = pdfPixelScale(options.dpi);
  const format = options.format === 'jpeg' ? 'image/jpeg' : 'image/png';
  const entries: Array<{ name: string; dataUrl: string }> = [];

  for (const pageNumber of pageNumbers) {
    const rendered = await renderPageDataUrl(opened.value, pageNumber, scale, format, 0.9);
    if (!rendered.ok) return rendered;
    entries.push({
      name: imageFileName(doc.name, pageNumber, options.format, pageNumbers.length),
      dataUrl: rendered.value,
    });
  }

  if (entries.length === 1) {
    downloadDataUrl(entries[0].dataUrl, entries[0].name);
  } else {
    await downloadImageZip(entries, imageZipName(doc.name));
  }

  const report = createFidelityReport('pdf', 'export', [
    {
      code: 'pdf.rasterized',
      severity: 'warning',
      count: entries.length,
      messageKey: 'tools.pdfEditor.fidelityRasterized',
      detail: `${options.dpi} DPI`,
    },
  ]);

  return { ok: true, value: { count: entries.length, report } };
}
