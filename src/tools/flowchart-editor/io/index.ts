/**
 * 导入导出统一入口：对外只暴露本模块，UI 与 store 不直接依赖具体格式实现。
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
import { parseDrawioXml, toDrawioXml } from './drawio';
import { DEFAULT_PRINT_OPTIONS, PAPER_OPTIONS, exportPrintPdf, printGrid } from './print';
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

/** 导入支持的文件类型 */
export type ImportKind = 'project' | 'drawio' | 'mermaid';

/** 导入文件选择框的 accept 值 */
export const IMPORT_ACCEPT = '.json,.drawio,.xml,.mmd,.mermaid,.txt';

/** 按文件名后缀判断导入类型；未知后缀按 Draw.io 处理（历史上 .xml 走这条路） */
export function importKindOf(filename: string): ImportKind {
  const lower = filename.toLowerCase();
  if (lower.endsWith('.json')) return 'project';
  if (lower.endsWith('.mmd') || lower.endsWith('.mermaid') || lower.endsWith('.txt')) {
    return 'mermaid';
  }
  return 'drawio';
}

/** 解析导入文件为文档；无法识别返回 null */
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
  parseProjectJson,
  parseMermaidFlowchart,
};
export { DEFAULT_PRINT_OPTIONS, PAPER_OPTIONS, exportPrintPdf, printGrid };
export type { MermaidParseResult } from './mermaidIo';
export type { CapturedPage, ExportRange, RasterExportOptions, RasterFormat } from './raster';
export type { PaperSize, PrintOptions } from './print';
