import katex from 'katex';

/**
 * Formula rasterization (the image fallback for syntax OMML cannot express):
 * Renders off-screen with KaTeX, then uses html-to-image to produce a PNG,
 * so Word shows the same formula instead of raw source text or missing content.
 */

export interface MathImage {
  /** PNG data URL (the export layer decodes it to bytes) */
  dataUrl: string;
  /** Logical size in CSS px; converted px → EMU when written to docx */
  width: number;
  height: number;
}

/** Raster scale: formulas are small, so 3x keeps them sharp in print */
const PIXEL_RATIO = 3;

export interface MathImageRequest {
  /** Dedupe key (each formula renders only once) */
  key: string;
  latex: string;
  display: boolean;
}

/**
 * Render formula images in bulk.
 * Failures are skipped (the caller falls back to source text) and never thrown:
 * the export must not fail as a whole because of one formula.
 */
export async function renderLatexImages(
  items: readonly MathImageRequest[],
): Promise<Map<string, MathImage>> {
  const result = new Map<string, MathImage>();
  if (items.length === 0 || typeof document === 'undefined') return result;

  const { toPng } = await import('html-to-image');
  const host = document.createElement('div');
  host.setAttribute('aria-hidden', 'true');
  // Must take part in layout to be rasterized: move it off-screen instead of display:none
  host.style.cssText =
    'position:fixed;left:-10000px;top:0;background:#ffffff;z-index:-1;pointer-events:none;';
  document.body.appendChild(host);

  try {
    for (const item of items) {
      if (result.has(item.key)) continue;
      const node = document.createElement('div');
      node.style.cssText = 'display:inline-block;background:#ffffff;padding:4px;';
      try {
        node.innerHTML = katex.renderToString(item.latex, {
          displayMode: item.display,
          throwOnError: true,
          strict: false,
        });
      } catch {
        continue;
      }
      host.appendChild(node);
      const width = node.offsetWidth;
      const height = node.offsetHeight;
      if (width <= 0 || height <= 0) {
        node.remove();
        continue;
      }
      try {
        const dataUrl = await toPng(node, {
          pixelRatio: PIXEL_RATIO,
          backgroundColor: '#ffffff',
          cacheBust: true,
        });
        result.set(item.key, { dataUrl, width, height });
      } catch {
        // One failure does not affect the other formulas
      }
      node.remove();
    }
  } finally {
    host.remove();
  }
  return result;
}
