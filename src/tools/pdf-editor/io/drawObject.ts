/**
 * Overlay object → pdf-lib painting.
 *
 * One branch per `PdfObject` kind, all of them drawing in *visual* page coordinates (see
 * `beginVisualDraw`): the /Rotate cancelling CTM is applied once here, so no branch has to know
 * whether the page is landscape or turned 90°. Object rotation is applied as a CTM around the
 * frame centre, which keeps every primitive's geometry axis-aligned and testable.
 *
 * Pure geometry lives in exported helpers (`objectFrame`, `markupQuadRects`, `inkPolyline`,
 * `arrowHeadPoints`) so the math is unit tested; only the pdf-lib calls need a real document.
 */

import {
  LineCapStyle,
  popGraphicsState,
  pushGraphicsState,
  rotateDegrees,
  translate,
  type PDFDocument,
  type PDFFont,
  type PDFImage,
  type PDFPage,
} from '@cantoo/pdf-lib';
import { beginVisualDraw, endVisualDraw, getVisualPageSize, parseColor } from '@/core/pdf/draw';
import { embedRasterizedText, needsUnicodeFont } from '@/core/pdf/text';
import { normRectToVisual, type Point, type Rect, type Size } from '../model/coords';
import type {
  PdfInkObject,
  PdfMarkupObject,
  PdfNoteObject,
  PdfObject,
  PdfShapeObject,
  PdfTextAlign,
  PdfTextObject,
} from '../model/types';
import { fittedBox, imageFormat } from './imageScale';

export interface FontSet {
  regular: PDFFont;
  bold: PDFFont;
  italic: PDFFont;
  boldItalic: PDFFont;
}

export interface DrawContext {
  out: PDFDocument;
  page: PDFPage;
  fonts: FontSet;
  /** Data URL → embedded image; `null` when the payload is not a PNG/JPEG we can embed */
  embedImage(dataUrl: string): Promise<PDFImage | null>;
}

/** Highlight fill alpha (N2: pdf-lib has no Multiply blend mode) */
export const MARKUP_ALPHA = 0.35;

/** Note icon and body typography (N3) */
const NOTE_BODY_SIZE = 9;
const NOTE_BORDER = '#f59e0b';
const NOTE_FILL = '#fde68a';

/* -------------------------------------------------------------------------- */
/* Pure geometry                                                              */
/* -------------------------------------------------------------------------- */

/** Frame of an object in visual page points (bottom-left origin) */
export function objectFrame(object: PdfObject, visual: Size): Rect {
  return normRectToVisual(object.rect, visual);
}

/** One visual rect per markup quad; quads are page-normalized like the object rect */
export function markupQuadRects(object: PdfMarkupObject, visual: Size): Rect[] {
  return object.quads.map((quad) => normRectToVisual(quad, visual));
}

/**
 * Ink points in visual page points.
 *
 * Model points are normalized *inside* the frame with a top-down y axis (same convention as the
 * SVG preview), so the y axis is flipped here to match PDF space.
 */
export function inkPolyline(object: PdfInkObject, visual: Size): Point[] {
  const frame = objectFrame(object, visual);
  return object.points.map((point) => ({
    x: frame.x + point.x * frame.width,
    y: frame.y + (1 - point.y) * frame.height,
  }));
}

/** Two wing points of the arrow head at `to`, pointing away from `from` */
export function arrowHeadPoints(from: Point, to: Point, thickness: number): [Point, Point] {
  const angle = Math.atan2(to.y - from.y, to.x - from.x);
  const length = Math.max(6, thickness * 4);
  const spread = Math.PI / 7;
  return [
    {
      x: to.x - length * Math.cos(angle - spread),
      y: to.y - length * Math.sin(angle - spread),
    },
    {
      x: to.x - length * Math.cos(angle + spread),
      y: to.y - length * Math.sin(angle + spread),
    },
  ];
}

/** Line endpoints of a `line` / `arrow` shape: top-left → bottom-right, as previewed in SVG */
export function lineEndpoints(frame: Rect): { start: Point; end: Point } {
  return {
    start: { x: frame.x, y: frame.y + frame.height },
    end: { x: frame.x + frame.width, y: frame.y },
  };
}

function alignX(frame: Rect, width: number, align: PdfTextAlign): number {
  if (align === 'center') return frame.x + (frame.width - width) / 2;
  if (align === 'right') return frame.x + frame.width - width;
  return frame.x;
}

/** Rotate the CTM around the frame centre; the model's angle is CSS-style (clockwise on screen) */
function pushObjectRotation(page: PDFPage, frame: Rect, rotation: number): boolean {
  if (!rotation) return false;
  const centerX = frame.x + frame.width / 2;
  const centerY = frame.y + frame.height / 2;
  page.pushOperators(
    pushGraphicsState(),
    translate(centerX, centerY),
    rotateDegrees(-rotation),
    translate(-centerX, -centerY),
  );
  return true;
}

/* -------------------------------------------------------------------------- */
/* Text                                                                       */
/* -------------------------------------------------------------------------- */

function pickFont(fonts: FontSet, object: Pick<PdfTextObject, 'bold' | 'italic'>): PDFFont {
  if (object.bold && object.italic) return fonts.boldItalic;
  if (object.bold) return fonts.bold;
  if (object.italic) return fonts.italic;
  return fonts.regular;
}

/** Break `text` into lines that fit `maxWidth`, keeping explicit newlines */
function wrapText(
  text: string,
  font: PDFFont,
  size: number,
  maxWidth: number,
  approximate: boolean,
): string[] {
  const widthOf = (value: string) =>
    approximate ? value.length * size * 0.9 : font.widthOfTextAtSize(value, size);

  const lines: string[] = [];
  for (const paragraph of text.split(/\r?\n/)) {
    if (!paragraph) continue;
    // CJK has no spaces to break on: fall back to character wrapping
    const pieces = approximate ? Array.from(paragraph) : paragraph.split(' ');
    let current = '';
    for (const piece of pieces) {
      const candidate = current
        ? approximate
          ? `${current}${piece}`
          : `${current} ${piece}`
        : piece;
      if (current && widthOf(candidate) > maxWidth) {
        lines.push(current);
        current = piece;
      } else {
        current = candidate;
      }
    }
    if (current) lines.push(current);
  }
  return lines;
}

async function drawTextObject(
  ctx: DrawContext,
  object: PdfTextObject,
  frame: Rect,
): Promise<boolean> {
  const { page, fonts } = ctx;
  let rasterized = false;

  const cover = object.patch?.cover ?? object.bg;
  if (cover) {
    page.drawRectangle({
      x: frame.x,
      y: frame.y,
      width: frame.width,
      height: frame.height,
      color: parseColor(cover),
    });
  }
  if (object.border) {
    page.drawRectangle({
      x: frame.x,
      y: frame.y,
      width: frame.width,
      height: frame.height,
      borderColor: parseColor(object.border),
      borderWidth: 1,
    });
  }

  const lines = object.text.split(/\r?\n/);
  const step = object.fontSize * object.lineHeight;
  // Approximate ascent: the first baseline sits one font size below the box top
  const firstBaseline = frame.y + frame.height - object.fontSize;

  for (const [index, line] of lines.entries()) {
    if (!line) continue;
    const baseline = firstBaseline - index * step;

    if (needsUnicodeFont(line)) {
      rasterized = true;
      const raster = await embedRasterizedText(
        ctx.out,
        line,
        object.fontSize,
        parseColor(object.color),
      );
      page.drawImage(raster.image, {
        x: alignX(frame, raster.width, object.align),
        y: baseline - object.fontSize * 0.2,
        width: raster.width,
        height: raster.height,
        opacity: object.opacity,
      });
      continue;
    }

    const font = pickFont(fonts, object);
    page.drawText(line, {
      x: alignX(frame, font.widthOfTextAtSize(line, object.fontSize), object.align),
      y: baseline,
      size: object.fontSize,
      font,
      color: parseColor(object.color),
      opacity: object.opacity,
    });
  }

  return rasterized;
}

/* -------------------------------------------------------------------------- */
/* Kinds                                                                      */
/* -------------------------------------------------------------------------- */

async function drawImageObject(
  ctx: DrawContext,
  object: Extract<PdfObject, { kind: 'image' | 'stamp' | 'signature' }>,
  frame: Rect,
): Promise<void> {
  const image = await ctx.embedImage(object.dataUrl);
  if (!image) return;

  const fit = object.kind === 'image' ? object.fit : 'contain';
  const box = fittedBox(
    { width: frame.width, height: frame.height },
    { width: object.naturalW, height: object.naturalH },
    fit,
  );
  ctx.page.drawImage(image, {
    x: frame.x + box.offsetX,
    y: frame.y + box.offsetY,
    width: box.width,
    height: box.height,
    opacity: object.opacity,
  });
}

function drawInkObject(ctx: DrawContext, object: PdfInkObject, visual: Size): void {
  const points = inkPolyline(object, visual);
  const color = parseColor(object.color);

  for (let index = 1; index < points.length; index += 1) {
    ctx.page.drawLine({
      start: points[index - 1],
      end: points[index],
      thickness: Math.max(0.25, object.width),
      color,
      opacity: object.opacity,
      lineCap: LineCapStyle.Round,
    });
  }
}

function drawMarkupObject(ctx: DrawContext, object: PdfMarkupObject, visual: Size): void {
  const color = parseColor(object.color);
  const thickness = Math.max(0.75, 1);

  for (const quad of markupQuadRects(object, visual)) {
    if (object.type === 'highlight') {
      ctx.page.drawRectangle({
        x: quad.x,
        y: quad.y,
        width: quad.width,
        height: quad.height,
        color,
        opacity: object.opacity * MARKUP_ALPHA,
      });
      continue;
    }

    const y = object.type === 'underline' ? quad.y : quad.y + quad.height / 2;
    ctx.page.drawLine({
      start: { x: quad.x, y },
      end: { x: quad.x + quad.width, y },
      thickness,
      color,
      opacity: object.opacity,
    });
  }
}

function drawShapeObject(ctx: DrawContext, object: PdfShapeObject, visual: Size): void {
  const frame = objectFrame(object, visual);
  const stroke = parseColor(object.stroke);
  const opacity = object.opacity;
  const width = Math.max(0.25, object.width);
  const dash = object.dash?.length ? object.dash : undefined;

  if (object.type === 'rect') {
    ctx.page.drawRectangle({
      x: frame.x + width / 2,
      y: frame.y + width / 2,
      width: Math.max(1, frame.width - width),
      height: Math.max(1, frame.height - width),
      borderColor: stroke,
      borderWidth: width,
      borderDashArray: dash,
      borderOpacity: opacity,
      color: object.fill ? parseColor(object.fill) : undefined,
      opacity: object.fill ? opacity : undefined,
    });
    return;
  }

  if (object.type === 'ellipse') {
    ctx.page.drawEllipse({
      x: frame.x + frame.width / 2,
      y: frame.y + frame.height / 2,
      xScale: Math.max(0.5, frame.width / 2 - width / 2),
      yScale: Math.max(0.5, frame.height / 2 - width / 2),
      borderColor: stroke,
      borderWidth: width,
      borderDashArray: dash,
      borderOpacity: opacity,
      color: object.fill ? parseColor(object.fill) : undefined,
      opacity: object.fill ? opacity : undefined,
    });
    return;
  }

  const { start, end } = lineEndpoints(frame);
  ctx.page.drawLine({
    start,
    end,
    thickness: width,
    color: stroke,
    opacity,
    lineCap: LineCapStyle.Round,
    dashArray: dash,
  });

  if (object.type === 'arrow') {
    const [left, right] = arrowHeadPoints(start, end, width);
    ctx.page.drawLine({ start: end, end: left, thickness: width, color: stroke, opacity });
    ctx.page.drawLine({ start: end, end: right, thickness: width, color: stroke, opacity });
  }
}

async function drawNoteObject(
  ctx: DrawContext,
  object: PdfNoteObject,
  frame: Rect,
  visual: Size,
): Promise<boolean> {
  ctx.page.drawRectangle({
    x: frame.x,
    y: frame.y,
    width: frame.width,
    height: frame.height,
    color: parseColor(NOTE_FILL),
    borderColor: parseColor(NOTE_BORDER),
    borderWidth: 0.75,
    opacity: object.opacity,
  });

  const body = object.body.trim();
  if (!body) return false;

  // Icon-sized frames are too small for text: the body is painted next to the note, like Acrobat
  const boxX = frame.x + frame.width + NOTE_BODY_SIZE * 0.5;
  const maxWidth = Math.min(visual.width * 0.4, 260);

  const font = ctx.fonts.regular;
  const approximate = needsUnicodeFont(body);
  const lines = wrapText(body, font, NOTE_BODY_SIZE, maxWidth, approximate).slice(0, 12);
  const step = NOTE_BODY_SIZE * 1.3;
  // Text grows downwards from the note's top edge (PDF y axis runs up)
  const top = Math.min(visual.height - NOTE_BODY_SIZE, frame.y + frame.height);

  for (const [index, line] of lines.entries()) {
    const baseline = top - index * step;
    if (approximate) {
      const raster = await embedRasterizedText(
        ctx.out,
        line,
        NOTE_BODY_SIZE,
        parseColor('#78350f'),
      );
      ctx.page.drawImage(raster.image, {
        x: boxX,
        y: baseline - NOTE_BODY_SIZE * 0.2,
        width: raster.width,
        height: raster.height,
        opacity: object.opacity,
      });
      continue;
    }

    ctx.page.drawText(line, {
      x: boxX,
      y: baseline,
      size: NOTE_BODY_SIZE,
      font,
      color: parseColor('#78350f'),
      opacity: object.opacity,
    });
  }

  return approximate;
}

/* -------------------------------------------------------------------------- */
/* Entry point                                                                */
/* -------------------------------------------------------------------------- */

/**
 * Paint one object onto `ctx.page`.
 *
 * Returns whether any text had to be rasterized (CJK / emoji), which surfaces in the save banner.
 * Unknown kinds paint nothing — the model is a closed union, so this only guards stale drafts.
 */
export async function drawObject(
  ctx: DrawContext,
  object: PdfObject,
): Promise<{ rasterized: boolean }> {
  const visual = getVisualPageSize(ctx.page);
  const frame = objectFrame(object, visual);

  beginVisualDraw(ctx.page);
  const rotated = pushObjectRotation(ctx.page, frame, object.rotation);
  try {
    switch (object.kind) {
      case 'text':
        return { rasterized: await drawTextObject(ctx, object, frame) };
      case 'image':
      case 'stamp':
      case 'signature':
        await drawImageObject(ctx, object, frame);
        return { rasterized: false };
      case 'ink':
        drawInkObject(ctx, object, visual);
        return { rasterized: false };
      case 'markup':
        drawMarkupObject(ctx, object, visual);
        return { rasterized: false };
      case 'shape':
        drawShapeObject(ctx, object, visual);
        return { rasterized: false };
      case 'note':
        return { rasterized: await drawNoteObject(ctx, object, frame, visual) };
      default:
        return { rasterized: false };
    }
  } finally {
    if (rotated) ctx.page.pushOperators(popGraphicsState());
    endVisualDraw(ctx.page);
  }
}

/** Embed a data URL with the right pdf-lib method; `null` for unsupported payloads */
export async function embedImageDataUrl(
  out: PDFDocument,
  dataUrl: string,
): Promise<PDFImage | null> {
  const format = imageFormat(dataUrl);
  if (!format) return null;
  try {
    return format === 'png' ? await out.embedPng(dataUrl) : await out.embedJpg(dataUrl);
  } catch {
    // Corrupt payload: skip the image rather than losing the whole save
    return null;
  }
}

/** Draw every object of one page (paint order is the caller's order) */
export async function drawPageObjects(
  ctx: DrawContext,
  objects: readonly PdfObject[],
): Promise<{ rasterized: boolean }> {
  let rasterized = false;
  for (const object of objects) {
    const result = await drawObject(ctx, object);
    if (result.rasterized) rasterized = true;
  }
  return { rasterized };
}
