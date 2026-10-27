/**
 * Single entry point for import/export: only this module is exposed, so the UI and store never depend on a specific format implementation.
 */

import { downloadDataUrl } from '@/core/pdf/download';
import {
  DEFAULT_RASTER_OPTIONS,
  PADDING_MAX,
  PADDING_MIN,
  SCALE_OPTIONS,
  capturePage,
  exportRaster,
  exportRasterSet,
} from './raster';
import { PROJECT_FILE_EXT, parseProjectJson, toProjectJson } from './projectJson';
import { parseMermaidFlowchart, toMermaid } from './mermaidIo';
import { parseDrawioXml, parseDrawioXmlAsync, toDrawioXml } from './drawio';
import {
  DEFAULT_PRINT_OPTIONS,
  PAPER_OPTIONS,
  exportPrintPdf,
  exportPrintPdfSet,
  printGrid,
} from './print';
import type { FlowDoc } from '../model/types';

export type ExportKind = 'png' | 'jpeg' | 'svg' | 'pdf' | 'project' | 'drawio' | 'mermaid';

export interface ExportMeta {
  kind: ExportKind;
  ext: string;
  mime: string;
}

export const EXPORT_KINDS: ExportMeta[] = [
  { kind: 'png', ext: 'png', mime: 'image/png' },
  { kind: 'jpeg', ext: 'jpg', mime: 'image/jpeg' },
  { kind: 'svg', ext: 'svg', mime: 'image/svg+xml' },
  { kind: 'pdf', ext: 'pdf', mime: 'application/pdf' },
  { kind: 'project', ext: PROJECT_FILE_EXT, mime: 'application/json' },
  { kind: 'drawio', ext: 'drawio.xml', mime: 'application/xml' },
  { kind: 'mermaid', ext: 'mmd', mime: 'text/plain' },
];

export function metaOf(kind: ExportKind): ExportMeta {
  return EXPORT_KINDS.find((m) => m.kind === kind) ?? EXPORT_KINDS[0];
}

/** Save text as a file */
export function downloadText(text: string, filename: string, mime: string): void {
  const blob = new Blob([text], { type: `${mime};charset=utf-8` });
  const url = URL.createObjectURL(blob);
  downloadDataUrl(url, filename);
  URL.revokeObjectURL(url);
}

/** Text-based exports (project JSON / Draw.io XML / Mermaid) */
export function exportText(
  doc: Parameters<typeof toProjectJson>[0],
  kind: ExportKind,
  filename: string,
  options: { mermaidPages?: 'current' | 'all' } = {},
): boolean {
  let text = '';
  if (kind === 'project') text = toProjectJson(doc);
  else if (kind === 'drawio') text = toDrawioXml(doc);
  else if (kind === 'mermaid') text = toMermaid(doc, { pages: options.mermaidPages });
  else return false;
  if (!text) return false;
  const meta = metaOf(kind);
  downloadText(text, `${filename}.${meta.ext}`, meta.mime);
  return true;
}

/** File types supported for import */
export type ImportKind = 'project' | 'drawio' | 'mermaid';

/** Accept value for the import file picker */
export const IMPORT_ACCEPT = '.json,.drawio,.xml,.mmd,.mermaid,.txt';

/** Infer the import type from the file extension; unknown extensions are treated as Draw.io (historically .xml took this path) */
export function importKindOf(filename: string): ImportKind {
  const lower = filename.toLowerCase();
  if (lower.endsWith('.json')) return 'project';
  if (lower.endsWith('.mmd') || lower.endsWith('.mermaid') || lower.endsWith('.txt')) {
    return 'mermaid';
  }
  return 'drawio';
}

/** Parse an imported file into a document; returns null when unrecognized */
export function parseImportedFile(filename: string, text: string): FlowDoc | null {
  switch (importKindOf(filename)) {
    case 'project':
      return parseProjectJson(text);
    case 'mermaid': {
      const result = parseMermaidFlowchart(text);
      return result.ok ? result.doc : null;
    }
    case 'drawio':
    default:
      return parseDrawioXml(text);
  }
}

/**
 * Async import parsing: adds Draw.io compressed-file support on top of the synchronous version
 * (`<diagram>` text is base64+deflate and needs async inflation).
 */
export async function parseImportedFileAsync(
  filename: string,
  text: string,
): Promise<FlowDoc | null> {
  if (importKindOf(filename) !== 'drawio') return parseImportedFile(filename, text);
  return parseDrawioXmlAsync(text);
}

export {
  DEFAULT_RASTER_OPTIONS,
  exportRaster,
  exportRasterSet,
  capturePage,
  SCALE_OPTIONS,
  PADDING_MIN,
  PADDING_MAX,
  toDrawioXml,
  toMermaid,
  toProjectJson,
  parseDrawioXml,
  parseDrawioXmlAsync,
  parseProjectJson,
  parseMermaidFlowchart,
};
export type { MermaidExportOptions } from './mermaidIo';
export { exportVectorSvg, pageToVectorSvg, pageHasFormula, vectorSvgToPngDataUrl } from './vector';
export type { VectorExportOptions } from './vector';
export { DEFAULT_PRINT_OPTIONS, PAPER_OPTIONS, exportPrintPdf, exportPrintPdfSet, printGrid };
export type { MermaidParseResult } from './mermaidIo';
export type { CapturedPage, ExportRange, RasterExportOptions, RasterFormat } from './raster';
export type { PaperSize, PrintOptions } from './print';
