import { pxToEmu } from '../../core/drawing/geometry';
import { escapeXml, geomXml } from '../../core/drawing/drawingml';
import { resolvePresetGeometry } from '../../core/drawing/shapeDefs';
import type { DocShapeAttrs } from './shapeNode';

/**
 * Shapes → `wps:wsp` (P3-1.3 export side, P3-1.4 text).
 *
 * `docx@9` exposes no raw-XML injection, so the shape is written in two passes:
 *
 * 1. the body traversal emits a paragraph whose only run is a `@@SHAPE:<id>@@` token;
 * 2. after `Packer.toBlob()` the zip is reopened, the token paragraph is replaced by the drawing
 *    element below, and the `wps` / `wp` / `a` namespaces are added to `w:document`.
 *
 * Everything here is deterministic string building: the same spec always produces the same XML,
 * which is what makes the unit tests able to assert structure instead of loose matches.
 */

/** Token wrapper: ASCII only, so no escaping/line-breaking can corrupt it */
const TOKEN_PREFIX = '@@SHAPE:';
const TOKEN_SUFFIX = '@@';

export function shapeToken(id: string): string {
  return `${TOKEN_PREFIX}${id}${TOKEN_SUFFIX}`;
}

export interface ShapeExportEntry {
  /** Unique per export; the token text is derived from it */
  id: string;
  /** 1-based export order: `wp:docPr@id` and `relativeHeight` are derived from it */
  index: number;
  /** Shape attributes read back from the DOM node */
  attrs: DocShapeAttrs;
  /** Optional explicit name (falls back to the prst name) */
  name?: string;
  /** Offset inside the content area, in px (floating anchors only) */
  offsetX?: number;
  offsetY?: number;
}

function hexOf(color: string): string {
  const value = color.replace(/^#/, '').trim();
  return /^[0-9a-fA-F]{6}$/.test(value) ? value.toUpperCase() : '4472C4';
}

function lineXml(spec: DocShapeAttrs): string {
  if (spec.strokeWidth <= 0) return '<a:ln><a:noFill/></a:ln>';
  const dash =
    spec.dash === 'dash'
      ? '<a:prstDash val="dash"/>'
      : spec.dash === 'dot'
        ? '<a:prstDash val="sysDot"/>'
        : '';
  return `<a:ln w="${pxToEmu(spec.strokeWidth)}"><a:solidFill><a:srgbClr val="${hexOf(
    spec.stroke,
  )}"/></a:solidFill>${dash}</a:ln>`;
}

/** `wps:txbx` for the shape's text (one run style per shape — see the panel's scope) */
function textBoxXml(spec: DocShapeAttrs): string {
  const text = spec.text.trim();
  if (!text) return '';
  const rPr = [
    '<w:rPr>',
    spec.textBold ? '<w:b/>' : '',
    spec.textItalic ? '<w:i/>' : '',
    spec.textUnderline ? '<w:u w:val="single"/>' : '',
    `<w:color w:val="${hexOf(spec.textColor)}"/>`,
    // `w:sz` is half-points; the panel edits px (1px = 0.75pt)
    `<w:sz w:val="${Math.round(spec.textSize * 1.5)}"/>`,
    '</w:rPr>',
  ].join('');
  const paragraphs = text
    .split('\n')
    .map(
      (line) =>
        `<w:p><w:pPr><w:jc w:val="${spec.textAlign}"/></w:pPr><w:r>${rPr}<w:t xml:space="preserve">${escapeXml(
          line,
        )}</w:t></w:r></w:p>`,
    )
    .join('');
  return `<wps:txbx><w:txbxContent>${paragraphs}</w:txbxContent></wps:txbx>`;
}

/** The `wps:wsp` body shared by inline and anchored drawings */
function wspXml(spec: DocShapeAttrs, name: string, id: number): string {
  const geometry = resolvePresetGeometry(spec.prst, spec.adj ?? undefined);
  const rotation = Math.round(spec.rotation * 60000);
  return [
    '<wps:wsp>',
    `<wps:cNvPr id="${id}" name="${escapeXml(name)}"/>`,
    '<wps:cNvSpPr/>',
    '<wps:spPr>',
    `<a:xfrm rot="${rotation}"><a:off x="0" y="0"/><a:ext cx="${pxToEmu(
      spec.width,
    )}" cy="${pxToEmu(spec.height)}"/></a:xfrm>`,
    geomXml(geometry),
    spec.fill ? `<a:solidFill><a:srgbClr val="${hexOf(spec.fill)}"/></a:solidFill>` : '<a:noFill/>',
    lineXml(spec),
    '</wps:spPr>',
    textBoxXml(spec),
    // Fixed size, no autofit: the editor and Word must agree on the box, otherwise text reflows
    '<wps:bodyPr rot="0" vert="horz" wrap="square" lIns="91440" tIns="45720" rIns="91440" bIns="45720" anchor="ctr"/>',
    '</wps:wsp>',
  ].join('');
}

function graphicXml(spec: DocShapeAttrs, name: string, id: number): string {
  return (
    '<a:graphic><a:graphicData uri="http://schemas.microsoft.com/office/word/2010/wordprocessingShape">' +
    wspXml(spec, name, id) +
    '</a:graphicData></a:graphic>'
  );
}

/** Full `w:drawing` for one shape: `wp:inline` or `wp:anchor`, depending on the anchor mode */
export function buildShapeDrawingXml(entry: ShapeExportEntry): string {
  const spec = entry.attrs;
  const docPrId = 100 + entry.index;
  const name = entry.name ?? `Shape ${docPrId}`;
  const extent = `<wp:extent cx="${pxToEmu(spec.width)}" cy="${pxToEmu(spec.height)}"/>`;
  const docPr = `<wp:docPr id="${docPrId}" name="${escapeXml(name)}"/>`;
  const graphic = graphicXml(spec, name, docPrId);

  if (spec.layer === 'inline') {
    return `<w:drawing><wp:inline>${extent}${docPr}${graphic}</wp:inline></w:drawing>`;
  }

  const offsetX = pxToEmu(entry.offsetX ?? spec.offsetX ?? 0);
  const offsetY = pxToEmu(entry.offsetY ?? spec.offsetY ?? 0);
  const behindDoc = spec.layer === 'behind' ? 1 : 0;
  const wrap =
    spec.layer === 'wrap-left'
      ? '<wp:wrapSquare wrapText="right"/>'
      : spec.layer === 'wrap-right'
        ? '<wp:wrapSquare wrapText="left"/>'
        : spec.layer === 'top-bottom'
          ? '<wp:wrapTopAndBottom/>'
          : '<wp:wrapNone/>';
  return [
    '<w:drawing>',
    `<wp:anchor distT="0" distB="0" distL="114300" distR="114300" simplePos="0" relativeHeight="${
      docPrId + 1
    }" behindDoc="${behindDoc}" locked="0" layoutInCell="1" allowOverlap="1">`,
    '<wp:simplePos x="0" y="0"/>',
    `<wp:positionH relativeFrom="column"><wp:posOffset>${offsetX}</wp:posOffset></wp:positionH>`,
    `<wp:positionV relativeFrom="paragraph"><wp:posOffset>${offsetY}</wp:posOffset></wp:positionV>`,
    extent,
    wrap,
    docPr,
    graphic,
    '</wp:anchor>',
    '</w:drawing>',
  ].join('');
}

/** Paragraph that carries the token in the docx-library output */
export function shapePlaceholderParagraphText(id: string): string {
  return shapeToken(id);
}

function lastParagraphStart(xml: string, before: number): number {
  const plain = xml.lastIndexOf('<w:p>', before);
  const attributed = xml.lastIndexOf('<w:p ', before);
  return Math.max(plain, attributed);
}

/**
 * Replace the paragraph that holds exactly one token with the drawing paragraph.
 * Returns the input unchanged when the token is missing (never throw: a lost shape is a fidelity
 * note, not a failed export).
 */
export function replaceTokenParagraph(xml: string, token: string, drawingXml: string): string {
  const marker = `>${token}<`;
  const textIndex = xml.indexOf(marker);
  if (textIndex < 0) return xml;
  const start = lastParagraphStart(xml, textIndex);
  const end = xml.indexOf('</w:p>', textIndex);
  if (start < 0 || end < 0) return xml;
  const endFull = end + '</w:p>'.length;
  // Guard: the paragraph must be the token's paragraph and nothing else, otherwise a user
  // paragraph that merely contains the token text would be gutted
  const inner = xml.slice(start, endFull);
  if (!inner.includes(marker)) return xml;
  if (inner.replace(/<[^>]*>/g, '').trim() !== token) return xml;
  return `${xml.slice(0, start)}<w:p><w:r>${drawingXml}</w:r></w:p>${xml.slice(endFull)}`;
}

const NAMESPACES: [string, string][] = [
  ['xmlns:wp', 'http://schemas.openxmlformats.org/drawingml/2006/wordprocessingDrawing'],
  ['xmlns:a', 'http://schemas.openxmlformats.org/drawingml/2006/main'],
  ['xmlns:wps', 'http://schemas.microsoft.com/office/word/2010/wordprocessingShape'],
  ['xmlns:mc', 'http://schemas.openxmlformats.org/markup-compatibility/2006'],
];

/** Add the DrawingML namespaces (and `wps` to `mc:Ignorable`) to the `w:document` root, once */
export function injectDocumentNamespaces(xml: string): string {
  const marker = '<w:document';
  const start = xml.indexOf(marker);
  if (start < 0) return xml;
  const end = xml.indexOf('>', start);
  if (end < 0) return xml;
  let tag = xml.slice(start, end);
  for (const [name, uri] of NAMESPACES) {
    if (!tag.includes(`${name}=`)) tag += ` ${name}="${uri}"`;
  }
  const ignorable = /mc:Ignorable="([^"]*)"/.exec(tag);
  if (ignorable) {
    const values = ignorable[1].split(/\s+/).filter(Boolean);
    if (!values.includes('wps')) {
      tag = tag.replace(ignorable[0], `mc:Ignorable="${[...values, 'wps'].join(' ')}"`);
    }
  } else {
    tag += ' mc:Ignorable="wps"';
  }
  return tag + xml.slice(end);
}

/** Blob → bytes; jsdom's Blob has no `arrayBuffer()`, so fall back to FileReader */
async function toArrayBuffer(blob: Blob): Promise<ArrayBuffer> {
  if (typeof blob.arrayBuffer === 'function') return blob.arrayBuffer();
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result as ArrayBuffer);
    reader.onerror = () => reject(reader.error);
    reader.readAsArrayBuffer(blob);
  });
}

/**
 * Inject every shape into `word/document.xml`. Returns the original blob when there is nothing to
 * inject, so documents without shapes stay byte-identical (existing exports are unaffected).
 */
export async function injectShapeDrawings(blob: Blob, entries: ShapeExportEntry[]): Promise<Blob> {
  if (entries.length === 0) return blob;
  const JSZip = (await import('jszip')).default;
  const zip = await JSZip.loadAsync(await toArrayBuffer(blob));
  const part = zip.file('word/document.xml');
  if (!part) return blob;

  let xml = await part.async('string');
  let changed = false;
  for (const entry of entries) {
    const next = replaceTokenParagraph(xml, shapeToken(entry.id), buildShapeDrawingXml(entry));
    if (next !== xml) changed = true;
    xml = next;
  }
  if (!changed) return blob;

  zip.file('word/document.xml', injectDocumentNamespaces(xml));
  const buffer = await zip.generateAsync({ type: 'arraybuffer', compression: 'DEFLATE' });
  return new Blob([buffer], {
    type: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  });
}
