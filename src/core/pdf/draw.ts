import {
  PDFDocument,
  StandardFonts,
  rgb,
  type PDFPage,
  type PDFFont,
  type RGB,
} from '@cantoo/pdf-lib';
import type { ToolResult } from '@/core/types';

export type PageNumberPosition = 'bottom-center' | 'bottom-right' | 'bottom-left' | 'top-center';

export type HAlign = 'left' | 'center' | 'right';

function parseColor(hex: string): RGB {
  const h = hex.replace('#', '');
  const n = parseInt(h.length === 3 ? h.split('').map((c) => c + c).join('') : h, 16);
  if (Number.isNaN(n)) return rgb(0.2, 0.2, 0.2);
  return rgb(((n >> 16) & 255) / 255, ((n >> 8) & 255) / 255, (n & 255) / 255);
}

function placeText(
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
  const { width, height } = page.getSize();
  const textWidth = font.widthOfTextAtSize(text, opts.size);
  const margin = opts.margin;
  let x = margin;
  const align = opts.align ?? 'center';
  if (align === 'center') x = (width - textWidth) / 2;
  else if (align === 'right') x = width - margin - textWidth;

  let y = margin;
  if (opts.position === 'top-center' || opts.position === 'header') {
    y = height - margin - opts.size;
  } else if (opts.position === 'bottom-center' || opts.position === 'footer' || opts.position.startsWith('bottom')) {
    y = margin;
  }
  if (opts.position === 'bottom-left') x = margin;
  if (opts.position === 'bottom-right') x = width - margin - textWidth;
  if (opts.position === 'bottom-center' || opts.position === 'top-center') x = (width - textWidth) / 2;

  page.drawText(text, {
    x,
    y,
    size: opts.size,
    font,
    color: opts.color,
  });
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
    doc.getPages().forEach((page, i) => {
      const n = startFrom + i;
      const text = format.replace(/\{n\}/g, String(n)).replace(/\{total\}/g, String(total));
      placeText(page, font, text, { position, size, color, margin });
    });
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
        placeText(page, font, opts.header.trim(), {
          position: 'header',
          align,
          size,
          color,
          margin,
        });
      }
      if (opts.footer?.trim()) {
        placeText(page, font, opts.footer.trim(), {
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
      const { height } = page.getSize();
      page.drawText(text, {
        x: opts.x ?? 48,
        y: opts.y ?? height - 64,
        size,
        font,
        color,
      });
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
      const { height: ph } = page.getSize();
      page.drawImage(image, {
        x: opts.x ?? 48,
        y: opts.y ?? ph - h - 48,
        width: w,
        height: h,
        opacity: opts.opacity ?? 1,
      });
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

export type AnnotateKind = 'highlight' | 'line' | 'rect';

export async function annotatePages(
  doc: PDFDocument,
  annotations: Array<{
    kind: AnnotateKind;
    pageIndex: number;
    x: number;
    y: number;
    width: number;
    height: number;
    color?: string;
    opacity?: number;
  }>,
): Promise<ToolResult<Uint8Array>> {
  if (annotations.length === 0) return { ok: false, error: 'EMPTY' };
  try {
    const pages = doc.getPages();
    for (const a of annotations) {
      if (a.pageIndex < 0 || a.pageIndex >= pages.length) continue;
      const page = pages[a.pageIndex];
      const color = parseColor(a.color ?? (a.kind === 'highlight' ? '#facc15' : '#ef4444'));
      const opacity = a.opacity ?? (a.kind === 'highlight' ? 0.35 : 0.9);
      if (a.kind === 'line') {
        page.drawLine({
          start: { x: a.x, y: a.y },
          end: { x: a.x + a.width, y: a.y + a.height },
          thickness: 2,
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
          borderWidth: 2,
          opacity,
        });
      }
    }
    return { ok: true, value: await doc.save() };
  } catch {
    return { ok: false, error: 'PROCESS_FAILED' };
  }
}
