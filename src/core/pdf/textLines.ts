/**
 * Text-line clustering shared by the PDF editor's text layer (M3-1) and the PDF → docx
 * structuring pass (M4-2).
 *
 * Why a shared module: both features need "which glyphs form one visual line", and the answer has to
 * be identical — otherwise patching a line covers a different band than the one exported to Word.
 *
 * Coordinates: pdfjs returns `transform` in PDF user space (origin bottom-left, y up). The editor and
 * the docx builder both want *visual* space (origin top-left, y down, page rotation applied), so the
 * caller passes the `viewport.transform`/size that pdfjs computed for `scale: 1`; without it the
 * unrotated PDF space is converted by flipping y.
 *
 * Pure except `getPageTextLines`, which is a thin pdfjs wrapper (type-only import, no runtime cost).
 */

import type { PDFDocumentProxy } from 'pdfjs-dist';

/** Subset of pdfjs `TextItem` we rely on; `TextMarkedContent` items are filtered out */
export interface TextItemLike {
  str: string;
  /** `[a, b, c, d, e, f]` text matrix in PDF user space */
  transform: number[];
  /** Advance width in text-space units (PDF points at scale 1) */
  width: number;
  /** Em height in text-space units */
  height: number;
  fontName?: string;
  hasEOL?: boolean;
}

/** Normalized rectangle relative to the visual page, origin top-left, 0–1 */
export interface TextLineRect {
  x: number;
  y: number;
  w: number;
  h: number;
}

export interface TextLine {
  /** 1-based page number inside the source file (0 for synthetic input) */
  page: number;
  /** Line text, spaces restored from the horizontal gaps between items */
  text: string;
  rect: TextLineRect;
  /** Font size in PDF points */
  fontSize: number;
  items: TextItemLike[];
}

export interface TextPageGeometry {
  /** Visual page width in points (after /Rotate) */
  width: number;
  /** Visual page height in points (after /Rotate) */
  height: number;
  /** `page.getViewport({ scale: 1 }).transform`; omit for unrotated PDF space */
  transform?: readonly number[] | number[];
}

/** Same semantics as pdfjs `Util.transform`: apply `m2` first, then `m1` */
export function multiplyTransform(m1: readonly number[], m2: readonly number[]): number[] {
  return [
    m1[0] * m2[0] + m1[2] * m2[1],
    m1[1] * m2[0] + m1[3] * m2[1],
    m1[0] * m2[2] + m1[2] * m2[3],
    m1[1] * m2[2] + m1[3] * m2[3],
    m1[0] * m2[4] + m1[2] * m2[5] + m1[4],
    m1[1] * m2[4] + m1[3] * m2[5] + m1[5],
  ];
}

/** Vertical distance between the line box top and the baseline, in font sizes */
const ASCENT = 0.85;
/** Vertical distance between the baseline and the line box bottom, in font sizes */
const DESCENT = 0.25;
/** Rows closer than this (in font sizes) belong to the same line */
const ROW_TOLERANCE = 0.5;
/** Horizontal gaps wider than this (in font sizes) become a space */
const SPACE_GAP = 0.22;

interface PlacedItem {
  item: TextItemLike;
  x: number;
  baseline: number;
  size: number;
  endX: number;
  str: string;
}

function clamp01(value: number): number {
  return Math.min(1, Math.max(0, value));
}

/**
 * One entry per visual text row, ordered top → bottom then left → right.
 *
 * Items whose `str` is empty (pdfjs emits marked-content markers in the same array) are ignored, and
 * rows with no visible glyphs are dropped so a text layer never renders invisible hit targets.
 */
export function groupTextItems(
  items: readonly TextItemLike[],
  geometry: TextPageGeometry,
  pageNumber = 0,
): TextLine[] {
  if (geometry.width <= 0 || geometry.height <= 0) return [];

  const placed: PlacedItem[] = [];
  for (const item of items) {
    if (typeof item.str !== 'string' || item.str.length === 0) continue;
    if (!item.transform || item.transform.length < 6) continue;
    if (item.transform.some((value) => !Number.isFinite(value))) continue;

    const raw = item.transform;
    const matrix = geometry.transform
      ? multiplyTransform(geometry.transform, raw)
      : [raw[0], raw[1], raw[2], raw[3], raw[4], geometry.height - raw[5]];

    const scaleX = Math.hypot(matrix[0], matrix[1]);
    const rawScaleX = Math.hypot(raw[0], raw[1]);
    const ratio = rawScaleX > 0 ? scaleX / rawScaleX : 1;
    // Vertical text (90°) has a zero x axis; fall back to the y axis for its em size
    const size = scaleX > 0 ? scaleX : Math.hypot(matrix[2], matrix[3]);
    if (!Number.isFinite(size) || size <= 0) continue;

    const width = Math.max(0, (Number.isFinite(item.width) ? item.width : 0) * ratio);
    placed.push({
      item,
      x: matrix[4],
      baseline: matrix[5],
      size,
      endX: matrix[4] + width,
      str: item.str,
    });
  }

  if (placed.length === 0) return [];
  placed.sort((a, b) => a.baseline - b.baseline || a.x - b.x);

  const rows: PlacedItem[][] = [];
  for (const entry of placed) {
    const row = rows[rows.length - 1];
    if (!row) {
      rows.push([entry]);
      continue;
    }
    const rowBaseline = row[row.length - 1].baseline;
    const tolerance = ROW_TOLERANCE * Math.max(entry.size, row[0].size);
    if (Math.abs(entry.baseline - rowBaseline) <= tolerance) row.push(entry);
    else rows.push([entry]);
  }

  const lines: TextLine[] = [];
  for (const row of rows) {
    row.sort((a, b) => a.x - b.x);

    let text = '';
    let previousEnd: number | null = null;
    for (const entry of row) {
      if (previousEnd !== null && entry.x - previousEnd > SPACE_GAP * entry.size) text += ' ';
      text += entry.str;
      previousEnd = previousEnd === null ? entry.endX : Math.max(previousEnd, entry.endX);
    }
    text = text.replace(/\s+/g, ' ').trim();
    if (!text) continue;

    const left = Math.min(...row.map((entry) => entry.x));
    const right = Math.max(...row.map((entry) => entry.endX));
    const fontSize = Math.max(...row.map((entry) => entry.size));
    const top = Math.min(...row.map((entry) => entry.baseline - ASCENT * entry.size));
    const bottom = Math.max(...row.map((entry) => entry.baseline + DESCENT * entry.size));

    const x = clamp01(left / geometry.width);
    const y = clamp01(top / geometry.height);
    const w = clamp01((right - left) / geometry.width);
    const h = clamp01((bottom - top) / geometry.height);
    if (w <= 0 || h <= 0) continue;

    lines.push({
      page: pageNumber,
      text,
      rect: { x, y, w: Math.min(w, 1 - x), h: Math.min(h, 1 - y) },
      fontSize,
      items: row.map((entry) => entry.item),
    });
  }

  return lines;
}

/** Line under a page-normalized point, used by the text-patch tool */
export function textLineAt(
  lines: readonly TextLine[],
  point: { x: number; y: number },
): TextLine | null {
  // Later lines paint on top when boxes overlap (a superscript inside a heading, for example)
  for (let index = lines.length - 1; index >= 0; index -= 1) {
    const { rect } = lines[index];
    if (
      point.x >= rect.x &&
      point.x <= rect.x + rect.w &&
      point.y >= rect.y &&
      point.y <= rect.y + rect.h
    ) {
      return lines[index];
    }
  }
  return null;
}

/** Read the text layer of one pdfjs page through the pure clusterer */
export async function getPageTextLines(
  pdfDoc: PDFDocumentProxy,
  pageNumber1Based: number,
): Promise<TextLine[]> {
  const page = await pdfDoc.getPage(pageNumber1Based);
  const viewport = page.getViewport({ scale: 1 });
  const content = await page.getTextContent();
  // `items` mixes real text with marked-content markers, so copy only the fields we rely on
  const items = (content.items as unknown[]).flatMap((entry) => {
    const candidate = entry as Partial<TextItemLike>;
    if (
      typeof candidate.str !== 'string' ||
      !Array.isArray(candidate.transform) ||
      typeof candidate.width !== 'number' ||
      typeof candidate.height !== 'number'
    ) {
      return [];
    }
    return [
      {
        str: candidate.str,
        transform: candidate.transform,
        width: candidate.width,
        height: candidate.height,
        fontName: candidate.fontName,
        hasEOL: candidate.hasEOL,
      },
    ];
  });
  return groupTextItems(
    items,
    { width: viewport.width, height: viewport.height, transform: viewport.transform },
    pageNumber1Based,
  );
}
