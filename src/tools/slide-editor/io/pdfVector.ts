import { PDFDocument, StandardFonts, rgb, type PDFFont, type PDFPage } from '@cantoo/pdf-lib';
import type { ToolResult } from '@/core/types';
import { resolvePresetGeometry } from '../../../core/drawing/shapeDefs';
import { commandsToSvg, hasCustomGeometry, scaleCommands } from '../../../core/drawing/custGeom';
import type {
  Fill,
  LineElement,
  ShapeElement,
  Slide,
  SlideDoc,
  SlideElement,
  Stroke,
  TextBody,
  TextElement,
} from '../model/types';
import { layoutTextBody } from '../render/textLayout';

/**
 * Vector PDF channel (P1-4).
 *
 * Text and solid shapes are drawn as PDF operators, so the exported deck is searchable and text
 * stays crisp at any zoom. Anything we cannot express faithfully (images, charts, groups,
 * gradients, shadows, rotation, arrows, non-Latin text) makes that **whole page** fall back to
 * the raster pipeline, and the caller reports how many pages were rasterised.
 *
 * Coordinates: the document uses px @96dpi, PDF uses pt @72dpi → `PX_TO_PT = 0.75`.
 */
const PX_TO_PT = 0.75;

export interface VectorPdfResult {
  bytes: Uint8Array;
  /** Pages drawn as text + vector shapes */
  vectorPages: number;
  /** Pages that had to be rasterised */
  rasterPages: number;
}

const WIN_ANSI_EXTRA = new Set([
  0x20ac, 0x201a, 0x0192, 0x201e, 0x2026, 0x2020, 0x2021, 0x02c6, 0x2030, 0x0160, 0x2039, 0x0152,
  0x017d, 0x2018, 0x2019, 0x201c, 0x201d, 0x2022, 0x2013, 0x2014, 0x02dc, 0x2122, 0x0161, 0x203a,
  0x0153, 0x017e, 0x0178,
]);

/** Helvetica (WinAnsi) can only encode Latin text; anything else must go through the raster path */
export function isEncodableText(text: string): boolean {
  for (const char of text) {
    const code = char.codePointAt(0) ?? 0;
    if (code === 0x09 || code === 0x0a || code === 0x0d) continue;
    if (code >= 0x20 && code <= 0x7e) continue;
    if (code >= 0xa0 && code <= 0xff) continue;
    if (WIN_ANSI_EXTRA.has(code)) continue;
    return false;
  }
  return true;
}

function isSolidFill(fill: Fill | undefined): boolean {
  return !fill || fill.type === 'none' || fill.type === 'solid';
}

function hasGradientBackground(background: Slide['background'] | undefined): boolean {
  return Boolean(background && typeof background === 'object' && background.type === 'gradient');
}

function strokeIsPlain(stroke: Stroke | undefined): boolean {
  return Boolean(stroke?.color);
}

function textElementSafe(element: TextElement): boolean {
  if (element.body.vert && element.body.vert !== 'horz') return false;
  if (!isSolidFill(element.fill)) return false;
  for (const paragraph of element.body.paragraphs) {
    for (const run of paragraph.runs) {
      if (!isEncodableText(run.text)) return false;
    }
  }
  return true;
}

function shapeElementSafe(element: ShapeElement): boolean {
  if (!isSolidFill(element.fill)) return false;
  if (element.body && element.body.paragraphs.length > 0) {
    for (const paragraph of element.body.paragraphs) {
      for (const run of paragraph.runs) {
        if (!isEncodableText(run.text)) return false;
      }
    }
  }
  if (hasCustomGeometry(element.geom) && element.geom.custGeom) return true;
  const geometry = resolvePresetGeometry(element.geom.prst, element.geom.adj);
  return geometry.kind === 'rect' || geometry.kind === 'ellipse';
}

function lineElementSafe(element: LineElement): boolean {
  if (element.points.length !== 4) return false;
  if (element.route && element.route !== 'straight') return false;
  const head = element.head ?? 'none';
  const tail = element.tail ?? 'none';
  return head === 'none' && tail === 'none' && strokeIsPlain(element.stroke);
}

export function elementIsVectorSafe(element: SlideElement): boolean {
  if (element.visible === false) return true;
  if (element.shadow) return false;
  if (element.rotation) return false;
  if (element.flipX || element.flipY) return false;
  switch (element.type) {
    case 'text':
      return textElementSafe(element);
    case 'shape':
      return shapeElementSafe(element);
    case 'line':
      return lineElementSafe(element);
    default:
      return false;
  }
}

/** A slide can use the vector path only when every visible element and the background are expressible */
export function slideIsVectorSafe(doc: SlideDoc, slide: Slide): boolean {
  if (hasGradientBackground(slide.background)) return false;
  const layout = doc.layouts.find((item) => item.id === slide.layoutId);
  if (layout && hasGradientBackground(layout.background)) return false;
  // Placeholders / inherited elements are rendered by the raster path; mixing them in would drift
  if (layout && layout.elements.length > 0) return false;
  const master = layout ? doc.masters.find((item) => item.id === layout.masterId) : undefined;
  if (master && master.elements.length > 0) return false;
  return slide.elements.every((element) => elementIsVectorSafe(element));
}

function hexToRgb(hex: string | undefined, fallback = 0): ReturnType<typeof rgb> {
  const value = (hex ?? '').replace(/^#/, '');
  if (!/^[0-9a-fA-F]{6}$/.test(value)) return rgb(fallback, fallback, fallback);
  return rgb(
    parseInt(value.slice(0, 2), 16) / 255,
    parseInt(value.slice(2, 4), 16) / 255,
    parseInt(value.slice(4, 6), 16) / 255,
  );
}

/** Element background rectangle (or its corner-radius variant) */
function drawBox(
  page: PDFPage,
  x: number,
  y: number,
  width: number,
  height: number,
  fill: Fill | undefined,
  stroke: Stroke | undefined,
  radius = 0,
): void {
  if (!fill || fill.type === 'none') {
    if (!stroke) return;
  }
  page.drawRectangle({
    x: x * PX_TO_PT,
    y: page.getHeight() - (y + height) * PX_TO_PT,
    width: Math.max(0.1, width * PX_TO_PT),
    height: Math.max(0.1, height * PX_TO_PT),
    ...(fill && fill.type === 'solid'
      ? { color: hexToRgb(fill.color), opacity: fill.alpha ?? 1 }
      : {}),
    ...(stroke && stroke.width > 0
      ? {
          borderColor: hexToRgb(stroke.color),
          borderWidth: Math.max(0.2, stroke.width * PX_TO_PT),
          borderOpacity: stroke.alpha ?? 1,
        }
      : {}),
    ...(radius > 0 ? { radius: radius * PX_TO_PT } : {}),
  });
}

type FontKey = 'regular' | 'bold' | 'italic' | 'boldItalic';

function keyFor(style: { bold?: boolean; italic?: boolean }): FontKey {
  if (style.bold && style.italic) return 'boldItalic';
  if (style.bold) return 'bold';
  if (style.italic) return 'italic';
  return 'regular';
}

async function embedStandardFonts(doc: PDFDocument): Promise<Record<FontKey, PDFFont>> {
  return {
    regular: await doc.embedFont(StandardFonts.Helvetica),
    bold: await doc.embedFont(StandardFonts.HelveticaBold),
    italic: await doc.embedFont(StandardFonts.HelveticaOblique),
    boldItalic: await doc.embedFont(StandardFonts.HelveticaBoldOblique),
  };
}

function drawBody(
  page: PDFPage,
  body: TextBody,
  box: { x: number; y: number; width: number; height: number },
  fonts: Record<FontKey, PDFFont>,
): void {
  const layout = layoutTextBody(body, { width: box.width, height: box.height });
  for (const line of layout.lines) {
    for (const segment of line.segments) {
      if (!segment.text) continue;
      const size = segment.style.size ?? 18;
      // Konva centres the fragment inside its box; the PDF baseline sits a bit lower than the middle
      const baseline = box.y + segment.y + segment.height / 2 + size * 0.36;
      page.drawText(segment.text, {
        x: (box.x + segment.x) * PX_TO_PT,
        y: page.getHeight() - baseline * PX_TO_PT,
        size: size * PX_TO_PT,
        font: fonts[keyFor(segment.style)] ?? fonts.regular,
        color: hexToRgb(segment.style.color ?? '#000000'),
      });
    }
  }
}

function drawShape(page: PDFPage, element: ShapeElement, fonts: Record<FontKey, PDFFont>): void {
  const { x, y, width, height } = element;
  if (hasCustomGeometry(element.geom) && element.geom.custGeom) {
    const path = commandsToSvg(
      scaleCommands(element.geom.custGeom, width * PX_TO_PT, height * PX_TO_PT),
    );
    page.drawSvgPath(path, {
      x: x * PX_TO_PT,
      y: page.getHeight() - y * PX_TO_PT,
      ...(element.fill && element.fill.type === 'solid'
        ? { color: hexToRgb(element.fill.color), opacity: element.fill.alpha ?? 1 }
        : {}),
      ...(element.stroke && element.stroke.width > 0
        ? {
            borderColor: hexToRgb(element.stroke.color),
            borderWidth: Math.max(0.2, element.stroke.width * PX_TO_PT),
          }
        : {}),
    });
  } else {
    const geometry = resolvePresetGeometry(element.geom.prst, element.geom.adj);
    if (geometry.kind === 'ellipse') {
      page.drawEllipse({
        x: (x + width / 2) * PX_TO_PT,
        y: page.getHeight() - (y + height / 2) * PX_TO_PT,
        xScale: Math.max(0.05, (width / 2) * PX_TO_PT),
        yScale: Math.max(0.05, (height / 2) * PX_TO_PT),
        ...(element.fill && element.fill.type === 'solid'
          ? { color: hexToRgb(element.fill.color), opacity: element.fill.alpha ?? 1 }
          : {}),
        ...(element.stroke && element.stroke.width > 0
          ? {
              borderColor: hexToRgb(element.stroke.color),
              borderWidth: Math.max(0.2, element.stroke.width * PX_TO_PT),
            }
          : {}),
      });
    } else {
      const radius =
        geometry.kind === 'rect' ? (geometry.radius ?? 0) * Math.min(width, height) : 0;
      drawBox(page, x, y, width, height, element.fill, element.stroke, radius);
    }
  }
  if (element.body && element.body.paragraphs.some((item) => item.runs.length > 0)) {
    drawBody(page, element.body, { x, y, width, height }, fonts);
  }
}

function drawLine(page: PDFPage, element: LineElement): void {
  const [x1, y1, x2, y2] = element.points;
  page.drawLine({
    start: { x: (element.x + x1) * PX_TO_PT, y: page.getHeight() - (element.y + y1) * PX_TO_PT },
    end: { x: (element.x + x2) * PX_TO_PT, y: page.getHeight() - (element.y + y2) * PX_TO_PT },
    thickness: Math.max(0.2, element.stroke.width * PX_TO_PT),
    color: hexToRgb(element.stroke.color),
    opacity: element.stroke.alpha ?? 1,
  });
}

function decodeDataUrl(dataUrl: string): Uint8Array {
  const base64 = dataUrl.split(',')[1] ?? '';
  const binary = atob(base64);
  const bytes = new Uint8Array(binary.length);
  for (let index = 0; index < binary.length; index += 1) bytes[index] = binary.charCodeAt(index);
  return bytes;
}

function drawSlideBackground(page: PDFPage, slide: Slide): void {
  const background = slide.background;
  if (!background) return;
  const fill: Fill | undefined =
    typeof background === 'string' ? { type: 'solid', color: background } : background;
  if (!fill || fill.type !== 'solid') return;
  page.drawRectangle({
    x: 0,
    y: 0,
    width: page.getWidth(),
    height: page.getHeight(),
    color: hexToRgb(fill.color),
    opacity: fill.alpha ?? 1,
  });
}

function drawSlideVector(page: PDFPage, slide: Slide, fonts: Record<FontKey, PDFFont>): void {
  drawSlideBackground(page, slide);
  for (const element of slide.elements) {
    if (element.visible === false) continue;
    if (element.type === 'text') {
      drawBox(
        page,
        element.x,
        element.y,
        element.width,
        element.height,
        element.fill,
        element.stroke,
        element.cornerRadius ?? 0,
      );
      drawBody(page, element.body, element, fonts);
    } else if (element.type === 'shape') {
      drawShape(page, element, fonts);
    } else if (element.type === 'line') {
      drawLine(page, element);
    }
  }
}

/**
 * Export every slide as one PDF page, vector where possible and raster otherwise.
 * Rasterisation goes through the existing export renderer, so a fallback page looks exactly like
 * the bitmap channel.
 */
export async function exportSlidesToVectorPdf(doc: SlideDoc): Promise<ToolResult<VectorPdfResult>> {
  if (doc.slides.length === 0) return { ok: false, error: 'EMPTY' };
  try {
    const out = await PDFDocument.create();
    const fonts = await embedStandardFonts(out);
    let vectorPages = 0;
    let rasterPages = 0;

    for (const slide of doc.slides) {
      const page = out.addPage([doc.width * PX_TO_PT, doc.height * PX_TO_PT]);
      if (slideIsVectorSafe(doc, slide)) {
        drawSlideVector(page, slide, fonts);
        vectorPages += 1;
        continue;
      }
      // Raster fallback: Konva is only pulled in when a page actually needs it
      const { renderSlideToDataUrl } = await import('./raster');
      const dataUrl = renderSlideToDataUrl(doc, slide, Math.round(doc.width * 2));
      if (!dataUrl) return { ok: false, error: 'RENDER_FAILED' };
      const image = await out.embedPng(decodeDataUrl(dataUrl));
      page.drawImage(image, { x: 0, y: 0, width: page.getWidth(), height: page.getHeight() });
      rasterPages += 1;
    }

    return { ok: true, value: { bytes: await out.save(), vectorPages, rasterPages } };
  } catch (error) {
    if (typeof console !== 'undefined') console.error('[slide:vector-pdf]', error);
    return { ok: false, error: 'PROCESS_FAILED' };
  }
}
