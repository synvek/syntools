import { XMLParser } from 'fast-xml-parser';
import { emuToPx } from '../../core/drawing/geometry';
import { alignBlocks } from './docxBlockAlign';
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
  // Word splits a sentence at every formatting change, so `w:t` frequently ends with the space that
  // joins two runs ("DOCX " + "高级特性…"). Trimming each value glues the words together and every
  // text-based pairing (shapes, paragraph properties) then misses the paragraph.
  trimValues: false,
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

/** `w:jc` of the paragraph the shape sits in: an inline shape is centred through it */
function paragraphAlign(paragraph: XmlNode): DocShapeAttrs['align'] {
  const properties = childOf(paragraph, 'pPr');
  // Namespace prefixes are preserved by the parser, so `w:val` (not `val`) is the key
  const value = attr(childOf(properties, 'jc'), 'w:val');
  if (value === 'center') return 'center';
  if (value === 'right' || value === 'end') return 'right';
  return 'left';
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
function shapeFromDrawing(
  drawing: XmlNode,
  blockIndex: number,
  align: DocShapeAttrs['align'],
): ImportedShape | null {
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
    align,
    name: name ?? null,
  });
  return { attrs: spec, blockIndex };
}

/**
 * Legacy VML shapes (`w:pict` / `v:roundrect` …) are not convertible yet, but they must be counted:
 * silently dropping a visible shape is exactly the failure the caller reports. Entries that only wrap
 * a `v:imagedata` are pictures — mammoth imports those.
 */
function vmlShapeCount(node: XmlNode): number {
  let count = 0;
  for (const pict of pictsOutsideFallback(node)) {
    for (const shape of collect(pict, 'shape')) {
      if (collect(shape, 'imagedata').length === 0) count += 1;
    }
    if (collect(pict, 'imagedata').length === 0) {
      for (const tag of ['roundrect', 'rect', 'oval', 'line', 'polyline', 'arc']) {
        count += collect(pict, tag).length;
      }
    }
  }
  return count;
}

/** CSS length to px: VML sizes the frame in `style="width:187.2pt;height:64.8pt"` */
function cssLengthPx(value: string | undefined): number | null {
  if (!value) return null;
  const match = /^\s*(-?[\d.]+)\s*(pt|px|in|cm|mm|emu)?\s*$/i.exec(value);
  if (!match) return null;
  const amount = Number.parseFloat(match[1] ?? '');
  if (!Number.isFinite(amount)) return null;
  switch ((match[2] ?? 'px').toLowerCase()) {
    case 'pt':
      return Math.round((amount * 96) / 72);
    case 'in':
      return Math.round(amount * 96);
    case 'cm':
      return Math.round((amount * 96) / 2.54);
    case 'mm':
      return Math.round((amount * 96) / 25.4);
    case 'emu':
      return Math.round(amount / 9525);
    default:
      return Math.round(amount);
  }
}

/**
 * Legacy VML shape (`w:pict` → `v:roundrect` / `v:rect` / `v:oval`) as an editor shape.
 *
 * Word still writes these for shapes created by older tools; mammoth has no handling at all, so the
 * text inside the shape imported while the shape itself vanished. The visible content is the text box,
 * so that is what is carried over: fill / outline where VML names them, and Word's own text colour and
 * size when the text box declares them.
 */
function vmlShapeFrom(
  node: XmlNode,
  kind: string,
  blockIndex: number,
  align: DocShapeAttrs['align'],
): ImportedShape | null {
  const style = attr(node, 'style') ?? '';
  const width = cssLengthPx(/\bwidth:([^;]+)/.exec(style)?.[1]);
  const height = cssLengthPx(/\bheight:([^;]+)/.exec(style)?.[1]);
  if (!width || !height) return null;
  const textBox = collect(node, 'txbxContent')[0];
  const text = textBox
    ? collect(textBox, 't')
        .map((item) => textOf(item))
        .join('')
        .trim()
    : '';
  const textColorHex = textBox
    ? /^[0-9a-f]{6}$/i.test(attr(collect(textBox, 'color')[0], 'w:val') ?? '')
      ? (attr(collect(textBox, 'color')[0], 'w:val') as string)
      : null
    : null;
  const halfPoints = Number.parseInt(attr(collect(textBox ?? node, 'sz')[0], 'w:val') ?? '', 10);
  const fill = attr(node, 'fillcolor') ?? '#FFFFFF';
  const stroke = attr(node, 'strokecolor') ?? (textColorHex ? `#${textColorHex}` : '#000000');
  const strokeWidth = Number.parseFloat(attr(node, 'strokeweight') ?? '') || 1;
  const prst = kind === 'roundrect' ? 'roundRect' : kind === 'oval' ? 'ellipse' : 'rect';
  return {
    blockIndex,
    attrs: shapeSpec({
      prst,
      width,
      height,
      fill,
      stroke,
      strokeWidth,
      text,
      align,
      ...(Number.isFinite(halfPoints) && halfPoints > 0 ? { textSize: halfPoints / 2 } : {}),
      ...(textColorHex ? { textColor: `#${textColorHex}` } : {}),
    }),
  };
}

/**
 * `w:pict` elements that are not inside `mc:Fallback`: a DrawingML shape writes its VML twin there for
 * old readers, and importing both would draw the same shape twice.
 */
function pictsOutsideFallback(node: XmlNode): XmlNode[] {
  const out: XmlNode[] = [];
  const walk = (current: XmlNode): void => {
    for (const child of childrenOf(current)) {
      const name = localNameOf(child);
      if (name === 'Fallback') continue;
      if (name === 'pict') out.push(child);
      walk(child);
    }
  };
  walk(node);
  return out;
}

/** Every VML shape in a paragraph (a `w:pict` may hold several, and one may wrap an image) */
function vmlShapesOf(
  node: XmlNode,
  blockIndex: number,
  align: DocShapeAttrs['align'],
): ImportedShape[] {
  const shapes: ImportedShape[] = [];
  for (const pict of pictsOutsideFallback(node)) {
    for (const kind of ['roundrect', 'rect', 'oval']) {
      for (const shapeNode of collect(pict, kind)) {
        if (collect(shapeNode, 'imagedata').length > 0) continue;
        const shape = vmlShapeFrom(shapeNode, kind, blockIndex, align);
        if (shape) shapes.push(shape);
      }
    }
  }
  return shapes;
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
      unsupported += collect(node, 'wsp').length + vmlShapeCount(node);
      continue;
    }
    const text = normalizeText(paragraphText(node));
    const drawings = collect(node, 'drawing');
    const align = paragraphAlign(node);
    // Boundary = how many non-empty paragraphs came before: the HTML insert point
    const blockIndex = blocks.length;
    if (text) blocks.push(text);
    for (const drawing of drawings) {
      // A drawing without `wps:wsp` is a picture (or a chart): mammoth imports the picture itself, so
      // counting it here would report "7 shapes skipped" for a document that only had 1 shape
      if (collect(drawing, 'wsp').length === 0) continue;
      const shape = shapeFromDrawing(drawing, blockIndex, align);
      if (shape) shapes.push(shape);
      else unsupported += 1;
    }
    const vmlShapes = vmlShapesOf(node, blockIndex, align);
    shapes.push(...vmlShapes);
    // Whatever VML could not be turned into a shape is still reported instead of vanishing silently
    unsupported += Math.max(0, vmlShapeCount(node) - vmlShapes.length);
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

  // Align the two sides by text. Requiring both sequences to be identical meant a single reshaped
  // block (a list wrapper, one table cell expanded into a paragraph) skipped every shape; a block
  // without a counterpart keeps its shapes out instead of guessing.
  const anchors = new Map<number, Element>();
  for (const [index, blockIndex] of alignBlocks(
    extracted.blocks,
    htmlBlocks.map((item) => item.text),
  )) {
    const element = htmlBlocks[blockIndex]?.element;
    if (element) anchors.set(index, element);
  }
  if (anchors.size === 0) return { html, placed: 0, skipped: total };

  // Insert from the end so earlier insertions never shift later boundaries
  const ordered = [...extracted.shapes].sort((a, b) => b.blockIndex - a.blockIndex);
  let placed = 0;
  for (const shape of ordered) {
    const anchor = anchors.get(shape.blockIndex);
    // No anchor for this block and it is not the tail: leave the shape out rather than misplace it
    if (!anchor && shape.blockIndex < extracted.blocks.length) continue;
    const reference = anchor ?? null;
    const element = doc.createElement('div');
    for (const [name, value] of Object.entries(shapeDomAttributes(shape.attrs))) {
      element.setAttribute(name, value);
    }
    // The visible body: same SVG the editor renders for an inserted shape
    element.innerHTML =
      `<svg class="rte-shape-svg" width="${shape.attrs.width}" height="${shape.attrs.height}" viewBox="0 0 ${shape.attrs.width} ${shape.attrs.height}" aria-hidden="true">` +
      `<path d="${shapePathOf(shape.attrs)}" fill="${shape.attrs.fill || 'none'}" stroke="${shape.attrs.stroke || 'none'}" stroke-width="${shape.attrs.strokeWidth}"/></svg>`;
    // An inline shape sits in its paragraph, so Word centres it through `w:jc` on that paragraph; the
    // element is a body-level block here and would otherwise always hug the left edge
    const align = reference
      ? (reference as HTMLElement).style.textAlign ||
        (reference as HTMLElement).getAttribute('data-align') ||
        ''
      : '';
    if (align === 'center' || align === 'right') element.setAttribute('data-align', align);
    if (reference) body.insertBefore(element, reference);
    else body.appendChild(element);
    placed += 1;
  }

  return { html: body.innerHTML, placed, skipped: total - placed };
}
