import { PDFDocument, StandardFonts, rgb } from '@cantoo/pdf-lib';
import type { ToolResult } from '@/core/types';
import type { SlideDoc } from '../model/types';
import { dataUrlToBytes, renderSlideToDataUrl } from './raster';

/**
 * Print pipeline: paginate slides onto paper, then either
 * - browser printing (HTML of absolutely-positioned images, opened in a new window), or
 * - PDF export (pdf-lib, one page per sheet, images at their layout rect).
 *
 * The layout is a pure function so pages / gutters / repeat behaviour can be unit-tested
 * without a canvas. All geometry is in PDF points (1pt = 1/72in).
 */

export type PaperSize = 'A4' | 'A3' | 'Letter';
export type Orientation = 'portrait' | 'landscape';
export type SlidesPerPage = 1 | 2 | 4 | 6;

export interface PrintOptions {
  paper: PaperSize;
  orientation: Orientation;
  /** Uniform page margin, in points */
  margin: number;
  perPage: SlidesPerPage;
  pageNumbers: boolean;
}

export const PAPER_SIZES: Record<PaperSize, { width: number; height: number }> = {
  A4: { width: 595.28, height: 841.89 },
  A3: { width: 841.89, height: 1190.55 },
  Letter: { width: 612, height: 792 },
};

export const DEFAULT_PRINT_OPTIONS: PrintOptions = {
  paper: 'A4',
  orientation: 'landscape',
  margin: 36,
  perPage: 1,
  pageNumbers: false,
};

/** Gap between neighbouring slides on the same sheet */
const GUTTER = 12;

export interface PrintSlot {
  slideIndex: number;
  /** Top-left corner and size inside the page, in points */
  x: number;
  y: number;
  width: number;
  height: number;
}

export interface PrintPageLayout {
  index: number;
  width: number;
  height: number;
  slots: PrintSlot[];
}

/** Sheet size after applying the orientation */
export function resolvePageSize(options: PrintOptions): { width: number; height: number } {
  const base = PAPER_SIZES[options.paper];
  return options.orientation === 'landscape'
    ? { width: base.height, height: base.width }
    : { width: base.width, height: base.height };
}

function gridFor(perPage: SlidesPerPage, landscape: boolean): { cols: number; rows: number } {
  switch (perPage) {
    case 1:
      return { cols: 1, rows: 1 };
    case 2:
      return landscape ? { cols: 2, rows: 1 } : { cols: 1, rows: 2 };
    case 4:
      return { cols: 2, rows: 2 };
    case 6:
      return landscape ? { cols: 3, rows: 2 } : { cols: 2, rows: 3 };
  }
}

/**
 * Paginate slides onto sheets.
 * `aspect` is the slide width/height ratio (default 16:9); each slide keeps that ratio inside its cell.
 */
export function buildPrintPages(
  slideCount: number,
  options: PrintOptions,
  aspect = 16 / 9,
): PrintPageLayout[] {
  if (slideCount <= 0) return [];
  const size = resolvePageSize(options);
  const landscape = options.orientation === 'landscape';
  const { cols, rows } = gridFor(options.perPage, landscape);

  const innerWidth = size.width - options.margin * 2;
  const innerHeight = size.height - options.margin * 2;
  const cellWidth = (innerWidth - GUTTER * (cols - 1)) / cols;
  const cellHeight = (innerHeight - GUTTER * (rows - 1)) / rows;

  // Fit the slide inside the cell, preserving the document ratio
  const fitWidth = Math.min(cellWidth, cellHeight * aspect);
  const fitHeight = fitWidth / aspect;

  const pages: PrintPageLayout[] = [];
  for (let start = 0; start < slideCount; start += options.perPage) {
    const slots: PrintSlot[] = [];
    for (let offset = 0; offset < options.perPage && start + offset < slideCount; offset += 1) {
      const col = offset % cols;
      const row = Math.floor(offset / cols);
      slots.push({
        slideIndex: start + offset,
        x: options.margin + col * (cellWidth + GUTTER) + (cellWidth - fitWidth) / 2,
        y: options.margin + row * (cellHeight + GUTTER) + (cellHeight - fitHeight) / 2,
        width: fitWidth,
        height: fitHeight,
      });
    }
    pages.push({ index: pages.length + 1, width: size.width, height: size.height, slots });
  }
  return pages;
}

/** Rasterize one slide per distinct index used by the layout (smallest possible render set) */
function renderSlideImages(doc: SlideDoc, pages: PrintPageLayout[]): Map<number, string> {
  const images = new Map<number, string>();
  for (const page of pages) {
    for (const slot of page.slots) {
      if (images.has(slot.slideIndex)) continue;
      const slide = doc.slides[slot.slideIndex];
      if (!slide) continue;
      const dataUrl = renderSlideToDataUrl(doc, slide, Math.round(slot.width * 3));
      if (dataUrl) images.set(slot.slideIndex, dataUrl);
    }
  }
  return images;
}

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

/** Printable HTML: one .print-page per sheet, slides as absolutely positioned images */
export function buildPrintHtml(
  pages: PrintPageLayout[],
  images: Map<number, string>,
  options: PrintOptions,
  title = 'presentation',
): string {
  const size = resolvePageSize(options);
  const body = pages
    .map((page) => {
      const cells = page.slots
        .map((slot) => {
          const src = images.get(slot.slideIndex);
          if (!src) return '';
          return `<img src="${src}" style="left:${slot.x.toFixed(2)}pt;top:${slot.y.toFixed(
            2,
          )}pt;width:${slot.width.toFixed(2)}pt;height:${slot.height.toFixed(2)}pt" alt="">`;
        })
        .join('');
      const number = options.pageNumbers
        ? `<div class="num">${page.index} / ${pages.length}</div>`
        : '';
      return `<section class="print-page">${cells}${number}</section>`;
    })
    .join('');
  return `<!doctype html><html><head><meta charset="utf-8"><title>${escapeHtml(
    title,
  )}</title><style>
@page { size: ${size.width}pt ${size.height}pt; margin: 0 }
html, body { margin: 0; padding: 0; background: #fff }
.print-page { position: relative; width: ${size.width}pt; height: ${
    size.height
  }pt; overflow: hidden; page-break-after: always; break-after: page }
.print-page:last-child { page-break-after: auto; break-after: auto }
.print-page img { position: absolute }
.print-page .num { position: absolute; left: 0; bottom: 6pt; width: 100%; text-align: center;
  font: 9pt/1.2 system-ui, sans-serif; color: #666 }
</style></head><body>${body}</body></html>`;
}

/** Paste each slide bitmap onto its sheet and export a PDF */
export async function exportPrintPdf(
  doc: SlideDoc,
  options: PrintOptions = DEFAULT_PRINT_OPTIONS,
): Promise<ToolResult<Uint8Array>> {
  if (doc.slides.length === 0) return { ok: false, error: 'EMPTY' };
  const pages = buildPrintPages(doc.slides.length, options, doc.width / doc.height);
  const images = renderSlideImages(doc, pages);
  if (images.size === 0) return { ok: false, error: 'RENDER_FAILED' };

  try {
    const out = await PDFDocument.create();
    const font = options.pageNumbers ? await out.embedFont(StandardFonts.Helvetica) : null;
    for (const page of pages) {
      const sheet = out.addPage([page.width, page.height]);
      for (const slot of page.slots) {
        const src = images.get(slot.slideIndex);
        if (!src) continue;
        const embedded = await out.embedPng(dataUrlToBytes(src));
        sheet.drawImage(embedded, {
          x: slot.x,
          // PDF origin is bottom-left, the layout uses top-left
          y: page.height - slot.y - slot.height,
          width: slot.width,
          height: slot.height,
        });
      }
      if (font) {
        const label = `${page.index} / ${pages.length}`;
        const width = font.widthOfTextAtSize(label, 9);
        sheet.drawText(label, {
          x: (page.width - width) / 2,
          y: 18,
          size: 9,
          font,
          color: rgb(0.4, 0.4, 0.4),
        });
      }
    }
    return { ok: true, value: await out.save() };
  } catch {
    return { ok: false, error: 'PROCESS_FAILED' };
  }
}

/**
 * Browser printing: opens a window synchronously (keeps the user gesture), then fills it
 * with the printable HTML and calls print() after the images decode.
 * Returns PRINT_BLOCKED when the popup was denied — callers should fall back to PDF export.
 */
export async function printSlides(
  doc: SlideDoc,
  options: PrintOptions = DEFAULT_PRINT_OPTIONS,
): Promise<ToolResult<{ pages: number }>> {
  if (doc.slides.length === 0) return { ok: false, error: 'EMPTY' };
  if (typeof window === 'undefined') return { ok: false, error: 'PRINT_UNSUPPORTED' };

  const win = window.open('', '_blank');
  if (!win) return { ok: false, error: 'PRINT_BLOCKED' };

  const pages = buildPrintPages(doc.slides.length, options, doc.width / doc.height);
  const images = renderSlideImages(doc, pages);
  if (images.size === 0) {
    win.close();
    return { ok: false, error: 'RENDER_FAILED' };
  }

  win.document.open();
  win.document.write(buildPrintHtml(pages, images, options, doc.name || 'presentation'));
  win.document.close();

  // Print once the bitmaps are decoded; a 50ms settle keeps Safari from printing a blank sheet
  await Promise.all(
    Array.from(win.document.images).map(
      (img) =>
        new Promise<void>((resolve) => {
          if (img.complete) {
            resolve();
            return;
          }
          img.addEventListener('load', () => resolve(), { once: true });
          img.addEventListener('error', () => resolve(), { once: true });
        }),
    ),
  );
  await new Promise<void>((resolve) => {
    window.setTimeout(resolve, 50);
  });
  win.focus();
  win.print();
  return { ok: true, value: { pages: pages.length } };
}
