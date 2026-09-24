import type { ToolResult } from '@/core/types';
import { assetToDataUrl, dataUrlToCanvas, getCanvas, registerCanvas } from './model/assets';
import { migrateDoc } from './model/migrate';
import { PROJECT_VERSION } from './core';
import type { PhotoDoc } from './model/types';

/**
 * 自有工程文件（`.photo.json`）：完整保存图层结构 + 像素（dataURL 内联），可再次导入继续编辑。
 * 与草稿不同，工程文件不做降级——它是用户显式导出的产物，必须能原样还原。
 */

export interface ProjectFile {
  format: 'syntools-photo';
  version: number;
  doc: unknown;
}

export function buildProjectJson(doc: PhotoDoc): string {
  const layers = doc.layers.map((layer) => {
    // 位图像素内联；蒙版像素单独内联（二者都在资产注册表里，不能只存 id）
    const maskUrl = layer.mask?.assetId ? assetToDataUrl(layer.mask.assetId, 'image/png') : null;
    const withMask = maskUrl ? { ...layer, maskData: maskUrl } : layer;
    if (layer.kind !== 'raster' && layer.kind !== 'smart') return withMask;
    const sourceId = layer.kind === 'raster' ? layer.assetId : layer.sourceAssetId;
    const url = getCanvas(sourceId) ? assetToDataUrl(sourceId, 'image/png') : null;
    return url ? { ...withMask, data: url } : withMask;
  });
  const payload: ProjectFile = {
    format: 'syntools-photo',
    version: PROJECT_VERSION,
    doc: { ...doc, layers },
  };
  return JSON.stringify(payload);
}

export function projectFilename(title: string): string {
  const safe = title
    .trim()
    .replace(/[\\/:*?"<>|\n\r\t]+/g, '-')
    .slice(0, 80);
  return `${safe || 'photo'}.photo.json`;
}

export async function parseProject(text: string): Promise<ToolResult<PhotoDoc>> {
  let parsed: ProjectFile;
  try {
    parsed = JSON.parse(text) as ProjectFile;
  } catch {
    return { ok: false, error: 'PARSE_FAILED' };
  }
  if (parsed?.format !== 'syntools-photo') return { ok: false, error: 'NOT_PROJECT' };
  if (typeof parsed.version !== 'number' || parsed.version > PROJECT_VERSION) {
    return { ok: false, error: 'UNSUPPORTED_VERSION' };
  }
  const raw = parsed.doc;
  if (!raw || typeof raw !== 'object' || !Array.isArray((raw as { layers?: unknown }).layers)) {
    return { ok: false, error: 'PARSE_FAILED' };
  }

  type RawLayer = Record<string, unknown> & { data?: string; maskData?: string };
  const layers: Record<string, unknown>[] = [];
  for (const layer of (raw as { layers: RawLayer[] }).layers) {
    const { data, maskData, ...rest } = layer;
    let next: Record<string, unknown> = rest;

    // 位图 / 智能对象源像素
    if (typeof data === 'string') {
      const canvas = await dataUrlToCanvas(data).catch(() => null);
      if (!canvas) return { ok: false, error: 'IMAGE_DECODE_FAILED' };
      next =
        rest.kind === 'smart'
          ? { ...next, sourceAssetId: registerCanvas(canvas) }
          : { ...next, assetId: registerCanvas(canvas) };
    }
    // 蒙版像素
    if (typeof maskData === 'string' && isObject(next.mask)) {
      const canvas = await dataUrlToCanvas(maskData).catch(() => null);
      // 蒙版解码失败不致命：退化为「无蒙版」，整档仍可打开
      if (canvas) {
        next = { ...next, mask: { ...(next.mask as object), assetId: registerCanvas(canvas) } };
      }
    }
    layers.push(next);
  }

  // v1 及更早的文档在此归一为当前模型（补编组 / 蒙版 / 调整图层字段、修引用完整性）
  const doc = migrateDoc({ ...(raw as object), layers });
  if (!doc) return { ok: false, error: 'PARSE_FAILED' };
  return { ok: true, value: doc };
}

function isObject(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

export async function readProjectFile(file: File): Promise<ToolResult<PhotoDoc>> {
  try {
    const text = await file.text();
    return await parseProject(text);
  } catch {
    return { ok: false, error: 'PARSE_FAILED' };
  }
}
