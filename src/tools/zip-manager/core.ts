import JSZip from 'jszip';
import type { ToolResult } from '@/core/types';

export interface ZipEntryInfo {
  name: string;
  size: number;
  dir: boolean;
}

/** 从多个文件创建 zip（返回 zip 字节）。 */
export async function createZip(
  files: { name: string; data: Uint8Array }[],
): Promise<ToolResult<Uint8Array>> {
  if (files.length === 0) return { ok: false, error: 'NO_FILES' };
  try {
    const zip = new JSZip();
    // 复制到当前 realm 的 Uint8Array，避免跨 realm 的 instanceof 判定失败
    for (const file of files) zip.file(file.name, new Uint8Array(file.data));
    const data = await zip.generateAsync({ type: 'uint8array', compression: 'DEFLATE' });
    return { ok: true, value: data };
  } catch {
    return { ok: false, error: 'CREATE_FAILED' };
  }
}

/** 列出 zip 内条目。 */
export async function listZip(data: Uint8Array): Promise<ToolResult<ZipEntryInfo[]>> {
  try {
    const zip = await JSZip.loadAsync(data);
    const entries: ZipEntryInfo[] = [];
    zip.forEach((path, file) => {
      const internal = file as unknown as { _data?: { uncompressedSize?: number } };
      entries.push({
        name: path,
        size: internal._data?.uncompressedSize ?? 0,
        dir: file.dir,
      });
    });
    entries.sort((a, b) => a.name.localeCompare(b.name));
    return { ok: true, value: entries };
  } catch {
    return { ok: false, error: 'INVALID_ZIP' };
  }
}

/** 读取 zip 内单个条目的内容。 */
export async function extractZipEntry(
  data: Uint8Array,
  name: string,
): Promise<ToolResult<Uint8Array>> {
  try {
    const zip = await JSZip.loadAsync(data);
    const file = zip.file(name);
    if (!file) return { ok: false, error: 'NOT_FOUND' };
    const bytes = await file.async('uint8array');
    return { ok: true, value: bytes };
  } catch {
    return { ok: false, error: 'INVALID_ZIP' };
  }
}
