/**
 * 图片压缩/格式转换（Tasks T42）：core 只含与浏览器 API 无关的纯函数
 * （canvas / toBlob 等编码流程在 UI 层），保证 jsdom 下可测。
 * 错误码与文案解耦：core 返回语言无关错误码，UI 层经 i18n 翻译（T29 约定）。
 */

export type ImageErrorCode = 'NOT_IMAGE' | 'ENCODE';

export interface ImageFormatEntry {
  /** MIME 类型，直接传给 canvas.toBlob */
  id: string;
  /** 输出文件扩展名 */
  ext: string;
  /** 固定展示名（技术名词，不翻译） */
  label: string;
  /** 是否支持有损质量参数 */
  lossy: boolean;
}

export const IMAGE_FORMATS: readonly ImageFormatEntry[] = [
  { id: 'image/png', ext: 'png', label: 'PNG', lossy: false },
  { id: 'image/jpeg', ext: 'jpg', label: 'JPEG', lossy: true },
  { id: 'image/webp', ext: 'webp', label: 'WebP', lossy: true },
];

/** 最长边限制选项（px）；0 表示保持原始尺寸 */
export const MAX_DIMENSIONS = [0, 2048, 1024, 512] as const;
export type MaxDimension = (typeof MAX_DIMENSIONS)[number];

export const MIN_QUALITY = 0.1;
export const MAX_QUALITY = 1;

export function formatById(id: string): ImageFormatEntry | null {
  return IMAGE_FORMATS.find((f) => f.id === id) ?? null;
}

/** 质量钳制到 [0.1, 1]，非法值回退 0.8 */
export function clampQuality(q: number): number {
  if (!Number.isFinite(q)) return 0.8;
  return Math.min(MAX_QUALITY, Math.max(MIN_QUALITY, q));
}

/** 是否为可接受的图片 MIME 类型 */
export function isImageFile(mimeType: string): boolean {
  return mimeType.toLowerCase().startsWith('image/');
}

/** 等比缩放目标尺寸：不超过 maxDim、不放大；maxDim=0 返回原尺寸 */
export function computeTargetSize(
  width: number,
  height: number,
  maxDim: MaxDimension,
): { width: number; height: number } {
  if (!maxDim || (width <= maxDim && height <= maxDim)) {
    return { width, height };
  }
  const scale = maxDim / Math.max(width, height);
  return {
    width: Math.max(1, Math.round(width * scale)),
    height: Math.max(1, Math.round(height * scale)),
  };
}

/** 输出文件名：去原扩展名 + 新格式扩展名；无名字时用 image 兜底 */
export function buildOutputFilename(originalName: string, formatId: string): string {
  const format = formatById(formatId);
  const ext = format?.ext ?? 'png';
  const base = originalName.replace(/\.[^.]+$/, '').trim() || 'image';
  return `${base}.${ext}`;
}

/** 体积变化率（%）：正数为节省；before ≤ 0 时返回 null */
export function compressionRatio(before: number, after: number): number | null {
  if (before <= 0) return null;
  return Math.round(((before - after) / before) * 100);
}

/** 字节数人类可读展示 */
export function formatBytes(bytes: number): string {
  if (bytes >= 1024 * 1024) return `${(bytes / (1024 * 1024)).toFixed(2)} MB`;
  if (bytes >= 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${bytes} B`;
}
