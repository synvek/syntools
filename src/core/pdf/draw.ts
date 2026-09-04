import {
  PDFDocument,
  StandardFonts,
  rgb,
  pushGraphicsState,
  popGraphicsState,
  rotateDegrees,
  translate,
  type PDFPage,
  type PDFFont,
  type RGB,
} from '@cantoo/pdf-lib';
import type { ToolResult } from '@/core/types';
import { embedRasterizedText, needsUnicodeFont } from './text';

export type PageNumberPosition = 'bottom-center' | 'bottom-right' | 'bottom-left' | 'top-center';

export type HAlign = 'left' | 'center' | 'right';

function parseColor(hex: string): RGB {
  const h = hex.replace('#', '');
  const n = parseInt(h.length === 3 ? h.split('').map((c) => c + c).join('') : h, 16);
  if (Number.isNaN(n)) return rgb(0.2, 0.2, 0.2);
  return rgb(((n >> 16) & 255) / 255, ((n >> 8) & 255) / 255, (n & 255) / 255);
}

/** Normalize page /Rotate to 0 | 90 | 180 | 270 (PDF: clockwise when viewing). */
export function normalizePageRotation(angle: number): 0 | 90 | 180 | 270 {
  const a = ((Math.round(angle) % 360) + 360) % 360;
  if (a === 90 || a === 180 || a === 270) return a;
  return 0;
}

/** Size as the viewer sees it after /Rotate. */
export function getVisualPageSize(page: PDFPage): { width: number; height: number } {
  const { width, height } = page.getSize();
  const rot = normalizePageRotation(page.getRotation().angle);
  if (rot === 90 || rot === 270) return { width: height, height: width };
  return { width, height };
}

/**
 * Remap the CTM so subsequent draws use *visual* coordinates
 * (origin = displayed bottom-left, +x right, +y up), cancelling /Rotate.
 * Must be paired with `endVisualDraw`.
 *
 * @see https://github.com/Hopding/pdf-lib/issues/147
 */
function beginVisualDraw(page: PDFPage): void {
  const rot = normalizePageRotation(page.getRotation().angle);
  if (rot === 0) return;
  const { width, height } = getVisualPageSize(page);
  page.pushOperators(pushGraphicsState());
  if (rot === 90) {
    page.pushOperators(rotateDegrees(90), translate(0, -height));
  } else if (rot === 180) {
    page.pushOperators(rotateDegrees(180), translate(-width, -height));
  } else {
    page.pushOperators(rotateDegrees(270), translate(-width, 0));
  }
}

function endVisualDraw(page: PDFPage): void {
  const rot = normalizePageRotation(page.getRotation().angle);
  if (rot === 0) return;
  page.pushOperators(popGraphicsState());
}

function resolveTextBox(
  page: PDFPage,
  textWidth: number,
  textHeight: number,
  opts: {
    position: PageNumberPosition | 'header' | 'footer';
    align?: HAlign;
    size: number;
    margin: number;
  },
): { x: number; y: number } {
  const { width, height } = getVisualPageSize(page);
  const margin = opts.margin;
  let x = margin;
  const align = opts.align ?? 'center';
  if (align === 'center') x = (width - textWidth) / 2;
  else if (align === 'right') x = width - margin - textWidth;

  let y = margin;
  if (opts.position === 'top-center' || opts.position === 'header') {
    y = height - margin - textHeight;
  } else if (
    opts.position === 'bottom-center' ||
    opts.position === 'footer' ||
    opts.position.startsWith('bottom')
  ) {
    y = margin;
  }
  if (opts.position === 'bottom-left') x = margin;
  if (opts.position === 'bottom-right') x = width - margin - textWidth;
  if (opts.position === 'bottom-center' || opts.position === 'top-center') {
    x = (width - textWidth) / 2;
  }
  return { x, y };
}

async function placeText(
  doc: PDFDocument,
  page: PDFPage,
  font: PDFFont,
  text: string,
  opts: {
    position: PageNumberPosition | 'header' | 'footer';
    align?: HAlign;
    size: number;
    color: RGB;
    margin: number;
  },
) {
  beginVisualDraw(page);
  try {
    if (needsUnicodeFont(text)) {
      const raster = await embedRasterizedText(doc, text, opts.size, opts.color);
      const { x, y } = resolveTextBox(page, raster.width, raster.height, opts);
      page.drawImage(raster.image, {
        x,
        y,
        width: raster.width,
        height: raster.height,
      });
      return;
    }

    const textWidth = font.widthOfTextAtSize(text, opts.size);
    const { x, y } = resolveTextBox(page, textWidth, opts.size, opts);
    page.drawText(text, {
      x,
      y,
      size: opts.size,
      font,
      color: opts.color,
    });
  } finally {
    endVisualDraw(page);
  }
}

export async function addPageNumbers(
  doc: PDFDocument,
  opts: {
    format?: string; // use {n} {total}
    position?: PageNumberPosition;
    fontSize?: number;
    color?: string;
    margin?: number;
    startFrom?: number;
  } = {},
): Promise<ToolResult<Uint8Array>> {
  try {
    const font = await doc.embedFont(StandardFonts.Helvetica);
    const total = doc.getPageCount();
    const format = opts.format ?? '{n} / {total}';
    const position = opts.position ?? 'bottom-center';
    const size = opts.fontSize ?? 10;
    const color = parseColor(opts.color ?? '#333333');
    const margin = opts.margin ?? 24;
    const startFrom = opts.startFrom ?? 1;
    const pages = doc.getPages();
    for (let i = 0; i < pages.length; i++) {
      const n = startFrom + i;
      const text = format.replace(/\{n\}/g, String(n)).replace(/\{total\}/g, String(total));
      await placeText(doc, pages[i], font, text, { position, size, color, margin });
    }
    return { ok: true, value: await doc.save() };
  } catch {
    return { ok: false, error: 'PROCESS_FAILED' };
  }
}

export async function addHeaderFooter(
  doc: PDFDocument,
  opts: {
    header?: string;
    footer?: string;
    fontSize?: number;
    color?: string;
    margin?: number;
    align?: HAlign;
  },
): Promise<ToolResult<Uint8Array>> {
  try {
    const font = await doc.embedFont(StandardFonts.Helvetica);
    const size = opts.fontSize ?? 10;
    const color = parseColor(opts.color ?? '#444444');
    const margin = opts.margin ?? 28;
    const align = opts.align ?? 'center';
    for (const page of doc.getPages()) {
      if (opts.header?.trim()) {
        await placeText(doc, page, font, opts.header.trim(), {
          position: 'header',
          align,
          size,
          color,
          margin,
        });
      }
      if (opts.footer?.trim()) {
        await placeText(doc, page, font, opts.footer.trim(), {
          position: 'footer',
          align,
          size,
          color,
          margin,
        });
      }
    }
    return { ok: true, value: await doc.save() };
  } catch {
    return { ok: false, error: 'PROCESS_FAILED' };
  }
}

export async function addTextToPages(
  doc: PDFDocument,
  opts: {
    text: string;
    pageIndices?: number[];
    x?: number;
    y?: number;
    fontSize?: number;
    color?: string;
  },
): Promise<ToolResult<Uint8Array>> {
  const text = opts.text.trim();
  if (!text) return { ok: false, error: 'EMPTY' };
  try {
    const font = await doc.embedFont(StandardFonts.Helvetica);
    const size = opts.fontSize ?? 14;
    const color = parseColor(opts.color ?? '#111111');
    const pages = doc.getPages();
    const indices =
      opts.pageIndices && opts.pageIndices.length > 0
        ? opts.pageIndices
        : pages.map((_, i) => i);
    for (const i of indices) {
      if (i < 0 || i >= pages.length) continue;
      const page = pages[i];
      const { height } = getVisualPageSize(page);
      const x = opts.x ?? 48;
      const y = opts.y ?? height - 64;
      beginVisualDraw(page);
      try {
        if (needsUnicodeFont(text)) {
          const raster = await embedRasterizedText(doc, text, size, color);
          page.drawImage(raster.image, {
            x,
            y: y - (raster.height - size),
            width: raster.width,
            height: raster.height,
          });
        } else {
          page.drawText(text, {
            x,
            y,
            size,
            font,
            color,
          });
        }
      } finally {
        endVisualDraw(page);
      }
    }
    return { ok: true, value: await doc.save() };
  } catch {
    return { ok: false, error: 'PROCESS_FAILED' };
  }
}

export async function embedImageOnPages(
  doc: PDFDocument,
  imageBytes: Uint8Array,
  opts: {
    mime: string;
    pageIndices?: number[];
    x?: number;
    y?: number;
    width?: number;
    height?: number;
    opacity?: number;
  },
): Promise<ToolResult<Uint8Array>> {
  try {
    const isPng = opts.mime.includes('png');
    const image = isPng ? await doc.embedPng(imageBytes) : await doc.embedJpg(imageBytes);
    const pages = doc.getPages();
    const indices =
      opts.pageIndices && opts.pageIndices.length > 0
        ? opts.pageIndices
        : pages.map((_, i) => i);
    const w = opts.width ?? Math.min(160, image.width);
    const h = opts.height ?? (w * image.height) / image.width;
    for (const i of indices) {
      if (i < 0 || i >= pages.length) continue;
      const page = pages[i];
      const { height: ph } = getVisualPageSize(page);
      beginVisualDraw(page);
      try {
        page.drawImage(image, {
          x: opts.x ?? 48,
          y: opts.y ?? ph - h - 48,
          width: w,
          height: h,
          opacity: opts.opacity ?? 1,
        });
      } finally {
        endVisualDraw(page);
      }
    }
    return { ok: true, value: await doc.save() };
  } catch {
    return { ok: false, error: 'PROCESS_FAILED' };
  }
}

export async function setPdfMetadata(
  doc: PDFDocument,
  meta: {
    title?: string;
    author?: string;
    subject?: string;
    keywords?: string[];
    creator?: string;
    producer?: string;
  },
): Promise<ToolResult<Uint8Array>> {
  try {
    if (meta.title !== undefined) doc.setTitle(meta.title);
    if (meta.author !== undefined) doc.setAuthor(meta.author);
    if (meta.subject !== undefined) doc.setSubject(meta.subject);
    if (meta.keywords !== undefined) doc.setKeywords(meta.keywords);
    if (meta.creator !== undefined) doc.setCreator(meta.creator);
    if (meta.producer !== undefined) doc.setProducer(meta.producer);
    doc.setModificationDate(new Date());
    return { ok: true, value: await doc.save() };
  } catch {
    return { ok: false, error: 'PROCESS_FAILED' };
  }
}

export async function cropPages(
  doc: PDFDocument,
  margins: { top: number; right: number; bottom: number; left: number },
  pageIndices?: number[],
): Promise<ToolResult<Uint8Array>> {
  try {
    const pages = doc.getPages();
    const indices =
      pageIndices && pageIndices.length > 0 ? pageIndices : pages.map((_, i) => i);
    for (const i of indices) {
      if (i < 0 || i >= pages.length) continue;
      const page = pages[i];
      const { width, height } = page.getSize();
      const left = Math.max(0, margins.left);
      const bottom = Math.max(0, margins.bottom);
      const right = Math.max(0, margins.right);
      const top = Math.max(0, margins.top);
      const newW = width - left - right;
      const newH = height - top - bottom;
      if (newW <= 10 || newH <= 10) return { ok: false, error: 'INVALID_RANGE' };
      page.setCropBox(left, bottom, newW, newH);
      page.setMediaBox(left, bottom, newW, newH);
    }
    return { ok: true, value: await doc.save() };
  } catch {
    return { ok: false, error: 'PROCESS_FAILED' };
  }
}

export type AnnotateKind =
  | 'highlight'
  | 'line'
  | 'rect'
  | 'ellipse'
  | 'circle'
  | 'pen'
  | 'text';

export type PdfAnnotation =
  | {
      kind: 'highlight' | 'rect';
      pageIndex: number;
      x: number;
      y: number;
      width: number;
      height: number;
      color?: string;
      opacity?: number;
      borderWidth?: number;
    }
  | {
      kind: 'line';
      pageIndex: number;
      x: number;
      y: number;
      width: number; // dx
      height: number; // dy
      color?: string;
      opacity?: number;
      borderWidth?: number;
    }
  | {
      kind: 'ellipse' | 'circle';
      pageIndex: number;
      x: number; // center x
      y: number; // center y
      width: number; // radiusX (*2 stored as diameter for circle consistency: use as xScale)
      height: number; // radiusY
      color?: string;
      opacity?: number;
      borderWidth?: number;
      filled?: boolean;
    }
  | {
      kind: 'pen';
      pageIndex: number;
      points: Array<{ x: number; y: number }>;
      color?: string;
      opacity?: number;
      borderWidth?: number;
    }
  | {
      kind: 'text';
      pageIndex: number;
      x: number;
      y: number;
      text: string;
      fontSize?: number;
      color?: string;
      opacity?: number;
    };

export async function annotatePages(
  doc: PDFDocument,
  annotations: PdfAnnotation[],
): Promise<ToolResult<Uint8Array>> {
  if (annotations.length === 0) return { ok: false, error: 'EMPTY' };
  try {
    const pages = doc.getPages();
    for (const a of annotations) {
      if (a.pageIndex < 0 || a.pageIndex >= pages.length) continue;
      const page = pages[a.pageIndex];
      beginVisualDraw(page);
      try {
        if (a.kind === 'pen') {
          const color = parseColor(a.color ?? '#ef4444');
          const thickness = a.borderWidth ?? 2;
          const opacity = a.opacity ?? 0.95;
          const pts = a.points;
          for (let i = 1; i < pts.length; i++) {
            page.drawLine({
              start: pts[i - 1],
              end: pts[i],
              thickness,
              color,
              opacity,
            });
          }
          continue;
        }

        if (a.kind === 'text') {
          const text = a.text.trim();
          if (!text) continue;
          const size = a.fontSize ?? 14;
          const color = parseColor(a.color ?? '#111111');
          if (needsUnicodeFont(text)) {
            const raster = await embedRasterizedText(doc, text, size, color);
            page.drawImage(raster.image, {
              x: a.x,
              y: a.y,
              width: raster.width,
              height: raster.height,
              opacity: a.opacity ?? 1,
            });
          } else {
            const font = await doc.embedFont(StandardFonts.Helvetica);
            page.drawText(text, {
              x: a.x,
              y: a.y,
              size,
              font,
              color,
              opacity: a.opacity ?? 1,
            });
          }
          continue;
        }

        if (a.kind === 'ellipse' || a.kind === 'circle') {
          const color = parseColor(a.color ?? '#3b82f6');
          const opacity = a.opacity ?? 0.9;
          const xScale = Math.abs(a.width);
          const yScale = a.kind === 'circle' ? xScale : Math.abs(a.height);
          page.drawEllipse({
            x: a.x,
            y: a.y,
            xScale,
            yScale,
            borderColor: color,
            borderWidth: a.borderWidth ?? 2,
            borderOpacity: opacity,
            color: a.filled ? color : undefined,
            opacity: a.filled ? Math.min(opacity, 0.35) : 0,
          });
          continue;
        }

        const color = parseColor(a.color ?? (a.kind === 'highlight' ? '#facc15' : '#ef4444'));
        const opacity = a.opacity ?? (a.kind === 'highlight' ? 0.35 : 0.9);
        if (a.kind === 'line') {
          page.drawLine({
            start: { x: a.x, y: a.y },
            end: { x: a.x + a.width, y: a.y + a.height },
            thickness: a.borderWidth ?? 2,
            color,
            opacity,
          });
        } else if (a.kind === 'highlight') {
          page.drawRectangle({
            x: a.x,
            y: a.y,
            width: a.width,
            height: a.height,
            color,
            opacity,
            borderWidth: 0,
          });
        } else {
          page.drawRectangle({
            x: a.x,
            y: a.y,
            width: a.width,
            height: a.height,
            borderColor: color,
            borderWidth: a.borderWidth ?? 2,
            opacity,
          });
        }
      } finally {
        endVisualDraw(page);
      }
    }
    return { ok: true, value: await doc.save() };
  } catch {
    return { ok: false, error: 'PROCESS_FAILED' };
  }
}
