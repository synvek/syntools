import { XMLParser } from 'fast-xml-parser';
import type JSZipType from 'jszip';
import { emuToPx } from '../../core/drawing/geometry';
import { escapeXml, parseShapeGeometry, prstGeomXml } from '../../core/drawing/drawingml';
import {
  attr,
  childOf,
  childrenOf,
  localNameOf,
  numAttr,
  textOf,
  type XmlNode,
} from '../../core/drawing/xmlNode';
import type { SheetShapeConfig } from './shapes';
import {
  EMU_PER_PX,
  addContentTypeEntries,
  buildDrawingXml,
  appendAnchorsToDrawing,
  contentTypeOverride,
  insertDrawingIntoSheet,
  upsertRelationship,
} from './chartXml';
import { dirOf, parseRelationships, relsPathFor, resolveSheetParts } from './rawChartParts';
import { resolvePartPath } from './xlsx-normalize';

/**
 * `xdr:sp` round-trip for floating shapes (SHEET-02 / P4-SH3 + P4-SH4).
 *
 * DrawingML on a worksheet has six coupled places (drawing part, its rels, the sheet rel, the
 * `<drawing/>` element, content types, and the anchor itself); a missing one makes Excel report a
 * repair. The chart layer already solved the plumbing — this module reuses its helpers and only
 * contributes what is genuinely new: the `<xdr:sp>` element and the `oneCellAnchor` around it.
 *
 * Anchors are stored on the shape (`from` + pixel size), so export needs no column metrics: a shape
 * moves with its cell the way Excel expects without recomputing anything.
 */

const CT_DRAWING = 'application/vnd.openxmlformats-officedocument.drawing+xml';
const REL_DRAWING = 'http://schemas.openxmlformats.org/officeDocument/2006/relationships/drawing';
const DRAWING_REL = /relationships\/drawing$/;

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

export interface XlsxShapePlan {
  /** Sheet name → shapes to write (already ordered by z) */
  shapesBySheet: Record<string, SheetShapeConfig[]>;
}

export interface ShapePlanSource {
  sheets?: Record<string, { name?: string } | undefined>;
  sheetOrder?: string[];
  syntoolsShapes?: SheetShapeConfig[];
}

/** Snapshot → which shapes go to which sheet (unknown sheet ids fall back to the first sheet) */
export function buildShapePlan(source: ShapePlanSource): XlsxShapePlan {
  const shapesBySheet: Record<string, SheetShapeConfig[]> = {};
  const shapes = [...(source.syntoolsShapes ?? [])].sort((a, b) => a.z - b.z);
  for (const shape of shapes) {
    const fallbackId = (source.sheetOrder ?? [])[0];
    const sheetId = shape.sheetId && source.sheets?.[shape.sheetId] ? shape.sheetId : fallbackId;
    const name = sheetId ? source.sheets?.[sheetId]?.name : undefined;
    if (!name) continue;
    (shapesBySheet[name] ??= []).push(shape);
  }
  return { shapesBySheet };
}

function txBodyXml(shape: SheetShapeConfig): string {
  const text = (shape.text ?? '').trim();
  if (!text) return '';
  return (
    '<xdr:txBody>' +
    '<a:bodyPr vertOverflow="clip" horzOverflow="clip" wrap="square" rtlCol="0" anchor="ctr" anchorCtr="1"/>' +
    '<a:lstStyle/>' +
    '<a:p><a:pPr algn="ctr"/>' +
    '<a:r><a:rPr lang="zh-CN" altLang="en-US" sz="1400" dirty="0"/><a:t>' +
    escapeXml(text) +
    '</a:t></a:r></a:p></xdr:txBody>'
  );
}

/**
 * One `<xdr:sp>`. Child order is fixed by the schema (`nvSpPr → spPr → style → txBody`), and
 * `spPr/a:xfrm/a:ext` must equal the anchor's `xdr:ext`, otherwise the selection frame and the
 * painted shape disagree in Excel.
 */
export function buildShapeElementXml(shape: SheetShapeConfig, shapeId: number): string {
  const cx = Math.max(EMU_PER_PX, Math.round(shape.width * EMU_PER_PX));
  const cy = Math.max(EMU_PER_PX, Math.round(shape.height * EMU_PER_PX));
  const rot = Math.round((shape.rotation ?? 0) * 60000);
  const strokeWidth = Math.max(0, Math.round(shape.strokeWidth * EMU_PER_PX));
  const fill = shape.fill
    ? `<a:solidFill><a:srgbClr val="${hexOf(shape.fill)}"/></a:solidFill>`
    : '<a:noFill/>';
  const line =
    shape.strokeWidth > 0
      ? `<a:ln w="${strokeWidth}"><a:solidFill><a:srgbClr val="${hexOf(shape.stroke)}"/></a:solidFill></a:ln>`
      : '<a:ln><a:noFill/></a:ln>';

  return (
    '<xdr:sp macro="" textlink="">' +
    `<xdr:nvSpPr><xdr:cNvPr id="${shapeId}" name="${escapeXml(nameOf(shape, shapeId))}"/><xdr:cNvSpPr/></xdr:nvSpPr>` +
    '<xdr:spPr>' +
    `<a:xfrm${rot ? ` rot="${rot}"` : ''}><a:off x="0" y="0"/><a:ext cx="${cx}" cy="${cy}"/></a:xfrm>` +
    prstGeomXml(shape.prst, shape.adj) +
    fill +
    line +
    '</xdr:spPr>' +
    // Theme style is what Excel writes for a hand-inserted shape; explicit spPr values still win
    '<xdr:style>' +
    '<a:lnRef idx="2"><a:schemeClr val="accent1"><a:shade val="50000"/></a:schemeClr></a:lnRef>' +
    '<a:fillRef idx="1"><a:schemeClr val="accent1"/></a:fillRef>' +
    '<a:effectRef idx="0"><a:schemeClr val="accent1"/></a:effectRef>' +
    '<a:fontRef idx="minor"><a:schemeClr val="lt1"/></a:fontRef>' +
    '</xdr:style>' +
    txBodyXml(shape) +
    '</xdr:sp>'
  );
}

function nameOf(shape: SheetShapeConfig, shapeId: number): string {
  return `${shape.prst} ${shapeId}`;
}

function hexOf(color: string): string {
  return color.replace(/^#/, '').toUpperCase() || '4472C4';
}

/** `oneCellAnchor` (move with cells, keep the pixel size) around a shape element */
export function buildShapeAnchorXml(shape: SheetShapeConfig, shapeId: number): string {
  const cx = Math.max(EMU_PER_PX, Math.round(shape.width * EMU_PER_PX));
  const cy = Math.max(EMU_PER_PX, Math.round(shape.height * EMU_PER_PX));
  return (
    '<xdr:oneCellAnchor>' +
    `<xdr:from><xdr:col>${Math.max(0, Math.round(shape.from.col))}</xdr:col>` +
    `<xdr:colOff>${Math.max(0, Math.round(shape.from.colOff * EMU_PER_PX))}</xdr:colOff>` +
    `<xdr:row>${Math.max(0, Math.round(shape.from.row))}</xdr:row>` +
    `<xdr:rowOff>${Math.max(0, Math.round(shape.from.rowOff * EMU_PER_PX))}</xdr:rowOff></xdr:from>` +
    `<xdr:ext cx="${cx}" cy="${cy}"/>` +
    buildShapeElementXml(shape, shapeId) +
    '<xdr:clientData/>' +
    '</xdr:oneCellAnchor>'
  );
}

async function readText(zip: JSZipType, path: string): Promise<string | null> {
  const file = zip.file(path);
  return file ? file.async('string') : null;
}

/** Highest `cNvPr@id` already used in a drawing: new anchors must not reuse it */
function maxShapeId(drawingXml: string): number {
  let max = 1;
  for (const match of drawingXml.matchAll(/<xdr:cNvPr[^>]*\bid="(\d+)"/g)) {
    max = Math.max(max, Number(match[1]));
  }
  return max;
}

/**
 * Inject the shapes into the .xlsx produced by exceljs.
 * Run **after** the chart injection: charts may already have created the sheet's drawing, and Excel
 * allows exactly one `<drawing/>` per sheet, so the shape anchors are appended to that part.
 */
export async function injectShapesIntoXlsx(
  buffer: ArrayBuffer,
  plan: XlsxShapePlan,
): Promise<ArrayBuffer> {
  const sheetNames = Object.keys(plan.shapesBySheet);
  if (sheetNames.length === 0) return buffer;

  const JSZip = (await import('jszip')).default;
  const zip = await JSZip.loadAsync(buffer);
  const sheetParts = await resolveSheetParts(zip);
  const contentTypeEntries: string[] = [];

  let nextDrawingNumber = 1;
  for (const path of Object.keys(zip.files)) {
    const drawing = /^xl\/drawings\/drawing(\d+)\.xml$/.exec(path);
    if (drawing) nextDrawingNumber = Math.max(nextDrawingNumber, Number(drawing[1]) + 1);
  }

  for (const sheetName of sheetNames) {
    const sheetPath = sheetParts[sheetName];
    if (!sheetPath) continue;
    const sheetXml = await readText(zip, sheetPath);
    if (sheetXml === null) continue;
    const shapes = plan.shapesBySheet[sheetName] ?? [];
    if (shapes.length === 0) continue;

    // a) find the sheet's existing drawing (created by the chart injection or kept from import)
    const sheetRelsPath = relsPathFor(sheetPath);
    const sheetRelsXml = await readText(zip, sheetRelsPath);
    const existingRel = parseRelationships(sheetRelsXml).find((item) =>
      DRAWING_REL.test(item.type),
    );
    let drawingPath = existingRel ? resolvePartPath(existingRel.target, dirOf(sheetPath)) : null;

    // b) create the drawing part when the sheet has none
    if (!drawingPath || !zip.file(drawingPath)) {
      drawingPath = `xl/drawings/drawing${nextDrawingNumber}.xml`;
      nextDrawingNumber += 1;
      zip.file(drawingPath, buildDrawingXml(''));
      contentTypeEntries.push(contentTypeOverride(`/${drawingPath}`, CT_DRAWING));
    }

    // c) append the anchors, continuing the cNvPr numbering
    const drawingXml = (await readText(zip, drawingPath)) ?? buildDrawingXml('');
    const startId = maxShapeId(drawingXml) + 1;
    const anchorsXml = shapes
      .map((shape, index) => buildShapeAnchorXml(shape, startId + index))
      .join('');
    zip.file(drawingPath, appendAnchorsToDrawing(drawingXml, anchorsXml));

    // d) sheet → drawing relationship (idempotent) + `<drawing/>` in the worksheet
    const drawingRel = upsertRelationship(
      sheetRelsXml,
      REL_DRAWING,
      `../drawings/${drawingPath.slice(drawingPath.lastIndexOf('/') + 1)}`,
    );
    zip.file(sheetRelsPath, drawingRel.xml);
    zip.file(sheetPath, insertDrawingIntoSheet(sheetXml, drawingRel.id));
  }

  const contentTypes = await readText(zip, '[Content_Types].xml');
  if (contentTypes && contentTypeEntries.length > 0) {
    zip.file('[Content_Types].xml', addContentTypeEntries(contentTypes, contentTypeEntries));
  }
  return (await zip.generateAsync({ type: 'arraybuffer', compression: 'DEFLATE' })) as ArrayBuffer;
}

/* --------------------------------- import side -------------------------------- */

function collect(nodes: XmlNode[], tag: string, out: XmlNode[] = []): XmlNode[] {
  for (const node of nodes) {
    if (localNameOf(node) === tag) out.push(node);
    collect(childrenOf(node), tag, out);
  }
  return out;
}

function fillColor(spPr: XmlNode | undefined): string | null {
  const solid = childOf(spPr, 'solidFill');
  const srgb = solid ? childOf(solid, 'srgbClr') : undefined;
  const value = attr(srgb, 'val');
  return value && /^[0-9a-fA-F]{6}$/.test(value) ? `#${value.toLowerCase()}` : null;
}

function strokeColor(spPr: XmlNode | undefined): string | null {
  const ln = childOf(spPr, 'ln');
  const solid = ln ? childOf(ln, 'solidFill') : undefined;
  const srgb = solid ? childOf(solid, 'srgbClr') : undefined;
  const value = attr(srgb, 'val');
  return value && /^[0-9a-fA-F]{6}$/.test(value) ? `#${value.toLowerCase()}` : null;
}

/** One `xdr:oneCellAnchor` (or `twoCellAnchor`) → a shape config */
function parseAnchor(node: XmlNode, index: number): SheetShapeConfig | null {
  const from = childOf(node, 'from');
  const shape = childOf(node, 'sp');
  if (!from || !shape) return null;
  const spPr = childOf(shape, 'spPr');
  if (!spPr) return null;

  const geometry = parseShapeGeometry(spPr);
  const ext = childOf(node, 'ext');
  const xfrmExt = childOf(childOf(spPr, 'xfrm'), 'ext');
  const cx = numAttr(ext, 'cx') ?? numAttr(xfrmExt, 'cx') ?? 0;
  const cy = numAttr(ext, 'cy') ?? numAttr(xfrmExt, 'cy') ?? 0;
  if (!cx || !cy) return null;

  const textBody = childOf(shape, 'txBody');
  const text = textBody
    ? collect(childrenOf(textBody), 't')
        .map((node) => textOf(node))
        .join('')
    : '';

  return {
    id: `shape-import-${index + 1}`,
    prst: geometry.prst,
    ...(geometry.adj ? { adj: geometry.adj } : {}),
    from: {
      col: Math.max(0, Math.round(Number(nodeText(from, 'col')) || 0)),
      row: Math.max(0, Math.round(Number(nodeText(from, 'row')) || 0)),
      colOff: Math.round(emuToPx(Number(nodeText(from, 'colOff')) || 0)),
      rowOff: Math.round(emuToPx(Number(nodeText(from, 'rowOff')) || 0)),
    },
    width: emuToPx(cx),
    height: emuToPx(cy),
    rotation: Math.round((numAttr(childOf(spPr, 'xfrm'), 'rot') ?? 0) / 60000),
    fill: fillColor(spPr) ?? '#4472c4',
    stroke: strokeColor(spPr) ?? '#2f5597',
    strokeWidth: Math.round(emuToPx(numAttr(childOf(spPr, 'ln'), 'w') ?? 0) * 10) / 10,
    ...(text ? { text } : {}),
    z: index,
  };
}

/** `xdr:col` / `xdr:row` carry their value as element text, not as an attribute */
function nodeText(node: XmlNode | undefined, tag: string): string {
  return textOf(node ? childOf(node, tag) : undefined).trim();
}

/**
 * Read every `xdr:sp` of every sheet. Returns sheet **name** → shapes, so the caller can map back
 * to sheet ids (which only it knows).
 */
export async function parseSheetShapes(
  zip: JSZipType,
): Promise<Record<string, SheetShapeConfig[]>> {
  const out: Record<string, SheetShapeConfig[]> = {};
  const sheetParts = await resolveSheetParts(zip);
  for (const [sheetName, sheetPath] of Object.entries(sheetParts)) {
    const sheetRels = parseRelationships(await readText(zip, relsPathFor(sheetPath)));
    const drawingRel = sheetRels.find((item) => DRAWING_REL.test(item.type));
    if (!drawingRel) continue;
    const drawingPath = resolvePartPath(drawingRel.target, dirOf(sheetPath));
    if (!drawingPath) continue;
    const xml = await readText(zip, drawingPath);
    if (!xml || !xml.includes('<xdr:sp')) continue;

    const parsed = parser.parse(xml) as XmlNode[];
    const shapes: SheetShapeConfig[] = [];
    // `xdr:sp` may sit directly under the root or inside an anchor, so walk the whole tree
    for (const anchor of [
      ...collect(parsed, 'oneCellAnchor'),
      ...collect(parsed, 'twoCellAnchor'),
      ...collect(parsed, 'absoluteAnchor'),
    ]) {
      const shape = parseAnchor(anchor, shapes.length);
      if (shape) shapes.push(shape);
    }
    if (shapes.length > 0) out[sheetName] = shapes;
  }
  return out;
}

/** Buffer → sheet name → shapes (import entry point; a broken drawing never blocks the import) */
export async function collectSheetShapes(
  buffer: ArrayBuffer,
): Promise<Record<string, SheetShapeConfig[]>> {
  try {
    const JSZip = (await import('jszip')).default;
    const zip = await JSZip.loadAsync(buffer);
    return await parseSheetShapes(zip);
  } catch {
    return {};
  }
}
