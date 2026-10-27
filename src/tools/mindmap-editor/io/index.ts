/**
 * Single entry point for import and export: only this module is public, so the UI and store never
 * depend on a specific format implementation.
 */

import { downloadDataUrl } from '@/core/pdf/download';
import {
  DEFAULT_RASTER_OPTIONS,
  exportRaster,
  type RasterExportOptions,
  type RasterFormat,
} from './raster';
import {
  activeSheetOf,
  parseProjectJson,
  parseProjectJsonV2,
  serializeDoc,
  serializeProject,
  singleSheetProject,
  toProjectJson,
  toProjectJsonV2,
} from './projectJson';
import { fromMarkdown, toMarkdown } from './markdown';
import type { MindProject } from '../model/types';

export type ExportKind = 'png' | 'jpeg' | 'svg' | 'pdf' | 'project' | 'markdown';

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
  { kind: 'project', ext: 'json', mime: 'application/json' },
  { kind: 'markdown', ext: 'md', mime: 'text/markdown' },
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

/** Text-based exports (project JSON / Markdown outline) */
export function exportText(project: MindProject, kind: ExportKind, filename: string): boolean {
  let text = '';
  if (kind === 'project') text = toProjectJsonV2(project);
  else if (kind === 'markdown') text = toMarkdown(activeSheetOf(project).doc);
  else return false;
  if (!text) return false;
  const meta = metaOf(kind);
  downloadText(text, `${filename}.${meta.ext}`, meta.mime);
  return true;
}

/** Detect the format from the content and parse it: JSON → project file, otherwise a Markdown outline */
export function parseImportedFile(name: string, text: string): MindProject | null {
  const lower = name.toLowerCase();
  if (lower.endsWith('.md') || lower.endsWith('.markdown') || lower.endsWith('.txt')) {
    const doc = fromMarkdown(text);
    return doc ? singleSheetProject(doc) : null;
  }
  return (
    parseProjectJsonV2(text) ??
    (() => {
      const doc = fromMarkdown(text);
      return doc ? singleSheetProject(doc) : null;
    })()
  );
}

export {
  DEFAULT_RASTER_OPTIONS,
  exportRaster,
  fromMarkdown,
  parseProjectJson,
  parseProjectJsonV2,
  serializeDoc,
  serializeProject,
  singleSheetProject,
  toMarkdown,
  toProjectJson,
  toProjectJsonV2,
};
export type { RasterExportOptions, RasterFormat };
