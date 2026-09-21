/**
 * 导入导出统一入口：对外只暴露本模块，UI 与 store 不直接依赖具体格式实现。
 */

import { downloadDataUrl } from '@/core/pdf/download';
import {
  DEFAULT_RASTER_OPTIONS,
  exportRaster,
  type RasterExportOptions,
  type RasterFormat,
} from './raster';
import { PROJECT_FILE_EXT, parseProjectJson, toProjectJson } from './projectJson';
import { toMermaid } from './mermaidIo';
import { parseDrawioXml, toDrawioXml } from './drawio';

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

/** 把文本保存为文件 */
export function downloadText(text: string, filename: string, mime: string): void {
  const blob = new Blob([text], { type: `${mime};charset=utf-8` });
  const url = URL.createObjectURL(blob);
  downloadDataUrl(url, filename);
  URL.revokeObjectURL(url);
}

/** 文本文件类导出（项目 JSON / Draw.io XML / Mermaid） */
export function exportText(
  doc: Parameters<typeof toProjectJson>[0],
  kind: ExportKind,
  filename: string,
): boolean {
  let text = '';
  if (kind === 'project') text = toProjectJson(doc);
  else if (kind === 'drawio') text = toDrawioXml(doc);
  else if (kind === 'mermaid') text = toMermaid(doc);
  else return false;
  if (!text) return false;
  const meta = metaOf(kind);
  downloadText(text, `${filename}.${meta.ext}`, meta.mime);
  return true;
}

export {
  DEFAULT_RASTER_OPTIONS,
  exportRaster,
  toDrawioXml,
  toMermaid,
  toProjectJson,
  parseDrawioXml,
  parseProjectJson,
};
export type { RasterExportOptions, RasterFormat };
