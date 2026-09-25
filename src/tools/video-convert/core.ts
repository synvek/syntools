import type { ConvertMediaOptions, MediaQuality, MediaTarget } from '@/core/media/convert';
import type { ToolResult } from '@/core/types';

export const VIDEO_TARGETS: MediaTarget[] = ['mp4', 'webm', 'mkv'];
export const QUALITY_LEVELS: MediaQuality[] = ['low', 'medium', 'high'];

export interface VideoConvertForm {
  target: MediaTarget;
  quality: MediaQuality;
  /** 目标宽度（px）；留空表示保持原尺寸 */
  width: number | null;
  /** 秒；留空表示从头 */
  trimStart: number | null;
  /** 秒；留空表示到结尾 */
  trimEnd: number | null;
}

/** 把表单状态整理为转换参数（纯函数，便于单测）。 */
export function buildConvertOptions(form: VideoConvertForm): ToolResult<ConvertMediaOptions> {
  if (!VIDEO_TARGETS.includes(form.target)) return { ok: false, error: 'INVALID_TARGET' };
  if (!QUALITY_LEVELS.includes(form.quality)) return { ok: false, error: 'INVALID_QUALITY' };

  const start = form.trimStart != null ? Math.max(0, form.trimStart) : undefined;
  const end = form.trimEnd != null ? form.trimEnd : undefined;
  if (start != null && end != null && end <= start) return { ok: false, error: 'INVALID_TRIM' };

  const width = form.width != null && form.width > 0 ? Math.round(form.width) : undefined;

  return {
    ok: true,
    value: {
      target: form.target,
      quality: form.quality,
      ...(width ? { video: { width } } : {}),
      ...(start != null || end != null ? { trim: { start, end } } : {}),
    },
  };
}

/** `83.4` → `1:23.4` */
export function formatDuration(seconds: number): string {
  if (!Number.isFinite(seconds) || seconds < 0) return '--:--';
  const total = Math.round(seconds * 10) / 10;
  const minutes = Math.floor(total / 60);
  const rest = (total % 60).toFixed(1).padStart(4, '0');
  return `${minutes}:${rest}`;
}

/** 依据目标容器生成下载文件名（替换原扩展名）。 */
export function outputFileName(baseName: string, target: MediaTarget): string {
  const stem = baseName.replace(/\.[^./\\]+$/, '') || 'output';
  return `${stem}.${target}`;
}
