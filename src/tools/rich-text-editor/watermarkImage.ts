import type { WatermarkConfig } from './pageSetup';

/**
 * Rasterizing the text watermark: Word paragraph properties cannot rotate text,
 * so docx export renders it as a transparent PNG placed as a floating image in the header (behind text),
 * matching how it looks on screen, in print, and in PDF.
 */

export interface WatermarkImage {
  dataUrl: string;
  /** Logical size in CSS px, converted px → EMU when written to docx */
  width: number;
  height: number;
}

/** Raster scale: the watermark is large pale text, so 2x is enough and keeps the file small */
const PIXEL_RATIO = 2;

const FONT_STACK = "'PingFang SC','Microsoft YaHei',Arial,sans-serif";

export async function renderWatermarkImage(
  watermark: WatermarkConfig | null | undefined,
  widthPx: number,
  heightPx: number,
): Promise<WatermarkImage | null> {
  if (!watermark || !watermark.text.trim()) return null;
  if (typeof document === 'undefined') return null;
  if (widthPx <= 0 || heightPx <= 0) return null;

  const { toPng } = await import('html-to-image');
  const host = document.createElement('div');
  host.setAttribute('aria-hidden', 'true');
  host.style.cssText = 'position:fixed;left:-10000px;top:0;pointer-events:none;z-index:-1;';
  document.body.appendChild(host);

  try {
    const node = document.createElement('div');
    node.style.cssText = `width:${widthPx}px;height:${heightPx}px;display:flex;align-items:center;justify-content:center;overflow:hidden;background:transparent;`;
    const span = document.createElement('span');
    span.textContent = watermark.text;
    // Font size matches the screen clamp(28px, 5vw, 64px) so the watermark looks the same
    const fontSize = Math.max(28, Math.min(Math.round(widthPx * 0.16), 96));
    span.style.cssText = `color:${watermark.color};opacity:${watermark.opacity};transform:rotate(${watermark.rotation}deg);font-family:${FONT_STACK};font-weight:700;font-size:${fontSize}px;letter-spacing:0.08em;white-space:nowrap;`;
    node.appendChild(span);
    host.appendChild(node);

    const dataUrl = await toPng(node, { pixelRatio: PIXEL_RATIO, cacheBust: true });
    return { dataUrl, width: widthPx, height: heightPx };
  } catch {
    // A render failure must not block export: a missing watermark beats a failed export
    return null;
  } finally {
    host.remove();
  }
}
