/**
 * Page decoration → pdf-lib painting (P1-A).
 *
 * Decorations are painted *under* the overlay objects and above the page content: a watermark that
 * covered an annotation would look like a bug, and a header that annotations can cover is what Word
 * does too. Everything is drawn in visual page coordinates (`beginVisualDraw`), so a page the user
 * rotated on screen gets the same header position after saving.
 *
 * The placement helpers are pure and exported: text baselines are the one thing that reliably goes
 * wrong by a few points between preview and output, so they are unit tested instead of eyeballed.
 */

import { degrees } from '@cantoo/pdf-lib';
import { beginVisualDraw, endVisualDraw, getVisualPageSize, parseColor } from '@/core/pdf/draw';
import { embedRasterizedText, needsUnicodeFont } from '@/core/pdf/text';
import { hasDecoration, pageNumberFor, watermarkTileAnchors } from '../model/decorations';
import type {
  PdfDecoration,
  PdfDecorationAlign,
  PdfDecorationPosition,
  PdfLineDecoration,
  PdfPageNumberRule,
  PdfWatermarkDecoration,
} from '../model/types';
import type { DrawContext } from './drawObject';

export interface DecorationDrawOptions {
  decoration: PdfDecoration | undefined;
  /** 0-based index of the page in the *output* document; drives `startFrom` */
  index: number;
  /** Number of visible pages in the output document */
  total: number;
}

export interface DecorationDrawResult {
  /** True when at least one string had to be embedded as a bitmap (CJK watermark, etc.) */
  rasterized: boolean;
}

/** Decorations need the document, the page and the fonts — no image embedding */
export type DecorationDrawContext = Pick<DrawContext, 'out' | 'page' | 'fonts'>;

/** Which edge a numbered line belongs to */
export function positionEdge(position: PdfDecorationPosition): 'top' | 'bottom' {
  return position === 'top-center' ? 'top' : 'bottom';
}

/** Horizontal alignment implied by a page-number position */
export function positionAlign(position: PdfDecorationPosition): PdfDecorationAlign {
  if (position === 'bottom-left') return 'left';
  if (position === 'bottom-right') return 'right';
  return 'center';
}

/**
 * Text baseline in visual page points (origin bottom-left).
 *
 * `margin` is measured to the *edge of the text box*, not to the baseline: a 10pt footer with a
 * 24pt margin has its glyphs 24pt from the edge, which is what the preview draws.
 */
export function lineBaseline(
  pageHeight: number,
  fontSize: number,
  margin: number,
  edge: 'top' | 'bottom',
): number {
  if (edge === 'top') return pageHeight - margin - fontSize;
  return margin;
}

/** Left edge of one text run for the given alignment and margin */
export function lineX(
  pageWidth: number,
  textWidth: number,
  align: PdfDecorationAlign,
  margin: number,
): number {
  if (align === 'center') return (pageWidth - textWidth) / 2;
  if (align === 'right') return pageWidth - margin - textWidth;
  return margin;
}

/** Approximate text width when the exact font is unknown (raster path) */
export function approximateTextWidth(text: string, fontSize: number): number {
  let width = 0;
  for (const character of text) {
    // CJK glyphs are full-width; Latin averages ~0.55em in Helvetica
    width += (character.codePointAt(0) ?? 0) > 0xff ? fontSize : fontSize * 0.55;
  }
  return width;
}

/** Width of `text` with the embedded regular font, or an estimate when it must be rasterized */
function measure(ctx: DecorationDrawContext, text: string, size: number): number {
  return needsUnicodeFont(text)
    ? approximateTextWidth(text, size)
    : ctx.fonts.regular.widthOfTextAtSize(text, size);
}

/**
 * Draw one string at the given baseline / left edge, rasterizing when StandardFonts cannot encode
 * it. Returns `true` when a bitmap was used.
 *
 * Raster failures are swallowed: a decoration is cosmetic, and losing the ability to save because a
 * canvas is missing in the current environment would be far worse than a missing watermark.
 */
async function drawLine(
  ctx: DecorationDrawContext,
  text: string,
  options: {
    x: number;
    y: number;
    size: number;
    color: string;
    opacity?: number;
    rotation?: number;
  },
): Promise<boolean> {
  if (!text.trim()) return false;
  const color = parseColor(options.color);

  if (needsUnicodeFont(text)) {
    try {
      const raster = await embedRasterizedText(ctx.out, text, options.size, color);
      ctx.page.drawImage(raster.image, {
        x: options.x,
        y: options.y - raster.height * 0.2,
        width: raster.width,
        height: raster.height,
        opacity: options.opacity ?? 1,
      });
      return true;
    } catch {
      return false;
    }
  }

  ctx.page.drawText(text, {
    x: options.x,
    y: options.y,
    size: options.size,
    font: ctx.fonts.regular,
    color,
    opacity: options.opacity ?? 1,
    ...(options.rotation ? { rotate: degrees(options.rotation) } : {}),
  });
  return false;
}

async function drawHeaderFooter(
  ctx: DecorationDrawContext,
  line: PdfLineDecoration,
  pageSize: { width: number; height: number },
  edge: 'top' | 'bottom',
): Promise<boolean> {
  const text = line.text.trim();
  if (!text) return false;
  const width = measure(ctx, text, line.fontSize);
  return drawLine(ctx, text, {
    x: lineX(pageSize.width, width, line.align, line.margin),
    y: lineBaseline(pageSize.height, line.fontSize, line.margin, edge),
    size: line.fontSize,
    color: line.color,
  });
}

async function drawNumbers(
  ctx: DecorationDrawContext,
  rule: PdfPageNumberRule,
  pageSize: { width: number; height: number },
  index: number,
  total: number,
): Promise<boolean> {
  if (!rule.enabled) return false;
  const text = pageNumberFor(rule, index, total);
  const width = measure(ctx, text, rule.fontSize);
  return drawLine(ctx, text, {
    x: lineX(pageSize.width, width, positionAlign(rule.position), rule.margin),
    y: lineBaseline(pageSize.height, rule.fontSize, rule.margin, positionEdge(rule.position)),
    size: rule.fontSize,
    color: rule.color,
  });
}

/**
 * Draw the watermark.
 *
 * `rotation` is CCW in PDF space, and pdf-lib rotates around the text origin, so the origin has to
 * be corrected by the rotated centre offset; otherwise a 45° watermark visibly drifts towards the
 * top-left corner instead of staying centred.
 */
async function drawWatermark(
  ctx: DecorationDrawContext,
  mark: PdfWatermarkDecoration,
  pageSize: { width: number; height: number },
): Promise<boolean> {
  const text = mark.text.trim();
  if (!text) return false;

  const width = measure(ctx, text, mark.fontSize);
  const anchors = mark.tiled
    ? watermarkTileAnchors(pageSize.width, pageSize.height, mark.spacing)
    : [{ x: 0.5, y: 0.5 }];

  const radians = (mark.rotation * Math.PI) / 180;
  const cos = Math.cos(radians);
  const sin = Math.sin(radians);
  // Offset from the text origin to its visual centre, rotated into page space
  const halfWidth = width / 2;
  const halfHeight = mark.fontSize * 0.35;
  const offsetX = halfWidth * cos - halfHeight * sin;
  const offsetY = halfWidth * sin + halfHeight * cos;

  let rasterized = false;
  for (const anchor of anchors) {
    const painted = await drawLine(ctx, text, {
      x: anchor.x * pageSize.width - offsetX,
      y: anchor.y * pageSize.height - offsetY,
      size: mark.fontSize,
      color: mark.color,
      opacity: mark.opacity,
      rotation: mark.rotation,
    });
    if (painted) rasterized = true;
  }
  return rasterized;
}

/**
 * Paint every decoration section on one page.
 *
 * Order matters: watermark first (it is the background layer of the decorations), then header,
 * footer and finally the page number, which the user expects on top of a bottom-centre footer.
 */
export async function drawPageDecorations(
  ctx: DecorationDrawContext,
  options: DecorationDrawOptions,
): Promise<DecorationDrawResult> {
  const { decoration } = options;
  if (!decoration || !hasDecoration(decoration)) return { rasterized: false };

  const pageSize = getVisualPageSize(ctx.page);
  beginVisualDraw(ctx.page);
  try {
    let rasterized = false;
    if (decoration.watermark) {
      if (await drawWatermark(ctx, decoration.watermark, pageSize)) rasterized = true;
    }
    if (decoration.header) {
      if (await drawHeaderFooter(ctx, decoration.header, pageSize, 'top')) rasterized = true;
    }
    if (decoration.footer) {
      if (await drawHeaderFooter(ctx, decoration.footer, pageSize, 'bottom')) rasterized = true;
    }
    if (decoration.numbers) {
      const painted = await drawNumbers(
        ctx,
        decoration.numbers,
        pageSize,
        options.index,
        options.total,
      );
      if (painted) rasterized = true;
    }
    return { rasterized };
  } finally {
    endVisualDraw(ctx.page);
  }
}
