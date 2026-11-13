import { XMLParser } from 'fast-xml-parser';
import { emuToPx } from '../../core/drawing/geometry';
import {
  attr,
  childOf,
  childrenOf,
  localNameOf,
  numAttr,
  textOf,
  type XmlNode,
} from '../../core/drawing/xmlNode';
import { normalizeImageLayer, type ImageLayer } from './imageLayer';

/**
 * Images ← `w:drawing` dimensions, wrap mode and anchor position (import side).
 *
 * mammoth keeps every image but only as `<img src="data:…">`: `wp:extent` (the size Word actually
 * shows), the anchor's wrap mode and its position are dropped. A 1600px screenshot that Word paints at
 * 442px therefore lands at 1600px, which is the "picture is far too big / in the wrong place" symptom.
 *
 * The fix mirrors the pagination pass: read the boxes straight from `word/document.xml` and stamp
 * them onto mammoth's `<img>` elements **in document order**, only when the two counts agree.
 *
 * Wrap modes:
 * - `wp:inline`              → inline
 * - `wrapSquare`             → wrap-left / wrap-right (from `wrapText`; both sides falls back to the offset)
 * - `wrapTopAndBottom`       → top-bottom
 * - `behindDoc`              → behind (out of the text flow, painted under the text)
 * - `wrapNone`               → front (out of the text flow, painted over the text)
 *
 * The two absolute layers keep Word's `wp:positionH/V` when their `relativeFrom` can be resolved
 * without a layout (`page` → shifted by the page margin, `margin` / `column` → already text-area
 * relative, plus the named alignments). `paragraph` / `line` / `character` depend on where the
 * paragraph ended up, which only Word's layout engine knows: those degrade to top-bottom instead of
 * guessing an offset that would hide the picture or cover the text.
 */

const parser = new XMLParser({
  ignoreAttributes: false,
  removeNSPrefix: false,
  preserveOrder: true,
  attributeNamePrefix: '@_',
  trimValues: true,
  parseTagValue: false,
  ignoreDeclaration: true,
  ignorePiTags: true,
});

export interface DocxImageBox {
  /** Rendered width in CSS px (`wp:extent/@cx` is EMU) */
  width: number;
  /** Rendered height in CSS px */
  height: number;
  /** Wrap mode mapped onto the editor's layer names */
  layer: ImageLayer;
  /** Horizontal placement of a picture that is not floating to one side (`w:jc`-less anchors use this) */
  align?: 'left' | 'center' | 'right';
  /** `left` of an absolutely positioned layer, in CSS px from the text area's top-left corner */
  offsetX?: number;
  /** `top` of an absolutely positioned layer, in CSS px from the text area's top-left corner */
  offsetY?: number;
  /**
   * What the offsets are measured from: the text area (default) or the anchor paragraph
   * (`relativeFrom="paragraph"`), which needs the paragraph to become the containing block
   */
  anchor?: 'paragraph';
}

/** Depth-first collect, skipping `mc:Fallback` (it repeats the `mc:Choice` payload) */
function collectDrawings(node: XmlNode, out: XmlNode[] = []): XmlNode[] {
  if (localNameOf(node) === 'drawing') {
    out.push(node);
    return out;
  }
  for (const child of childrenOf(node)) {
    if (localNameOf(child) === 'Fallback') continue;
    collectDrawings(child, out);
  }
  return out;
}

function findNode(nodes: XmlNode[], tag: string): XmlNode | undefined {
  for (const node of nodes) {
    if (localNameOf(node) === tag) return node;
    const deeper = findNode(childrenOf(node), tag);
    if (deeper) return deeper;
  }
  return undefined;
}

/** Depth-first collect of every node with that tag, in document order */
function collect(node: XmlNode | undefined, tag: string, out: XmlNode[] = []): XmlNode[] {
  if (!node) return out;
  if (localNameOf(node) === tag) out.push(node);
  for (const child of childrenOf(node)) collect(child, tag, out);
  return out;
}

/** `wp:posOffset` carries the value as element text, in EMU */
function offsetOf(anchor: XmlNode | undefined, tag: 'positionH' | 'positionV'): number | null {
  const raw = textOf(collect(collect(anchor, tag)[0], 'posOffset')[0]).trim();
  const value = Number(raw);
  return Number.isFinite(value) ? emuToPx(value) : null;
}

function layerOf(
  anchor: XmlNode | undefined,
  inline: XmlNode | undefined,
  width: number,
): ImageLayer {
  if (!anchor || inline) return 'inline';
  const behind = attr(anchor, 'behindDoc');
  // Word paints `behindDoc` below the body text and `wrapNone` above it; both are absolute layers
  if (behind === '1' || behind === 'true') return 'behind';
  if (collect(anchor, 'wrapTopAndBottom').length > 0) return 'top-bottom';
  const square = collect(anchor, 'wrapSquare')[0];
  if (!square) return 'front';
  // wrapText names the side that keeps text, so "right" means the picture sits on the left
  const side = attr(square, 'wrapText');
  if (side === 'left') return 'wrap-right';
  if (side === 'right') return 'wrap-left';
  // bothSides: decide by the picture's centre inside the content area
  const x = offsetOf(anchor, 'positionH') ?? 0;
  return x + width / 2 > CONTENT_HALF_PX ? 'wrap-right' : 'wrap-left';
}

/** A4 content width / 2: the midpoint used to tell a left-hand picture from a right-hand one */
const CONTENT_HALF_PX = 331;

/** Page geometry of the first section in CSS px (1px = 15twip), the frame anchors are measured in */
interface PageMetricsPx {
  pageWidth: number;
  pageHeight: number;
  contentWidth: number;
  contentHeight: number;
  marginLeft: number;
  marginTop: number;
}

function pageMetricsPx(documentXml: string): PageMetricsPx {
  const sect = /<w:sectPr\b[\s\S]*?<\/w:sectPr>/.exec(documentXml)?.[0] ?? '';
  const page = /<w:pgSz\b([^>]*?)\/?>/.exec(sect)?.[1] ?? '';
  const margin = /<w:pgMar\b([^>]*?)\/?>/.exec(sect)?.[1] ?? '';
  const px = (source: string, name: string, fallbackTwip: number): number => {
    const value = Number.parseFloat(new RegExp(`w:${name}="(-?\\d+)"`).exec(source)?.[1] ?? '');
    return (Number.isFinite(value) ? value : fallbackTwip) / 15;
  };
  const width = px(page, 'w', 11906);
  const height = px(page, 'h', 16838);
  const left = px(margin, 'left', 1440);
  const top = px(margin, 'top', 1440);
  return {
    pageWidth: width,
    pageHeight: height,
    marginLeft: left,
    marginTop: top,
    contentWidth: Math.max(1, width - left - px(margin, 'right', 1440)),
    contentHeight: Math.max(1, height - top - px(margin, 'bottom', 1440)),
  };
}

/** Where an anchored offset is measured from — the two origins the editor can reproduce */
export type AnchorScope = 'content' | 'paragraph';

/** One resolved axis: the offset plus the frame it belongs to */
interface AxisPosition {
  px: number;
  scope: AnchorScope;
}

/**
 * Absolute position of an anchored drawing along one axis (`null` = the origin needs the layout Word
 * had, see the module comment).
 *
 * `relativeFrom="page"` is measured from the paper edge, so the page margin is subtracted to reach the
 * text area; `margin` and `column` already are text-area relative.
 *
 * `relativeFrom="paragraph"` is *not* unknown — Word measures it from the anchor paragraph's top-left
 * corner, which the editor can reproduce with the paragraph as the containing block (the CSS does that
 * for pictures carrying `data-anchor="paragraph"`). Treating it as unknown left the offset unapplied and
 * the picture collapsed to the end of the line box, which put a "behind the text" logo underneath the
 * large in-flow picture above it and made it invisible.
 */
function positionAlong(
  anchor: XmlNode | undefined,
  axis: 'H' | 'V',
  metrics: PageMetricsPx,
  extent: number,
): AxisPosition | null {
  const holder = childOf(anchor, axis === 'H' ? 'positionH' : 'positionV');
  if (!holder) return null;
  const origin = attr(holder, 'relativeFrom') ?? (axis === 'H' ? 'column' : 'paragraph');
  // `line` / `character` depend on the text layout Word computed: nothing to reproduce them with
  if (origin === 'line' || origin === 'character') return null;
  if (origin === 'paragraph') {
    const offset = Number.parseFloat(textOf(childOf(holder, 'posOffset')) ?? '');
    if (!Number.isFinite(offset)) return null;
    // A named alignment inside a paragraph is meaningless, so only the explicit offset is honoured
    return { px: emuToPx(offset), scope: 'paragraph' };
  }
  const fromPage = origin === 'page';
  const span = fromPage
    ? axis === 'H'
      ? metrics.pageWidth
      : metrics.pageHeight
    : axis === 'H'
      ? metrics.contentWidth
      : metrics.contentHeight;
  // Paper edge -> text area origin
  const base = fromPage ? -(axis === 'H' ? metrics.marginLeft : metrics.marginTop) : 0;
  const named = textOf(childOf(holder, 'align')).trim();
  if (named) {
    const aligned =
      axis === 'H'
        ? named === 'left'
          ? 0
          : named === 'center'
            ? (span - extent) / 2
            : named === 'right'
              ? span - extent
              : null
        : named === 'top'
          ? 0
          : named === 'center'
            ? (span - extent) / 2
            : named === 'bottom'
              ? span - extent
              : null;
    return aligned === null ? null : { px: base + aligned, scope: 'content' };
  }
  const offset = Number.parseFloat(textOf(childOf(holder, 'posOffset')) ?? '');
  return Number.isFinite(offset) ? { px: base + emuToPx(offset), scope: 'content' } : null;
}

/** Content width in EMU, from the first section: `pgSz - margins` (twips × 635) */
function contentWidthEmu(documentXml: string): number {
  const sect = /<w:sectPr\b[\s\S]*?<\/w:sectPr>/.exec(documentXml)?.[0] ?? '';
  const page = /<w:pgSz\b([^>]*?)\/?>/.exec(sect)?.[1] ?? '';
  const margin = /<w:pgMar\b([^>]*?)\/?>/.exec(sect)?.[1] ?? '';
  const width = Number.parseInt(/w:w="(\d+)"/.exec(page)?.[1] ?? '', 10);
  const left = Number.parseInt(/w:left="(\d+)"/.exec(margin)?.[1] ?? '0', 10);
  const right = Number.parseInt(/w:right="(\d+)"/.exec(margin)?.[1] ?? '0', 10);
  if (!Number.isFinite(width) || width <= 0) return 6.5 * 914400;
  return Math.max(1, width - left - right) * 635;
}

/**
 * Horizontal placement of an anchored picture.
 *
 * Word positions it with `wp:positionH`: either a named alignment or an offset from the text edge. The
 * editor has no absolute positioning, so the *intent* is kept — a picture whose centre falls in the right
 * part of the text column is right-aligned instead of collapsing to the left margin.
 */
function alignOf(anchor: XmlNode, cx: number, contentWidth: number): 'left' | 'center' | 'right' {
  const position = childOf(anchor, 'positionH');
  // Word writes the named alignment as a `<wp:align>` child, not as an attribute
  const named = (attr(position, 'align') ?? textOf(childOf(position, 'align'))).trim();
  if (named === 'right' || named === 'center' || named === 'left') return named;
  const exact = Number.parseFloat(textOf(childOf(position, 'posOffset')) ?? '');
  if (!Number.isFinite(exact)) return 'center';
  const centre = (exact + cx / 2) / contentWidth;
  if (centre > 0.55) return 'right';
  return 'center';
}

function boxOf(
  drawing: XmlNode,
  contentWidth: number,
  metrics: PageMetricsPx,
): DocxImageBox | null {
  // A `wps:wsp` is a shape, not a picture: mammoth renders no <img> for it (see docxShapeImport)
  if (collect(drawing, 'wsp').length > 0) return null;
  const inline = collect(drawing, 'inline')[0];
  const anchor = collect(drawing, 'anchor')[0];
  const holder = inline ?? anchor;
  if (!holder) return null;
  const extent = childOf(holder, 'extent');
  const cx = numAttr(extent, 'cx');
  const cy = numAttr(extent, 'cy');
  if (!cx || !cy) return null;
  const width = emuToPx(cx);
  const height = emuToPx(cy);
  const layer = normalizeImageLayer(layerOf(anchor, inline, width));
  if (layer === 'behind' || layer === 'front') {
    const x = positionAlong(anchor, 'H', metrics, width);
    const y = positionAlong(anchor, 'V', metrics, height);
    // An axis whose `relativeFrom` needs Word's own layout stays unset: the browser then keeps the
    // picture at its *static* position, which is exactly "anchored to this paragraph".
    if (!x || !y) {
      const partial = x?.scope === 'paragraph' || y?.scope === 'paragraph';
      return {
        width,
        height,
        layer,
        ...(partial ? { anchor: 'paragraph' as const } : {}),
        ...(x ? { offsetX: partial ? Math.round(x.px) : Math.max(0, Math.round(x.px)) } : {}),
        ...(y ? { offsetY: partial ? Math.round(y.px) : Math.max(0, Math.round(y.px)) } : {}),
      };
    }
    // One paragraph-relative axis makes the whole picture paragraph-anchored: both offsets have to live
    // in the same frame, because a box has a single containing block. Mixing the two (one axis measured
    // from the text area, the other from the paragraph) is off by the paragraph's own indent — the only
    // case that cannot be expressed, and a smaller error than dropping the offset altogether
    const anchored = x.scope === 'paragraph' || y.scope === 'paragraph';
    return {
      width,
      height,
      layer,
      ...(anchored ? { anchor: 'paragraph' } : {}),
      // Word allows a paragraph-relative offset to sit above / left of the paragraph; a text-area
      // offset is clamped at 0, which is also where dragging stops
      offsetX: anchored ? Math.round(x.px) : Math.max(0, Math.round(x.px)),
      offsetY: anchored ? Math.round(y.px) : Math.max(0, Math.round(y.px)),
    };
  }
  return {
    width,
    height,
    layer,
    // Floating pictures are placed by their wrap mode; only the ones that sit on their own line need this
    ...(anchor && layer !== 'wrap-left' && layer !== 'wrap-right'
      ? { align: alignOf(anchor, cx, contentWidth) }
      : {}),
  };
}

/**
 * Every picture in `word/document.xml`, in document order.
 * Returns `[]` instead of throwing when the part cannot be parsed: the caller then keeps mammoth's
 * output (no sizes) rather than failing the whole import.
 */
export function parseDocxImageBoxes(documentXml: string): DocxImageBox[] {
  if (!documentXml || !documentXml.includes('<w:drawing')) return [];
  try {
    const parsed = parser.parse(documentXml) as XmlNode[];
    const body = findNode(parsed, 'body');
    if (!body) return [];
    const boxes: DocxImageBox[] = [];
    const contentWidth = contentWidthEmu(documentXml);
    const metrics = pageMetricsPx(documentXml);
    for (const drawing of collectDrawings(body)) {
      // Only drawings that carry a picture relationship produce an <img>; charts and shapes don't
      if (collect(drawing, 'blip').length === 0 && collect(drawing, 'imagedata').length === 0) {
        continue;
      }
      const box = boxOf(drawing, contentWidth, metrics);
      if (box) boxes.push(box);
    }
    return boxes;
  } catch {
    return [];
  }
}

/** Merge declarations into an element's inline style, keeping whatever is already there */
function mergeStyle(element: HTMLElement, declarations: string): void {
  const existing = element.getAttribute('style');
  element.setAttribute(
    'style',
    `${existing ? `${existing.replace(/;\s*$/, '')}; ` : ''}${declarations}`,
  );
}

/**
 * Stamp the parsed boxes onto mammoth's `<img>` elements.
 * Order is the only reliable key (mammoth emits the data URI, not the relationship id), so the counts
 * must agree; otherwise the HTML is returned untouched.
 */
export function applyImageBoxes(html: string, boxes: readonly DocxImageBox[]): string {
  if (boxes.length === 0) return html;
  if (typeof DOMParser === 'undefined') return html;
  const doc = new DOMParser().parseFromString(`<body>${html}</body>`, 'text/html');
  const images = Array.from(doc.body.querySelectorAll('img'));
  if (images.length !== boxes.length) return html;
  images.forEach((image, index) => {
    const box = boxes[index];
    if (!box) return;
    image.setAttribute('width', String(box.width));
    image.setAttribute('height', String(box.height));
    mergeStyle(image, `width: ${box.width}px; height: ${box.height}px`);
    if (box.layer !== 'inline') image.setAttribute('data-layer', box.layer);
    // Absolute layers live at an offset from the text area's top-left corner (the image node reads
    // `style.left` / `style.top`, so the position survives every HTML round trip). A missing axis is
    // left out on purpose: `auto` keeps the picture where the anchor paragraph put it.
    const offsets = [
      box.offsetX === undefined ? '' : `left: ${box.offsetX}px`,
      box.offsetY === undefined ? '' : `top: ${box.offsetY}px`,
    ].filter(Boolean);
    if (offsets.length > 0) mergeStyle(image, offsets.join('; '));
    // `data-anchor` makes the enclosing paragraph the containing block, which is the frame a
    // paragraph-relative offset is measured in
    if (box.anchor) image.setAttribute('data-anchor', box.anchor);
    if (box.align && box.align !== 'left') image.setAttribute('data-align', box.align);
  });
  return doc.body.innerHTML;
}
