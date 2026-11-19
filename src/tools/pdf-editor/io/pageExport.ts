/**
 * "Export as ZIP": one PDF per page, packed in page order (M2-7).
 *
 * The whole document is flattened once (annotations baked in), then pages are copied out of that
 * result — re-flattening per page would repaint every annotation N times and blow up the save time.
 */

import { PDFDocument } from '@cantoo/pdf-lib';
import { downloadPdfZip } from '@/core/pdf/download';
import type { ToolResult } from '@/core/types';
import type { PdfEditorDoc } from '../model/types';
import { flattenPdf } from './savePdf';

/** `report.pdf` + page 3 → `report-p03.pdf` */
export function pageEntryName(docName: string, page: number): string {
  const base = docName.replace(/\.pdf$/i, '') || 'document';
  return `${base}-p${String(page).padStart(2, '0')}.pdf`;
}

export function zipName(docName: string): string {
  const base = docName.replace(/\.pdf$/i, '') || 'document';
  return `${base}-pages.zip`;
}

/** Build the ZIP entries (pure enough to assert in tests); 1-based page numbers, in order */
export async function buildPageEntries(
  doc: PdfEditorDoc,
  pageNumbers: readonly number[],
): Promise<ToolResult<Array<{ name: string; bytes: Uint8Array }>>> {
  const flattened = await flattenPdf(doc);
  if (!flattened.ok) return flattened;

  const source = await PDFDocument.load(flattened.value.bytes, { updateMetadata: false });
  const total = source.getPageCount();
  const entries: Array<{ name: string; bytes: Uint8Array }> = [];

  for (const page of pageNumbers) {
    const index = Math.round(page) - 1;
    if (index < 0 || index >= total) continue;
    const output = await PDFDocument.create();
    const [copied] = await output.copyPages(source, [index]);
    output.addPage(copied);
    entries.push({ name: pageEntryName(doc.name, page), bytes: await output.save() });
  }

  return { ok: true, value: entries };
}

/** Download one PDF per page; returns false when there is nothing to export */
export async function downloadPageZip(
  doc: PdfEditorDoc,
  pageNumbers: readonly number[],
): Promise<boolean> {
  const built = await buildPageEntries(doc, pageNumbers);
  if (!built.ok || built.value.length === 0) return false;
  await downloadPdfZip(built.value, zipName(doc.name));
  return true;
}
