import type { ToolResult } from '@/core/types';

/**
 * SVG → PNG：校验与尺寸解析（绘制在 UI canvas）。
 */

export type SvgError = 'EMPTY' | 'INVALID_SVG' | 'INVALID_SIZE';

export const MIN_SCALE = 0.25;
export const MAX_SCALE = 8;
export const MAX_OUTPUT = 8192;

export interface SvgMeta {
  svg: string;
  width: number;
  height: number;
}

function parseLength(raw: string | undefined, fallback: number): number | null {
  if (!raw) return fallback;
  const cleaned = raw.trim().replace(/px$/i, '');
  if (!cleaned || cleaned.includes('%')) return fallback;
  const n = Number(cleaned);
  if (!Number.isFinite(n) || n <= 0) return null;
  return n;
}

/** 从 SVG 源提取宽高；优先 width/height，其次 viewBox */
export function extractSvgSize(svg: string): { width: number; height: number } | null {
  const docMatch = svg.match(/<svg\b[^>]*>/i);
  if (!docMatch) return null;
  const tag = docMatch[0];

  const widthAttr = tag.match(/\bwidth\s*=\s*["']([^"']+)["']/i)?.[1];
  const heightAttr = tag.match(/\bheight\s*=\s*["']([^"']+)["']/i)?.[1];
  const viewBox = tag.match(/\bviewBox\s*=\s*["']([^"']+)["']/i)?.[1];

  let width = parseLength(widthAttr, 0) ?? 0;
  let height = parseLength(heightAttr, 0) ?? 0;

  if ((!width || !height) && viewBox) {
    const parts = viewBox.trim().split(/[\s,]+/).map(Number);
    if (parts.length === 4 && parts.every((n) => Number.isFinite(n))) {
      const vbW = parts[2];
      const vbH = parts[3];
      if (vbW > 0 && vbH > 0) {
        width = width || vbW;
        height = height || vbH;
      }
    }
  }

  if (!width || !height) {
    width = width || 300;
    height = height || 150;
  }
  return { width, height };
}

export function validateSvg(input: string): ToolResult<SvgMeta> {
  const svg = input.trim();
  if (!svg) return { ok: false, error: 'EMPTY' };
  if (!/<svg\b/i.test(svg) || !/<\/svg>/i.test(svg)) {
    return { ok: false, error: 'INVALID_SVG' };
  }
  const size = extractSvgSize(svg);
  if (!size) return { ok: false, error: 'INVALID_SVG' };
  return { ok: true, value: { svg, width: size.width, height: size.height } };
}

export function computeOutputSize(
  width: number,
  height: number,
  scale: number,
): ToolResult<{ width: number; height: number }> {
  if (!Number.isFinite(scale) || scale < MIN_SCALE || scale > MAX_SCALE) {
    return { ok: false, error: 'INVALID_SIZE' };
  }
  const w = Math.round(width * scale);
  const h = Math.round(height * scale);
  if (w < 1 || h < 1 || w > MAX_OUTPUT || h > MAX_OUTPUT) {
    return { ok: false, error: 'INVALID_SIZE' };
  }
  return { ok: true, value: { width: w, height: h } };
}

export function svgToDataUrl(svg: string): string {
  return `data:image/svg+xml;charset=utf-8,${encodeURIComponent(svg)}`;
}
