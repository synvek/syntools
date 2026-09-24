import { degrees, rgb } from '@cantoo/pdf-lib';
import type { ToolResult } from '@/core/types';
import {
  fileToBytes,
  isPdfFile,
  loadPdfFromBytes,
  parsePageSelection,
  PDF_MAX_BYTES,
} from '@/core/pdf';

export interface WatermarkOptions {
  text: string;
  fontSize: number;
  opacity: number;
  rotation: number;
  color: string;
  mode: 'all' | 'first' | 'custom';
  pageSelection?: string;
  tiled: boolean;
  spacing: number;
}

export type Rgba = { r: number; g: number; b: number };

/** 解析 #RGB / #RRGGBB 为 0–1 的 rgb 分量 */
export function parseHexColor(hex: string): Rgba | null {
  let h = hex.trim().replace(/^#/, '');
  if (h.length === 3)
    h = h
      .split('')
      .map((c) => c + c)
      .join('');
  if (!/^[0-9a-fA-F]{6}$/.test(h)) return null;
  return {
    r: parseInt(h.slice(0, 2), 16) / 255,
    g: parseInt(h.slice(2, 4), 16) / 255,
    b: parseInt(h.slice(4, 6), 16) / 255,
  };
}

/** 平铺模式下的网格坐标（以页宽高为基准，返回归一化中心点的像素坐标列表） */
export function buildTileCenters(
  width: number,
  height: number,
  spacing: number,
): Array<{ x: number; y: number }> {
  const out: Array<{ x: number; y: number }> = [];
  if (spacing <= 0) spacing = 1;
  for (let y = spacing / 2; y < height; y += spacing) {
    for (let x = spacing / 2; x < width; x += spacing) {
      out.push({ x, y });
    }
  }
  return out;
}

export async function addWatermark(
  file: File,
  password: string,
  opts: WatermarkOptions,
): Promise<ToolResult<{ bytes: Uint8Array; pages: number }>> {
  if (!isPdfFile(file)) return { ok: false, error: 'NOT_PDF' };
  if (file.size > PDF_MAX_BYTES) return { ok: false, error: 'TOO_LARGE' };
  if (!opts.text.trim()) return { ok: false, error: 'EMPTY_TEXT' };

  const color = parseHexColor(opts.color);
  if (!color) return { ok: false, error: 'INVALID_COLOR' };

  const loaded = await loadPdfFromBytes(await fileToBytes(file), { password });
  if (!loaded.ok) return loaded;

  const doc = loaded.value;
  try {
    const count = doc.getPageCount();
    let targets = doc.getPageIndices();
    if (opts.mode === 'first') targets = [0];
    else if (opts.mode === 'custom' && opts.pageSelection?.trim()) {
      const sel = parsePageSelection(opts.pageSelection, count);
      if (!sel.ok) return sel;
      targets = sel.value;
    }

    for (const i of targets) {
      const page = doc.getPage(i);
      const { width, height } = page.getSize();
      if (opts.tiled) {
        for (const c of buildTileCenters(width, height, opts.spacing)) {
          page.drawText(opts.text, {
            x: c.x,
            y: c.y,
            size: opts.fontSize,
            opacity: opts.opacity,
            rotate: degrees(opts.rotation),
            color: rgb(color.r, color.g, color.b),
          });
        }
      } else {
        const textWidth = opts.text.length * opts.fontSize * 0.6;
        page.drawText(opts.text, {
          x: (width - textWidth) / 2,
          y: height / 2,
          size: opts.fontSize,
          opacity: opts.opacity,
          rotate: degrees(opts.rotation),
          color: rgb(color.r, color.g, color.b),
        });
      }
    }
    const bytes = await doc.save();
    return { ok: true, value: { bytes, pages: targets.length } };
  } catch {
    return { ok: false, error: 'PROCESS_FAILED' };
  }
}
