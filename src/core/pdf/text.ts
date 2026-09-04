import { type PDFDocument, type PDFImage, type RGB } from '@cantoo/pdf-lib';

/**
 * StandardFonts use WinAnsi — CJK / most Unicode become "?".
 * Anything outside Latin-1 must use the canvas raster path.
 */
export function needsUnicodeFont(text: string): boolean {
  for (const ch of text) {
    const cp = ch.codePointAt(0);
    if (cp != null && cp > 0xff) return true;
  }
  return false;
}

function colorToCss(color: RGB): string {
  const r = Math.round(color.red * 255);
  const g = Math.round(color.green * 255);
  const b = Math.round(color.blue * 255);
  return `rgb(${r}, ${g}, ${b})`;
}

/** Prefer system CJK fonts so Chinese renders without bundling a multi‑MB face. */
const PDF_TEXT_FONT_STACK =
  '"Noto Sans SC", "PingFang SC", "Hiragino Sans GB", "Microsoft YaHei", "Noto Sans CJK SC", "WenQuanYi Micro Hei", sans-serif';

export interface RasterTextImage {
  image: PDFImage;
  /** Draw size in PDF points */
  width: number;
  height: number;
}

/**
 * Rasterize text with the browser's local fonts and embed as PNG.
 * Used when StandardFonts cannot encode the string (e.g. Chinese headers).
 */
export async function embedRasterizedText(
  doc: PDFDocument,
  text: string,
  size: number,
  color: RGB,
): Promise<RasterTextImage> {
  if (typeof document === 'undefined') {
    throw new Error('UNICODE_FONT_UNAVAILABLE');
  }

  const scale = 3;
  const probe = document.createElement('canvas');
  const probeCtx = probe.getContext('2d');
  if (!probeCtx) throw new Error('PROCESS_FAILED');

  const fontCss = `${size * scale}px ${PDF_TEXT_FONT_STACK}`;
  probeCtx.font = fontCss;
  const measured = probeCtx.measureText(text);
  const pad = Math.ceil(scale);
  const pixelW = Math.max(1, Math.ceil(measured.width) + pad * 2);
  const pixelH = Math.max(1, Math.ceil(size * scale * 1.45) + pad);

  const canvas = document.createElement('canvas');
  canvas.width = pixelW;
  canvas.height = pixelH;
  const ctx = canvas.getContext('2d');
  if (!ctx) throw new Error('PROCESS_FAILED');

  ctx.font = fontCss;
  ctx.fillStyle = colorToCss(color);
  ctx.textBaseline = 'top';
  ctx.fillText(text, pad, Math.ceil(pad * 0.35));

  const dataUrl = canvas.toDataURL('image/png');
  const comma = dataUrl.indexOf(',');
  if (comma < 0) throw new Error('PROCESS_FAILED');
  const binary = atob(dataUrl.slice(comma + 1));
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);

  const image = await doc.embedPng(bytes);
  return {
    image,
    width: pixelW / scale,
    height: pixelH / scale,
  };
}
