import type { ToolResult } from '@/core/types';
import { assetToDataUrl, dataUrlToCanvas, getCanvas, registerCanvas } from './model/assets';
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
    if (layer.kind !== 'raster') return layer;
    const url = getCanvas(layer.assetId) ? assetToDataUrl(layer.assetId, 'image/png') : null;
    return url ? { ...layer, data: url } : layer;
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
  const raw = parsed.doc as PhotoDoc & { layers?: (Record<string, unknown> & { data?: string })[] };
  if (!raw || !Array.isArray(raw.layers) || typeof raw.width !== 'number') {
    return { ok: false, error: 'PARSE_FAILED' };
  }

  const layers: Record<string, unknown>[] = [];
  for (const layer of raw.layers) {
    const { data, ...rest } = layer;
    if (rest.kind !== 'raster' || typeof data !== 'string') {
      layers.push(rest);
      continue;
    }
    const canvas = await dataUrlToCanvas(data).catch(() => null);
    if (!canvas) return { ok: false, error: 'IMAGE_DECODE_FAILED' };
    layers.push({ ...rest, assetId: registerCanvas(canvas) });
  }

  return {
    ok: true,
    value: {
      ...raw,
      layers,
      activeLayerId: raw.activeLayerId ?? null,
    } as unknown as PhotoDoc,
  };
}

export async function readProjectFile(file: File): Promise<ToolResult<PhotoDoc>> {
  try {
    const text = await file.text();
    return await parseProject(text);
  } catch {
    return { ok: false, error: 'PARSE_FAILED' };
  }
}
