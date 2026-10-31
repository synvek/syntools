import { XMLParser } from 'fast-xml-parser';
import { emuToPx } from '../../core/drawing/geometry';
import { parseShapeGeometry } from '../../core/drawing/drawingml';
import {
  attr,
  childOf,
  childrenOf,
  localNameOf,
  numAttr,
  textOf,
  type XmlNode,
} from '../../core/drawing/xmlNode';
import type { ImageLayer } from './imageLayer';
import {
  shapeDomAttributes,
  shapePathOf,
  shapeSpec,
  type DocShapeAttrs,
  type ShapeDash,
} from './shapeNode';

/**
 * Shapes ← `wps:wsp` (P3-1.5).
 *
 * mammoth throws every `w:drawing` away (same class of problem as `w:del`, see `docxReview.ts`),
 * so the shapes must be read from `word/document.xml` directly. Anchoring follows one rule:
 * **the visible text must match exactly**, otherwise nothing is restored.
 *
 * Concretely: both sides are reduced to their non-empty block texts (docx paragraphs vs. HTML
 * blocks). If the two sequences are equal, a shape is inserted at the block boundary it occupied;
 * if not, every shape is skipped and counted, because a misplaced shape is worse than a missing one.
 */

/** preserveOrder parsing, matching `pptx/xml.ts` (sibling order is what z-order depends on) */
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

export interface ImportedShape {
  attrs: DocShapeAttrs;
  /** Number of non-empty docx paragraphs before this shape: the HTML insertion boundary */
  blockIndex: number;
}

export interface ExtractedShapes {
  shapes: ImportedShape[];
  /** Visible body text of the document (drawings excluded): the equality check's left side */
  blocks: string[];
  /** Drawings seen but not convertible (no recognisable shape inside) */
  unsupported: number;
}

const normalizeText = (text: string): string =>
  text
    .replace(/\u00a0/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();

/** Depth-first collect of every node with that tag, in document order */
function collect(node: XmlNode | undefined, tag: string, out: XmlNode[] = []): XmlNode[] {
  if (!node) return out;
  if (localNameOf(node) === tag) out.push(node);
  for (const child of childrenOf(node)) collect(child, tag, out);
  return out;
}

/** Depth-first search over parsed nodes (the parsed document is an array at the top) */
function findNode(nodes: XmlNode[], tag: string): XmlNode | undefined {
  for (const node of nodes) {
    if (localNameOf(node) === tag) return node;
    const deeper = findNode(childrenOf(node), tag);
    if (deeper) return deeper;
  }
  return undefined;
}

/** Paragraph text that ignores drawings / VML: shape text must not leak into the anchor check */
function paragraphText(node: XmlNode): string {
  let text = '';
  for (const child of childrenOf(node)) {
    const name = localNameOf(child);
    if (name === 'drawing' || name === 'pict' || name === 'AlternateContent' || name === 'object') {
      continue;
    }
    if (name === 't') text += textOf(child);
    else text += paragraphText(child);
  }
  return text;
}

function hexColor(node: XmlNode | undefined): string | null {
  const srgb = collect(node, 'srgbClr')[0];
  const value = attr(srgb, 'val');
  return value && /^[0-9a-fA-F]{6}$/.test(value) ? `#${value.toLowerCase()}` : null;
}

function layerOf(anchor: XmlNode | undefined, inline: XmlNode | undefined): ImageLayer {
  if (!anchor || inline) return 'inline';
  const behind = attr(anchor, 'behindDoc');
  if (behind === '1' || behind === 'true') return 'behind';
  if (collect(anchor, 'wrapTopAndBottom').length > 0) return 'top-bottom';
  const square = collect(anchor, 'wrapSquare')[0];
  if (square) {
    // wrapText names the side that carries text, so "right" means the shape sits on the left
    const side = attr(square, 'wrapText');
    return side === 'right' ? 'wrap-left' : 'wrap-right';
  }
  return 'front';
}

function dashOf(ln: XmlNode | undefined): ShapeDash | null {
  const preset = attr(collect(ln, 'prstDash')[0], 'val');
  if (!preset) return null;
  if (preset === 'sysDot' || preset === 'dot') return 'dot';
  if (preset.startsWith('dash') || preset === 'lgDash' || preset === 'sysDash') return 'dash';
  return 'solid';
}

function offsetOf(anchor: XmlNode | undefined, tag: 'positionH' | 'positionV'): number | null {
  // `wp:posOffset` carries the value as element text, not as an attribute
  const raw = textOf(collect(collect(anchor, tag)[0], 'posOffset')[0]).trim();
  const value = Number(raw);
  return Number.isFinite(value) ? emuToPx(value) : null;
}

/** `w:sz` is half-points → px; the panel and the HTML renderer both work in px */
function textRunSize(textBox: XmlNode | undefined): number {
  const raw = attr(collect(textBox, 'sz')[0], 'val');
  const halfPoints = Number(raw);
  if (!Number.isFinite(halfPoints) || halfPoints <= 0) return 14;
  return Math.max(6, Math.min(96, Math.round(halfPoints / 1.5)));
}

/** One `wps:wsp` inside a drawing → shape attributes (null when the geometry is unusable) */
function shapeFromDrawing(drawing: XmlNode, blockIndex: number): ImportedShape | null {
  const wsp = collect(drawing, 'wsp')[0];
  if (!wsp) return null;
  const spPr = childOf(wsp, 'spPr');
  if (!spPr) return null;
  const geometry = parseShapeGeometry(spPr);
  const xfrm = childOf(spPr, 'xfrm');
  const ext = childOf(xfrm, 'ext');
  const cx = numAttr(ext, 'cx');
  const cy = numAttr(ext, 'cy');
  if (!cx || !cy) return null;

  const anchor = collect(drawing, 'anchor')[0];
  const inline = collect(drawing, 'inline')[0];
  const ln = childOf(spPr, 'ln');
  const lnWidth = numAttr(ln, 'w');
  const textBox = collect(wsp, 'txbx')[0];
  const name = attr(childOf(wsp, 'cNvPr'), 'name');

  const spec = shapeSpec({
    prst: geometry.prst,
    adj: geometry.adj ?? null,
    width: emuToPx(cx),
    height: emuToPx(cy),
    rotation: Math.round((numAttr(xfrm, 'rot') ?? 0) / 60000),
    fill: childOf(spPr, 'noFill') ? '' : (hexColor(childOf(spPr, 'solidFill')) ?? '#4472C4'),
    stroke: hexColor(ln) ?? '#2F5597',
    strokeWidth: lnWidth === undefined ? 1 : Math.round((lnWidth / 9525) * 10) / 10,
    dash: dashOf(ln),
    layer: layerOf(anchor, inline),
    offsetX: anchor ? offsetOf(anchor, 'positionH') : null,
    offsetY: anchor ? offsetOf(anchor, 'positionV') : null,
    text: textBox ? textOf(textBox) : '',
    textSize: textRunSize(textBox),
    textColor: hexColor(collect(textBox, 'color')[0]) ?? '#FFFFFF',
    textBold: collect(textBox, 'b').length > 0,
    textItalic: collect(textBox, 'i').length > 0,
    textUnderline: collect(textBox, 'u').length > 0,
    textAlign: (attr(collect(textBox, 'jc')[0], 'val') as DocShapeAttrs['textAlign']) ?? 'center',
    name: name ?? null,
  });
  return { attrs: spec, blockIndex };
}

/**
 * Read every shape from `word/document.xml`, with the block index it belongs to.
 * Only direct body paragraphs are walked: a shape inside a table is reported as unsupported
 * instead of being anchored at a position the HTML cannot express.
 */
export function extractDocxShapes(documentXml: string): ExtractedShapes {
  const shapes: ImportedShape[] = [];
  const blocks: string[] = [];
  let unsupported = 0;
  if (!documentXml) return { shapes, blocks, unsupported };

  const parsed = parser.parse(documentXml) as XmlNode[];
  const body = findNode(parsed, 'body');
  if (!body) return { shapes, blocks, unsupported };

  for (const node of childrenOf(body)) {
    const name = localNameOf(node);
    if (name !== 'p') {
      // Tables and other containers: their drawings cannot be anchored block-wise here
      unsupported += collect(node, 'wsp').length;
      continue;
    }
    const text = normalizeText(paragraphText(node));
    const drawings = collect(node, 'drawing');
    // Boundary = how many non-empty paragraphs came before: the HTML insert point
    const blockIndex = blocks.length;
    if (text) blocks.push(text);
    for (const drawing of drawings) {
      const shape = shapeFromDrawing(drawing, blockIndex);
      if (shape) shapes.push(shape);
      else unsupported += 1;
    }
  }
  return { shapes, blocks, unsupported };
}

export interface PlacedShapes {
  html: string;
  placed: number;
  skipped: number;
}

/**
 * Insert the extracted shapes into mammoth's HTML.
 *
 * Equality rule: the non-empty block texts of both sides must match one by one. Anything else
 * (mammoth reflowed a table, merged paragraphs, dropped a block) means the mapping is unproven, and
 * the shapes are skipped with a count so the UI can warn.
 */
export function placeShapesInHtml(html: string, extracted: ExtractedShapes): PlacedShapes {
  const total = extracted.shapes.length + extracted.unsupported;
  if (extracted.shapes.length === 0) return { html, placed: 0, skipped: total };

  const doc = new DOMParser().parseFromString(`<body>${html}</body>`, 'text/html');
  const body = doc.body;
  const elements = Array.from(body.children).map((element) => ({
    element,
    text: normalizeText(element.textContent ?? ''),
  }));
  const htmlBlocks = elements.filter((item) => item.text.length > 0);

  const sameLength = htmlBlocks.length === extracted.blocks.length;
  const sameText = sameLength && htmlBlocks.every((item, i) => item.text === extracted.blocks[i]);
  if (!sameText) return { html, placed: 0, skipped: total };

  // Insert from the end so earlier insertions never shift later boundaries
  const ordered = [...extracted.shapes].sort((a, b) => b.blockIndex - a.blockIndex);
  let placed = 0;
  for (const shape of ordered) {
    const reference =
      shape.blockIndex < htmlBlocks.length ? htmlBlocks[shape.blockIndex].element : null;
    const element = doc.createElement('div');
    for (const [name, value] of Object.entries(shapeDomAttributes(shape.attrs))) {
      element.setAttribute(name, value);
    }
    // The visible body: same SVG the editor renders for an inserted shape
    element.innerHTML =
      `<svg class="rte-shape-svg" width="${shape.attrs.width}" height="${shape.attrs.height}" viewBox="0 0 ${shape.attrs.width} ${shape.attrs.height}" aria-hidden="true">` +
      `<path d="${shapePathOf(shape.attrs)}" fill="${shape.attrs.fill || 'none'}" stroke="${shape.attrs.stroke || 'none'}" stroke-width="${shape.attrs.strokeWidth}"/></svg>`;
    if (reference) body.insertBefore(element, reference);
    else body.appendChild(element);
    placed += 1;
  }

  return { html: body.innerHTML, placed, skipped: total - placed };
}
