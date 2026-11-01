import { XMLParser } from 'fast-xml-parser';
import type JSZipType from 'jszip';
import { emuToPx } from '../../core/drawing/geometry';
import { escapeXml } from '../../core/drawing/drawingml';
import {
  attr,
  childOf,
  childrenOf,
  localNameOf,
  numAttr,
  textOf,
  type XmlNode,
} from '../../core/drawing/xmlNode';
import type { SheetImageConfig } from './sheetImages';
import { imageDataUrl, mimeForExtension, parseImageDataUrl } from './sheetImages';
import {
  EMU_PER_PX,
  addContentTypeEntries,
  appendAnchorsToDrawing,
  buildDrawingXml,
  contentTypeOverride,
  insertDrawingIntoSheet,
  upsertRelationship,
} from './chartXml';
import { dirOf, parseRelationships, relsPathFor, resolveSheetParts } from './rawChartParts';
import { resolvePartPath } from './xlsx-normalize';

/**
 * `xdr:pic` round-trip for floating pictures (SHEET-02 剩余).
 *
 * 与形状是同一套 drawing 管道（复用 chartXml 的 helper：一个 sheet 只能有一个 `<drawing/>`，
 * 三层的 anchor 都往同一个 part 里追加），新增的只有两件事：
 * 1. media part：`xl/media/imageN.<ext>`，内容是 dataURL 里的 base64；
 * 2. content types 的 `<Default Extension=...>`（图片按扩展名登记，不像 XML part 那样逐 part Override）。
 *
 * 图片没有 rels 之外的依赖，所以导入时只要 drawing rels → media part 两级就能还原成 dataURL，
 * 快照因此可以自包含（不引用原文件路径）。
 */

const CT_DRAWING = 'application/vnd.openxmlformats-officedocument.drawing+xml';
const REL_DRAWING = 'http://schemas.openxmlformats.org/officeDocument/2006/relationships/drawing';
const REL_IMAGE = 'http://schemas.openxmlformats.org/officeDocument/2006/relationships/image';
const DRAWING_REL = /relationships\/drawing$/;
const MEDIA_PART = /^xl\/media\//;

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

export interface XlsxImagePlan {
  /** Sheet name → pictures to write (already ordered by z) */
  imagesBySheet: Record<string, SheetImageConfig[]>;
}

export interface ImagePlanSource {
  sheets?: Record<string, { name?: string } | undefined>;
  sheetOrder?: string[];
  syntoolsImages?: SheetImageConfig[];
}

/** Snapshot → which pictures go to which sheet (unknown sheet ids fall back to the first sheet) */
export function buildImagePlan(source: ImagePlanSource): XlsxImagePlan {
  const imagesBySheet: Record<string, SheetImageConfig[]> = {};
  const images = [...(source.syntoolsImages ?? [])].sort((a, b) => a.z - b.z);
  for (const image of images) {
    const fallbackId = (source.sheetOrder ?? [])[0];
    const sheetId = image.sheetId && source.sheets?.[image.sheetId] ? image.sheetId : fallbackId;
    const name = sheetId ? source.sheets?.[sheetId]?.name : undefined;
    if (!name) continue;
    (imagesBySheet[name] ??= []).push(image);
  }
  return { imagesBySheet };
}

/** `<xdr:pic>`; the blip references the drawing relationship created for its media part */
export function buildPictureElementXml(
  image: SheetImageConfig,
  picId: number,
  relId: string,
): string {
  const cx = Math.max(EMU_PER_PX, Math.round(image.width * EMU_PER_PX));
  const cy = Math.max(EMU_PER_PX, Math.round(image.height * EMU_PER_PX));
  return (
    '<xdr:pic>' +
    '<xdr:nvPicPr>' +
    `<xdr:cNvPr id="${picId}" name="Picture ${picId}" descr="${escapeXml(image.name)}"/>` +
    '<xdr:cNvPicPr><a:picLocks noChangeAspect="1"/></xdr:cNvPicPr>' +
    '</xdr:nvPicPr>' +
    `<xdr:blipFill><a:blip r:embed="${relId}"/><a:stretch><a:fillRect/></a:stretch></xdr:blipFill>` +
    '<xdr:spPr>' +
    `<a:xfrm><a:off x="0" y="0"/><a:ext cx="${cx}" cy="${cy}"/></a:xfrm>` +
    '<a:prstGeom prst="rect"><a:avLst/></a:prstGeom>' +
    '</xdr:spPr>' +
    '</xdr:pic>'
  );
}

export function buildPictureAnchorXml(
  image: SheetImageConfig,
  picId: number,
  relId: string,
): string {
  const cx = Math.max(EMU_PER_PX, Math.round(image.width * EMU_PER_PX));
  const cy = Math.max(EMU_PER_PX, Math.round(image.height * EMU_PER_PX));
  return (
    '<xdr:oneCellAnchor>' +
    `<xdr:from><xdr:col>${Math.max(0, Math.round(image.from.col))}</xdr:col>` +
    `<xdr:colOff>${Math.max(0, Math.round(image.from.colOff * EMU_PER_PX))}</xdr:colOff>` +
    `<xdr:row>${Math.max(0, Math.round(image.from.row))}</xdr:row>` +
    `<xdr:rowOff>${Math.max(0, Math.round(image.from.rowOff * EMU_PER_PX))}</xdr:rowOff></xdr:from>` +
    `<xdr:ext cx="${cx}" cy="${cy}"/>` +
    buildPictureElementXml(image, picId, relId) +
    '<xdr:clientData/>' +
    '</xdr:oneCellAnchor>'
  );
}

async function readText(zip: JSZipType, path: string): Promise<string | null> {
  const file = zip.file(path);
  return file ? file.async('string') : null;
}

/** Highest `cNvPr@id` already used in a drawing: new pictures must not reuse it */
function maxShapeId(drawingXml: string): number {
  let max = 1;
  for (const match of drawingXml.matchAll(/<xdr:cNvPr[^>]*\bid="(\d+)"/g)) {
    max = Math.max(max, Number(match[1]));
  }
  return max;
}

/** Highest `imageN` already in the package, so exported media never overwrite imported ones */
function nextMediaNumber(paths: readonly string[]): number {
  let max = 0;
  for (const path of paths) {
    const match = MEDIA_PART.test(path)
      ? /image(\d+)\./.exec(path.slice('xl/media/'.length))
      : null;
    if (match) max = Math.max(max, Number(match[1]));
  }
  return max + 1;
}

/**
 * Inject the pictures into the .xlsx produced by exceljs.
 * Run **after** charts and shapes: all three append anchors to the same per-sheet drawing part.
 */
export async function injectImagesIntoXlsx(
  buffer: ArrayBuffer,
  plan: XlsxImagePlan,
): Promise<ArrayBuffer> {
  const sheetNames = Object.keys(plan.imagesBySheet);
  if (sheetNames.length === 0) return buffer;

  const JSZip = (await import('jszip')).default;
  const zip = await JSZip.loadAsync(buffer);
  const sheetParts = await resolveSheetParts(zip);
  const contentTypeEntries: string[] = [];

  let nextDrawingNumber = 1;
  let mediaNumber = nextMediaNumber(Object.keys(zip.files));
  for (const path of Object.keys(zip.files)) {
    const drawing = /^xl\/drawings\/drawing(\d+)\.xml$/.exec(path);
    if (drawing) nextDrawingNumber = Math.max(nextDrawingNumber, Number(drawing[1]) + 1);
  }

  for (const sheetName of sheetNames) {
    const sheetPath = sheetParts[sheetName];
    if (!sheetPath) continue;
    const sheetXml = await readText(zip, sheetPath);
    if (sheetXml === null) continue;
    const images = plan.imagesBySheet[sheetName] ?? [];
    if (images.length === 0) continue;

    // a) the sheet's existing drawing (created by the chart/shape injection or kept from import)
    const sheetRelsPath = relsPathFor(sheetPath);
    const sheetRelsXml = await readText(zip, sheetRelsPath);
    const existingRel = parseRelationships(sheetRelsXml).find((item) =>
      DRAWING_REL.test(item.type),
    );
    const existingDrawingPath = existingRel
      ? resolvePartPath(existingRel.target, dirOf(sheetPath))
      : null;
    const createsDrawing = !existingDrawingPath || !zip.file(existingDrawingPath);
    const drawingPath = createsDrawing
      ? `xl/drawings/drawing${nextDrawingNumber}.xml`
      : existingDrawingPath;
    if (createsDrawing) nextDrawingNumber += 1;

    // b) media part + drawing relationship + anchor, one relationship per picture.
    // The drawing part itself is only written when at least one picture survived (see below),
    // so a file whose pictures all failed to parse leaves no empty drawing behind.
    const drawingRelsPath = relsPathFor(drawingPath);
    let drawingRelsXml = await readText(zip, drawingRelsPath);
    const drawingXml = (await readText(zip, drawingPath)) ?? buildDrawingXml('');
    const startId = maxShapeId(drawingXml) + 1;
    const anchors: string[] = [];

    images.forEach((image, index) => {
      const binary = parseImageDataUrl(image.src);
      if (!binary) return; // dataURL 坏了就跳过这张，不要写出空图片
      const mediaPath = `xl/media/image${mediaNumber}.${binary.extension}`;
      mediaNumber += 1;
      zip.file(mediaPath, binary.base64, { base64: true });
      contentTypeEntries.push(
        `<Default Extension="${binary.extension}" ContentType="${binary.mime}"/>`,
      );
      const rel = upsertRelationship(
        drawingRelsXml,
        REL_IMAGE,
        `../media/${mediaPath.slice('xl/media/'.length)}`,
      );
      drawingRelsXml = rel.xml;
      anchors.push(buildPictureAnchorXml(image, startId + index, rel.id));
    });

    if (anchors.length === 0) continue;
    if (createsDrawing) {
      contentTypeEntries.push(contentTypeOverride(`/${drawingPath}`, CT_DRAWING));
    }
    zip.file(drawingPath, appendAnchorsToDrawing(drawingXml, anchors.join('')));
    if (drawingRelsXml) zip.file(drawingRelsPath, drawingRelsXml);

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

/** `xdr:col` / `xdr:row` carry their value as element text, not as an attribute */
function nodeText(node: XmlNode | undefined, tag: string): string {
  return textOf(node ? childOf(node, tag) : undefined).trim();
}

/** 收集器：把"已经转成 config 的 anchor"的 cNvPr id 报给调用方，用于从保留的 drawing 里摘掉 */
export type ConvertedAnchorSink = (sheetName: string, anchorId: string) => void;

async function readMediaDataUrl(
  zip: JSZipType,
  drawingRelsPath: string,
  relId: string,
): Promise<string | null> {
  const relsXml = await readText(zip, drawingRelsPath);
  const rel = parseRelationships(relsXml).find((item) => item.id === relId);
  if (!rel) return null;
  // `xl/drawings/_rels/drawing1.xml.rels` 的关系目标相对 `xl/drawings/`，不是相对 `_rels/`
  const partDir = drawingRelsPath.replace(/\/_rels\/[^/]+$/, '/');
  const mediaPath = resolvePartPath(rel.target, partDir);
  if (!mediaPath) return null;
  const file = zip.file(mediaPath);
  if (!file) return null;
  const extension = /\.([^./]+)$/.exec(mediaPath)?.[1] ?? 'png';
  const mime = mimeForExtension(extension);
  if (!mime) return null;
  const base64 = await file.async('base64');
  return base64 ? imageDataUrl(mime, base64) : null;
}

/** One anchor holding an `xdr:pic` → image config (needs the drawing rels to resolve the media) */
async function parsePictureAnchor(
  node: XmlNode,
  index: number,
  zip: JSZipType,
  drawingRelsPath: string,
): Promise<SheetImageConfig | null> {
  const from = childOf(node, 'from');
  const pic = childOf(node, 'pic');
  if (!from || !pic) return null;

  const blipFill = childOf(pic, 'blipFill');
  const relId = attr(childOf(blipFill, 'blip'), 'r:embed');
  if (!relId) return null;
  const src = await readMediaDataUrl(zip, drawingRelsPath, relId);
  if (!src) return null;

  const spPr = childOf(pic, 'spPr');
  const ext = childOf(node, 'ext');
  const xfrmExt = childOf(childOf(spPr, 'xfrm'), 'ext');
  const cx = numAttr(ext, 'cx') ?? numAttr(xfrmExt, 'cx') ?? 0;
  const cy = numAttr(ext, 'cy') ?? numAttr(xfrmExt, 'cy') ?? 0;
  if (!cx || !cy) return null;

  const cNvPr = childOf(childOf(pic, 'nvPicPr'), 'cNvPr');
  const name = attr(cNvPr, 'descr') || attr(cNvPr, 'name') || `image ${index + 1}`;

  return {
    id: `image-import-${index + 1}`,
    from: {
      col: Math.max(0, Math.round(Number(nodeText(from, 'col')) || 0)),
      row: Math.max(0, Math.round(Number(nodeText(from, 'row')) || 0)),
      colOff: Math.round(emuToPx(Number(nodeText(from, 'colOff')) || 0)),
      rowOff: Math.round(emuToPx(Number(nodeText(from, 'rowOff')) || 0)),
    },
    width: emuToPx(cx),
    height: emuToPx(cy),
    src,
    name,
    z: index,
  };
}

/**
 * Read every `xdr:pic` of every sheet. Returns sheet **name** → images, so the caller can map back
 * to sheet ids (which only it knows).
 */
export async function parseSheetImages(
  zip: JSZipType,
  onConverted?: ConvertedAnchorSink,
): Promise<Record<string, SheetImageConfig[]>> {
  const out: Record<string, SheetImageConfig[]> = {};
  const sheetParts = await resolveSheetParts(zip);
  for (const [sheetName, sheetPath] of Object.entries(sheetParts)) {
    const sheetRels = parseRelationships(await readText(zip, relsPathFor(sheetPath)));
    const drawingRel = sheetRels.find((item) => DRAWING_REL.test(item.type));
    if (!drawingRel) continue;
    const drawingPath = resolvePartPath(drawingRel.target, dirOf(sheetPath));
    if (!drawingPath) continue;
    const xml = await readText(zip, drawingPath);
    if (!xml || !xml.includes('<xdr:pic')) continue;

    const drawingRelsPath = relsPathFor(drawingPath);
    const parsed = parser.parse(xml) as XmlNode[];
    const images: SheetImageConfig[] = [];
    for (const anchor of [
      ...collect(parsed, 'oneCellAnchor'),
      ...collect(parsed, 'twoCellAnchor'),
      ...collect(parsed, 'absoluteAnchor'),
    ]) {
      const image = await parsePictureAnchor(anchor, images.length, zip, drawingRelsPath);
      if (!image) continue;
      images.push(image);
      const cNvPr = childOf(childOf(childOf(anchor, 'pic'), 'nvPicPr'), 'cNvPr');
      const anchorId = attr(cNvPr, 'id');
      if (anchorId) onConverted?.(sheetName, anchorId);
    }
    if (images.length > 0) out[sheetName] = images;
  }
  return out;
}

/** Buffer → sheet name → images (import entry point; a broken drawing never blocks the import) */
export async function collectSheetImages(
  buffer: ArrayBuffer,
  onConverted?: ConvertedAnchorSink,
): Promise<Record<string, SheetImageConfig[]>> {
  try {
    const JSZip = (await import('jszip')).default;
    const zip = await JSZip.loadAsync(buffer);
    return await parseSheetImages(zip, onConverted);
  } catch {
    return {};
  }
}
