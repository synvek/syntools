import type { ToolResult } from '@/core/types';
import type { MediaAsset } from './types';
import { createId } from './factory';

/**
 * 媒体资源运行时管理：
 * - Asset 本体只存字节与元信息（可序列化到草稿）；
 * - objectURL 由本模块按需创建并缓存，撤销/重做不会重复申请。
 */

const urlCache = new Map<string, string>();

/** 受支持的图片类型（SVG 走 elm.type 'image/svg+xml' 亦允许） */
const ALLOWED_IMAGE_TYPES = [
  'image/png',
  'image/jpeg',
  'image/gif',
  'image/webp',
  'image/bmp',
  'image/svg+xml',
];

/** pptx media 扩展名 → MIME */
const MIME_BY_EXT: Record<string, string> = {
  png: 'image/png',
  jpg: 'image/jpeg',
  jpeg: 'image/jpeg',
  gif: 'image/gif',
  bmp: 'image/bmp',
  tif: 'image/tiff',
  tiff: 'image/tiff',
  wmf: 'image/x-wmf',
  emf: 'image/x-emf',
  webp: 'image/webp',
  svg: 'image/svg+xml',
};

/** MIME → pptx 内使用的扩展名（Content_Types 依赖正确的扩展名） */
export const EXT_BY_MIME: Record<string, string> = {
  'image/png': 'png',
  'image/jpeg': 'jpeg',
  'image/gif': 'gif',
  'image/bmp': 'bmp',
  'image/tiff': 'tiff',
  'image/webp': 'png',
  'image/svg+xml': 'png',
};

export function mimeFromFilename(filename: string): string | undefined {
  const ext = filename.split('.').pop()?.toLowerCase() ?? '';
  return MIME_BY_EXT[ext];
}

/** 依据字节前缀判定图片真实类型（防止扩展名撒谎） */
export function detectImageMime(bytes: Uint8Array): string | undefined {
  const startsWith = (...sig: number[]) => sig.every((b, i) => bytes[i] === b);
  if (startsWith(0x89, 0x50, 0x4e, 0x47)) return 'image/png';
  if (startsWith(0xff, 0xd8, 0xff)) return 'image/jpeg';
  if (startsWith(0x47, 0x49, 0x46, 0x38)) return 'image/gif';
  if (startsWith(0x42, 0x4d)) return 'image/bmp';
  if (startsWith(0x52, 0x49, 0x46, 0x46) && bytes[8] === 0x57 && bytes[9] === 0x45) {
    return 'image/webp';
  }
  if (startsWith(0x3c, 0x73, 0x76, 0x67) || startsWith(0x3c, 0x3f, 0x78, 0x6d)) {
    return 'image/svg+xml';
  }
  return undefined;
}

export function extensionForMime(mime: string): string {
  return EXT_BY_MIME[mime] ?? 'png';
}

/** 读取图片文件 → MediaAsset（含真实宽高） */
export async function createMediaFromFile(file: File): Promise<ToolResult<MediaAsset>> {
  if (!ALLOWED_IMAGE_TYPES.includes(file.type)) return { ok: false, error: 'UNSUPPORTED_MEDIA' };
  const buffer = await file.arrayBuffer();
  const bytes = new Uint8Array(buffer);
  const mime = detectImageMime(bytes) ?? file.type;
  const asset: MediaAsset = {
    id: createId('media'),
    mime,
    bytes,
    width: 0,
    height: 0,
  };
  const size = await measureImageSize(asset);
  if (!size) return { ok: false, error: 'IMAGE_DECODE_FAILED' };
  asset.width = size.width;
  asset.height = size.height;
  return { ok: true, value: asset };
}

/** 从已解出的 pptx media 字节创建 Asset */
export async function createMediaFromBytes(
  bytes: Uint8Array,
  mime: string,
): Promise<ToolResult<MediaAsset>> {
  const asset: MediaAsset = { id: createId('media'), mime, bytes, width: 0, height: 0 };
  const size = await measureImageSize(asset);
  if (!size) return { ok: false, error: 'IMAGE_DECODE_FAILED' };
  asset.width = size.width;
  asset.height = size.height;
  return { ok: true, value: asset };
}

/** 读取图片原始宽高；失败返回 null（如 WMF/EMF 浏览器无法解码） */
export async function measureImageSize(
  asset: MediaAsset,
): Promise<{ width: number; height: number } | null> {
  if (typeof Image === 'undefined') return null;
  const url = getMediaUrl(asset);
  if (!url) return null;
  return await new Promise((resolve) => {
    const image = new Image();
    image.onload = () => resolve({ width: image.naturalWidth, height: image.naturalHeight });
    image.onerror = () => resolve(null);
    image.src = url;
  });
}

/** 取得（并缓存）媒体的 objectURL */
export function getMediaUrl(asset: MediaAsset): string | undefined {
  if (!asset.bytes) return asset.url;
  const cached = urlCache.get(asset.id);
  if (cached) return cached;
  const blob = new Blob([asset.bytes], { type: asset.mime });
  const url = URL.createObjectURL(blob);
  urlCache.set(asset.id, url);
  return url;
}

/** 释放全部已创建的 objectURL（工具卸载时调用） */
export function revokeAllMediaUrls(): void {
  for (const url of urlCache.values()) URL.revokeObjectURL(url);
  urlCache.clear();
}
