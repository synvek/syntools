import JSZip from 'jszip';
import type { ToolResult } from '@/core/types';
import { extensionForMime } from '../model/media';
import type { MediaAsset, SlideDoc } from '../model/types';

/**
 * 工程文件（.sld）：JSON + 原始图片字节打包成 zip。
 *
 * 为什么需要它：此前唯一可靠的持久化只有「导出 pptx」与 localStorage 草稿，
 * 而草稿超过 3MB 会**丢弃图片字节**，恢复后图片变空白。
 * 工程文件把图片原样带上，且不经过 OOXML 的保真损耗，是真正无损的中间态。
 */

export const PROJECT_VERSION = 1;
export const PROJECT_FORMAT = 'syntools-slide';
export const PROJECT_EXTENSION = 'sld';
const PROJECT_ENTRY = 'project.json';

export type ProjectErrorCode = 'EMPTY' | 'NOT_PROJECT' | 'PROJECT_VERSION' | 'IMPORT_FAILED';

interface ProjectPayload {
  format: string;
  version: number;
  doc: SlideDoc;
  /** mediaId → zip 内路径（没有字节的媒体不出现） */
  mediaFiles: Record<string, string>;
}

/** 剥离运行态与大字段：bytes 单独存二进制条目，url 不入库 */
function stripDoc(doc: SlideDoc): {
  clean: SlideDoc;
  files: Record<string, string>;
  entries: { name: string; bytes: Uint8Array }[];
} {
  const files: Record<string, string> = {};
  const entries: { name: string; bytes: Uint8Array }[] = [];
  const media: Record<string, MediaAsset> = {};
  for (const [id, asset] of Object.entries(doc.media)) {
    media[id] = { id: asset.id, mime: asset.mime, width: asset.width, height: asset.height };
    if (!asset.bytes) continue;
    const name = `${id}.${extensionForMime(asset.mime)}`;
    files[id] = name;
    entries.push({ name, bytes: asset.bytes });
  }
  return { clean: { ...doc, media }, files, entries };
}

export async function saveProject(doc: SlideDoc): Promise<ToolResult<Uint8Array>> {
  try {
    const { clean, files, entries } = stripDoc(doc);
    const zip = new JSZip();
    const payload: ProjectPayload = {
      format: PROJECT_FORMAT,
      version: PROJECT_VERSION,
      doc: clean,
      mediaFiles: files,
    };
    zip.file(PROJECT_ENTRY, JSON.stringify(payload));
    for (const entry of entries) zip.file(`media/${entry.name}`, entry.bytes);
    const buffer = await zip.generateAsync({ type: 'uint8array', compression: 'DEFLATE' });
    return { ok: true, value: new Uint8Array(buffer) };
  } catch {
    return { ok: false, error: 'IMPORT_FAILED' };
  }
}

export async function openProject(file: File): Promise<ToolResult<SlideDoc>> {
  try {
    const zip = await JSZip.loadAsync(await file.arrayBuffer());
    const entry = zip.file(PROJECT_ENTRY);
    if (!entry) return { ok: false, error: 'NOT_PROJECT' };
    const payload = JSON.parse(await entry.async('string')) as ProjectPayload;
    if (payload.format !== PROJECT_FORMAT) return { ok: false, error: 'NOT_PROJECT' };
    if (payload.version > PROJECT_VERSION) return { ok: false, error: 'PROJECT_VERSION' };

    const media: Record<string, MediaAsset> = {};
    for (const [id, asset] of Object.entries(payload.doc.media ?? {})) {
      const name = payload.mediaFiles?.[id];
      const bytes = name ? await zip.file(`media/${name}`)?.async('uint8array') : undefined;
      media[id] = { ...asset, bytes: bytes ?? undefined };
    }
    const doc: SlideDoc = { ...payload.doc, media };
    if (!doc.slides || doc.slides.length === 0) return { ok: false, error: 'EMPTY' };
    return { ok: true, value: doc };
  } catch {
    return { ok: false, error: 'IMPORT_FAILED' };
  }
}
