import type { ToolResult } from '@/core/types';
import JSZip from 'jszip';
import { emuToPx, ptToPx, pxToEmu } from '../../../core/drawing/geometry';
import { createDoc, createId, SCHEMA_VERSION } from '../model/factory';
import { withResolvedConnectors } from '../model/connectors';
import { createMediaFromBytes, mimeFromFilename } from '../model/media';
import { normalizeChartData } from '../model/chart';
import type {
  ChartElement,
  ChartOptions,
  ChartSeries,
  ChartType,
  Fill,
  ImageElement,
  LineElement,
  MediaAsset,
  Paragraph,
  RunStyle,
  ShapeElement,
  SlideDoc,
  SlideElement,
  SlideLayout,
  SlideMaster,
  SlideTheme,
  Stroke,
  TableCell,
  TableElement,
  TextAlign,
  TextBody,
  TextElement,
  TextVert,
  VAlign,
} from '../model/types';
import type { ImportReport } from '../store';
import { parseSlideMotion } from './timingImport';
import {
  parseGlow,
  parseInnerShadow,
  parseShadow,
  parseSoftEdge,
  parseShapeFill,
  parseStroke,
  resolveColorNode,
  type Palette,
} from './color';
import {
  loadZip,
  normalizePartPath,
  readBinaryPart,
  readRels,
  readTextPart,
  readXfrm,
  type Relationship,
  type Xfrm,
} from './opc';
import { parseBackgroundColor, parseTheme } from './theme';
// P3-1.0: geometry reading is shared with the docx/xlsx shape layers
import { parseShapeGeometry } from '../../../core/drawing/drawingml';
import {
  attr,
  boolAttr,
  childOf,
  childrenNamed,
  childrenOf,
  collect,
  localNameOf,
  numAttr,
  parseXml,
  textOf,
  type XmlNode,
} from './xml';

/** PPTX import: OPC unpacking → DrawingML parsing → SlideDoc (unsupported elements degrade to placeholder boxes) */

export const MAX_IMPORT_BYTES = 50 * 1024 * 1024;

export type SlideImportErrorCode =
  'EMPTY' | 'NOT_PPTX' | 'UNSUPPORTED_LEGACY_PPT' | 'TOO_LARGE' | 'IMPORT_FAILED';

export type ImportKind = 'pptx' | 'legacy-ppt' | 'unsupported';

export function resolveImportKind(filename: string): ImportKind {
  const lower = filename.trim().toLowerCase();
  if (lower.endsWith('.pptx') || lower.endsWith('.pptm')) return 'pptx';
  if (lower.endsWith('.ppt') || lower.endsWith('.dps') || lower.endsWith('.key'))
    return 'legacy-ppt';
  return 'unsupported';
}

export function checkImportFile(file: { name: string; size: number }): ToolResult<void> {
  const kind = resolveImportKind(file.name);
  if (kind === 'legacy-ppt') return { ok: false, error: 'UNSUPPORTED_LEGACY_PPT' };
  if (kind !== 'pptx') return { ok: false, error: 'NOT_PPTX' };
  if (file.size > MAX_IMPORT_BYTES) {
    return {
      ok: false,
      error: 'TOO_LARGE',
      params: { max: Math.round(MAX_IMPORT_BYTES / 1024 / 1024) },
    };
  }
  return { ok: true, value: undefined };
}

/** Placeholder geometry (page coordinates, px) */
type Rect = { x: number; y: number; width: number; height: number };

interface ImportContext {
  zip: JSZip;
  media: Record<string, MediaAsset>;
  mediaByPart: Map<string, string>;
  seq: number;
  placeholders: number;
  skipped: Set<string>;
  /** Placeholder geometry of the current layout (master included as fallback), inherited by slide placeholders without an xfrm */
  layoutPlaceholders: Map<string, Rect>;
  /** DrawingML shape id (cNvPr@id) → imported element id, so connectors can resolve stCxn/endCxn */
  shapeIdMap: Map<string, string>;
  /** Connectors whose bindings are resolved once the whole spTree has been parsed */
  connectorRefs: {
    element: LineElement;
    start?: { id: string; site?: number };
    end?: { id: string; site?: number };
  }[];
  /** Relationships of the part being parsed: hyperlinks live in a rel (`r:id`), not inline */
  rels: Map<string, Relationship>;
}

function nextId(ctx: ImportContext, prefix: string): string {
  ctx.seq += 1;
  return `${prefix}_${ctx.seq}`;
}

/** Theme reference such as '+mj-lt' → real font name */
function resolveTypeface(raw: string | undefined, theme: SlideTheme): string | undefined {
  if (!raw) return undefined;
  const map: Record<string, string | undefined> = {
    '+mj-lt': theme.majorFont.latin,
    '+mj-ea': theme.majorFont.ea,
    '+mj-cs': theme.majorFont.cs,
    '+mn-lt': theme.minorFont.latin,
    '+mn-ea': theme.minorFont.ea,
    '+mn-cs': theme.minorFont.cs,
  };
  return map[raw] ?? raw;
}

function emuPx(value: number | undefined): number {
  return value === undefined ? 0 : emuToPx(value);
}

/** `nv…Pr/cNvPr` of an element (the node carrying its name, hyperlink and DrawingML id) */
function cNvPrOf(node: XmlNode, nvTag: string): XmlNode | undefined {
  return childOf(childOf(node, nvTag), 'cNvPr');
}

/** Element name from `cNvPr/@name`; PowerPoint fills this in for every object */
function nameOf(node: XmlNode, nvTag: string): string | undefined {
  const name = attr(cNvPrOf(node, nvTag), 'name');
  return name && name.trim() ? name.trim() : undefined;
}

/**
 * `cNvPr/@hidden="1"`: the object still exists in the file but isn't painted.
 * Importing it as visible flipped hidden helper objects into the deck on the first save.
 */
function hiddenOf(node: XmlNode, nvTag: string): boolean {
  return boolAttr(cNvPrOf(node, nvTag), 'hidden');
}

/**
 * `a:hlinkClick/@r:id` → URL.
 *
 * Hyperlinks are OPC relationships (`TargetMode="External"`); internal jump links use
 * `action="ppaction://..."` with no relationship and are skipped (no URL to open).
 */
function hyperlinkOf(node: XmlNode | undefined, ctx: ImportContext): string | undefined {
  const rId = attr(childOf(node, 'hlinkClick'), 'r:id');
  if (!rId) return undefined;
  const rel = ctx.rels.get(rId);
  if (!rel || !rel.external) return undefined;
  const url = rel.target.trim();
  return url.length > 0 ? url : undefined;
}

/** rPr → RunStyle */
function parseRunStyle(
  node: XmlNode | undefined,
  palette: Palette,
  theme: SlideTheme,
  ctx: ImportContext,
): RunStyle | undefined {
  if (!node) return undefined;
  const style: RunStyle = {};
  const size = numAttr(node, 'sz');
  if (size !== undefined) style.size = size / 100;
  // Latin text is written to a:latin, but CJK decks frequently set only a:ea (or a:cs); falling back
  // keeps the run's typeface instead of silently resetting it to the theme font
  const typeface =
    attr(childOf(node, 'latin'), 'typeface') ??
    attr(childOf(node, 'ea'), 'typeface') ??
    attr(childOf(node, 'cs'), 'typeface');
  const font = resolveTypeface(typeface, theme);
  if (font) style.font = font;
  const resolved = resolveColorNode(childOf(node, 'solidFill'), palette);
  if (resolved) style.color = resolved.color;
  if (attr(node, 'b') === '1') style.bold = true;
  if (attr(node, 'i') === '1') style.italic = true;
  // Any underline style (sng / dbl / heavy / dotted …) collapses onto the model's boolean flag
  const underline = attr(node, 'u');
  if (underline && underline !== 'none') style.underline = true;
  const strike = attr(node, 'strike');
  if (strike && strike !== 'noStrike') style.strike = true;
  // `a:spc` is letter spacing in 1/100 pt; the model stores points
  const spacing = numAttr(node, 'spc');
  if (spacing !== undefined) style.spacing = spacing / 100;
  // `a:baseline` is an ST_Percentage (30000 = 30%); the model keeps the same units
  const baseline = numAttr(node, 'baseline');
  if (baseline !== undefined && baseline !== 0) style.baseline = baseline;
  // `a:highlight` is a colour container, same shape as a:solidFill
  const highlight = resolveColorNode(childOf(node, 'highlight'), palette);
  if (highlight) style.highlight = highlight.color;
  // Run hyperlinks used to be dropped, so every imported link became plain text
  const link = hyperlinkOf(node, ctx);
  if (link) style.hyperlink = link;
  return Object.keys(style).length > 0 ? style : undefined;
}

const ALIGN_MAP: Record<string, TextAlign> = {
  l: 'left',
  ctr: 'center',
  r: 'right',
  just: 'justify',
};

const ANCHOR_MAP: Record<string, VAlign> = {
  t: 'top',
  ctr: 'middle',
  b: 'bottom',
};

/** a:bodyPr/@vert values the model can render (eaVert / mongolianVert have no renderer support) */
const TEXT_VERT_VALUES = new Set(['horz', 'vert', 'vert270', 'wordArtVert']);

/** p:txBody → TextBody; returns undefined when there is no visible text */
function parseTextBody(
  node: XmlNode | undefined,
  palette: Palette,
  theme: SlideTheme,
  ctx: ImportContext,
): TextBody | undefined {
  if (!node) return undefined;
  const paragraphs: Paragraph[] = [];
  for (const pNode of childrenNamed(node, 'p')) {
    const pPr = childOf(pNode, 'pPr');
    const runs = [];
    for (const item of childrenOf(pNode)) {
      const kind = localNameOf(item);
      if (kind === 'r') {
        const text = textOf(childOf(item, 't'));
        runs.push({ text, style: parseRunStyle(childOf(item, 'rPr'), palette, theme, ctx) });
      } else if (kind === 'fld') {
        // Field (slide number / date / slide index): structured like a:r (rPr + t),
        // previously skipped wholesale, so content like "slide X" silently disappeared
        const text = textOf(childOf(item, 't'));
        runs.push({ text, style: parseRunStyle(childOf(item, 'rPr'), palette, theme, ctx) });
      } else if (kind === 'br') {
        runs.push({ text: '\n' });
      }
    }
    // a:lnSpc/a:spcPct and a:spcBef/a:spcPts sit one level deeper than pPr — reading the
    // wrapper node directly always yielded undefined, so line spacing / paragraph spacing never
    // survived an import
    const lineSpacingPct = numAttr(childOf(childOf(pPr, 'lnSpc'), 'spcPct'), 'val');
    const spaceBef = numAttr(childOf(childOf(pPr, 'spcBef'), 'spcPts'), 'val');
    const spaceAft = numAttr(childOf(childOf(pPr, 'spcAft'), 'spcPts'), 'val');
    paragraphs.push({
      runs: runs.length > 0 ? runs : [{ text: '' }],
      align: ALIGN_MAP[attr(pPr, 'algn') ?? ''] ?? 'left',
      bullet: Boolean(childOf(pPr, 'buChar')),
      // buAutoNum is "auto numbering"; it used to be treated as a bullet, turning 1./2. into •
      numbering: Boolean(childOf(pPr, 'buAutoNum')),
      // spcPct is in 1/1000 of a percent (100000 = 100%); the model stores a multiplier
      lineSpacing: lineSpacingPct ? lineSpacingPct / 100000 : undefined,
      // spcPts is in 1/100 pt while the model stores canvas px
      spaceBefore: spaceBef === undefined ? undefined : ptToPx(spaceBef / 100),
      spaceAfter: spaceAft === undefined ? undefined : ptToPx(spaceAft / 100),
      indent: numAttr(pPr, 'marL') === undefined ? undefined : emuPx(numAttr(pPr, 'marL')),
    });
  }
  if (paragraphs.length === 0) return undefined;
  const hasVisibleText = paragraphs.some((paragraph) =>
    paragraph.runs.some((run) => run.text.trim().length > 0),
  );
  if (!hasVisibleText) return undefined;

  const bodyPr = childOf(node, 'bodyPr');
  const margin = (name: string, fallbackEmu: number) => emuPx(numAttr(bodyPr, name) ?? fallbackEmu);
  // a:normAutofit / a:spAutoFit are child elements — there is no `autoFit` attribute on a:bodyPr,
  // so the old attribute lookup always produced 'none'
  const autoFit =
    childOf(bodyPr, 'normAutofit') || childOf(bodyPr, 'spAutoFit') ? 'autofit' : 'none';
  const vertRaw = attr(bodyPr, 'vert');
  const vert = vertRaw && TEXT_VERT_VALUES.has(vertRaw) ? (vertRaw as TextVert) : undefined;
  return {
    paragraphs,
    anchor: ANCHOR_MAP[attr(bodyPr, 'anchor') ?? ''] ?? 'top',
    wrap: attr(bodyPr, 'wrap') !== 'none',
    autoFit,
    margins: {
      left: margin('lIns', 91440),
      top: margin('tIns', 45720),
      right: margin('rIns', 91440),
      bottom: margin('bIns', 45720),
    },
    ...(vert ? { vert } : {}),
  };
}

function fillFromParsed(parsed: ReturnType<typeof parseShapeFill>): Fill | undefined {
  if (parsed.type === 'solid' && parsed.color) {
    return parsed.alpha === undefined
      ? { type: 'solid', color: parsed.color }
      : { type: 'solid', color: parsed.color, alpha: parsed.alpha };
  }
  if (parsed.type === 'gradient' && parsed.stops) {
    return { type: 'gradient', stops: parsed.stops, angle: parsed.angle };
  }
  return undefined;
}

function baseRect(xfrm: Xfrm | undefined) {
  return {
    x: emuPx(xfrm?.x),
    y: emuPx(xfrm?.y),
    width: emuPx(xfrm?.width),
    height: emuPx(xfrm?.height),
    rotation: xfrm?.rotation === undefined ? undefined : xfrm.rotation / 60000,
    flipX: xfrm?.flipX,
    flipY: xfrm?.flipY,
  };
}

/** p:sp → TextElement / ShapeElement */
function parseShape(
  node: XmlNode,
  ctx: ImportContext,
  palette: Palette,
  theme: SlideTheme,
): SlideElement | undefined {
  const spPr = childOf(node, 'spPr');
  const xfrm = readXfrm(childOf(spPr, 'xfrm'));
  const geometry = parseShapeGeometry(spPr);
  const fill = fillFromParsed(parseShapeFill(spPr, palette));
  const stroke = parseStroke(childOf(spPr, 'ln'), palette);
  const shadow = parseShadow(spPr, palette);
  const glow = parseGlow(spPr, palette);
  const softEdge = parseSoftEdge(spPr);
  const innerShadow = parseInnerShadow(spPr, palette);
  const body = parseTextBody(childOf(node, 'txBody'), palette, theme, ctx);
  const nvSpPr = childOf(node, 'nvSpPr');
  const ph = childOf(childOf(nvSpPr, 'nvPr'), 'ph');
  const placeholder = ph ? { kind: attr(ph, 'type') ?? 'body', index: attr(ph, 'idx') } : undefined;
  const name = nameOf(node, 'nvSpPr');
  const hyperlink = hyperlinkOf(childOf(nvSpPr, 'cNvPr'), ctx);

  // Without its own geometry, keep baseRect's zero size; mergeInheritedGeometry fills it from the layout later
  const base = {
    id: nextId(ctx, 'el'),
    ...baseRect(xfrm),
    placeholder,
    ...(name ? { name } : {}),
    ...(hyperlink ? { hyperlink } : {}),
    ...(hiddenOf(node, 'nvSpPr') ? { visible: false } : {}),
    ...(shadow ? { shadow } : {}),
    ...(glow ? { glow } : {}),
    ...(softEdge ? { softEdge } : {}),
    ...(innerShadow ? { innerShadow } : {}),
  };
  let element: SlideElement;
  if (body && geometry.kind === 'rect' && !fill && !stroke) {
    // A rounded text box is written as prstGeom roundRect + adj1, so the corner radius has to be
    // reconstructed from the adjustment value (adj1 is a fraction of the shorter side)
    const roundRadius = geometry.prst === 'roundRect' ? (geometry.adj?.adj1 ?? 0.167) : 0;
    const cornerRadius =
      roundRadius > 0 ? Math.round(roundRadius * Math.min(base.width, base.height)) : 0;
    element = {
      type: 'text',
      ...base,
      body,
      ...(cornerRadius > 0 ? { cornerRadius } : {}),
    } satisfies TextElement;
  } else if (body) {
    const shape: ShapeElement = { type: 'shape', ...base, geom: geometry, body };
    if (fill) shape.fill = fill;
    if (stroke) shape.stroke = stroke;
    element = shape;
  } else {
    const shape: ShapeElement = { type: 'shape', ...base, geom: geometry };
    if (fill) shape.fill = fill;
    if (stroke) shape.stroke = stroke;
    element = shape;
  }
  // Remember cNvPr@id so p:cxnSp's stCxn/endCxn can be resolved after the whole tree is parsed
  const shapeRef = attr(childOf(nvSpPr, 'cNvPr'), 'id');
  if (shapeRef) ctx.shapeIdMap.set(shapeRef, element.id);
  return element;
}

/** p:pic → ImageElement */
async function parsePicture(
  node: XmlNode,
  ctx: ImportContext,
  slidePart: string,
  rels: Map<string, Relationship>,
  palette: Palette,
): Promise<SlideElement | undefined> {
  const spPr = childOf(node, 'spPr');
  const xfrm = readXfrm(childOf(spPr, 'xfrm'));
  const blipFill = childOf(node, 'blipFill');
  const blip = childOf(blipFill, 'blip');
  const embed = attr(blip, 'embed') ?? attr(blip, 'link');
  const mediaId = embed ? await ensureMedia(ctx, slidePart, embed, rels) : undefined;
  // Picture transparency lives on the blip; without it a faded image came back fully opaque
  const alphaAmt = numAttr(childOf(blip, 'alphaModFix'), 'amt');
  const opacity = alphaAmt === undefined ? undefined : Math.min(1, Math.max(0, alphaAmt / 100000));
  const name = nameOf(node, 'nvPicPr');
  const hyperlink = hyperlinkOf(cNvPrOf(node, 'nvPicPr'), ctx);
  // Pictures can carry a frame line and a rounding radius too; both were dropped on import
  const stroke = parseStroke(childOf(spPr, 'ln'), palette);
  const pictureGeom = parseShapeGeometry(spPr);
  const roundAdj = pictureGeom.prst === 'roundRect' ? (pictureGeom.adj?.adj1 ?? 0.167) : 0;
  const cornerRadius =
    roundAdj > 0 ? Math.round(roundAdj * Math.min(emuPx(xfrm?.width), emuPx(xfrm?.height))) : 0;

  const srcRect = childOf(blipFill, 'srcRect');
  const crop =
    srcRect &&
    (numAttr(srcRect, 'l') !== undefined ||
      numAttr(srcRect, 't') !== undefined ||
      numAttr(srcRect, 'r') !== undefined ||
      numAttr(srcRect, 'b') !== undefined)
      ? {
          left: (numAttr(srcRect, 'l') ?? 0) / 100000,
          top: (numAttr(srcRect, 't') ?? 0) / 100000,
          right: (numAttr(srcRect, 'r') ?? 0) / 100000,
          bottom: (numAttr(srcRect, 'b') ?? 0) / 100000,
        }
      : undefined;

  const element: SlideElement = {
    id: nextId(ctx, 'el'),
    type: 'image',
    ...baseRect(xfrm),
    mediaId: mediaId ?? '',
    ...(crop ? { crop } : {}),
    ...(opacity !== undefined && opacity < 1 ? { opacity } : {}),
    ...(cornerRadius > 0 ? { cornerRadius } : {}),
    ...(stroke ? { stroke } : {}),
    ...(name ? { name } : {}),
    ...(hyperlink ? { hyperlink } : {}),
    ...(hiddenOf(node, 'nvPicPr') ? { visible: false } : {}),
  } as ImageElement;
  if (!mediaId) {
    ctx.skipped.add('image');
    return withPlaceholderFallback(element, '图片');
  }
  return element;
}

function withPlaceholderFallback(element: SlideElement, label: string): SlideElement {
  return {
    id: element.id,
    type: 'placeholder',
    x: element.x,
    y: element.y,
    width: element.width,
    height: element.height,
    rotation: element.rotation,
    sourceKind: element.type,
    label,
  };
}

/** a:headEnd/a:tailEnd @type → ArrowKind */
function parseArrowKind(value: string | undefined): LineElement['head'] {
  if (!value || value === 'none') return undefined;
  if (
    value === 'arrow' ||
    value === 'triangle' ||
    value === 'diamond' ||
    value === 'oval' ||
    value === 'stealth'
  ) {
    return value;
  }
  return undefined;
}

/** p:cxnSp → LineElement */
function parseConnector(
  node: XmlNode,
  ctx: ImportContext,
  palette: Palette,
): SlideElement | undefined {
  const spPr = childOf(node, 'spPr');
  const xfrm = readXfrm(childOf(spPr, 'xfrm'));
  if (!xfrm) return undefined;
  const ln = childOf(spPr, 'ln');
  const stroke = parseStroke(ln, palette);
  const defaultStroke: Stroke = { color: '#000000', width: 1 };
  const element: LineElement = {
    id: nextId(ctx, 'el'),
    type: 'line',
    x: emuPx(xfrm.x),
    y: emuPx(xfrm.y),
    width: emuPx(xfrm.width),
    height: emuPx(xfrm.height),
    rotation: xfrm.rotation === undefined ? undefined : xfrm.rotation / 60000,
    flipX: xfrm.flipX,
    flipY: xfrm.flipY,
    points: [
      0,
      0,
      emuPx(xfrm.width) * (xfrm.flipX ? -1 : 1),
      emuPx(xfrm.height) * (xfrm.flipY ? -1 : 1),
    ],
    stroke: stroke ?? defaultStroke,
  };
  // Elbow connectors carry a bentConnector / curvedConnector preset; without it the model would
  // treat every connector as a straight line and re-export it as one
  const prst = attr(childOf(spPr, 'prstGeom') ?? childOf(spPr, 'geom'), 'prst') ?? '';
  if (/^(bentConnector|curvedConnector)/.test(prst)) element.route = 'elbow';
  const name = nameOf(node, 'nvCxnSpPr');
  if (name) element.name = name;
  if (hiddenOf(node, 'nvCxnSpPr')) element.visible = false;
  const head = parseArrowKind(attr(childOf(ln, 'headEnd'), 'type'));
  const tail = parseArrowKind(attr(childOf(ln, 'tailEnd'), 'type'));
  if (head) element.head = head;
  if (tail) element.tail = tail;

  const cxnPr = childOf(childOf(node, 'nvCxnSpPr'), 'cNvCxnSpPr');
  const readRef = (tag: string): { id: string; site?: number } | undefined => {
    const ref = childOf(cxnPr, tag);
    const id = attr(ref, 'id');
    if (!id) return undefined;
    const idx = numAttr(ref, 'idx');
    return { id, site: idx === undefined ? undefined : Math.round(idx) };
  };
  const start = readRef('stCxn');
  const end = readRef('endCxn');
  if (start || end) {
    ctx.connectorRefs.push({ element, start, end });
  }
  return element;
}

/** a:tbl → the cell part of a TableElement */
function parseTableCells(
  node: XmlNode,
  palette: Palette,
  theme: SlideTheme,
  ctx: ImportContext,
): TableCell[][] {
  const rows: TableCell[][] = [];
  for (const trNode of childrenNamed(node, 'tr')) {
    const row: TableCell[] = [];
    for (const tcNode of childrenNamed(trNode, 'tc')) {
      const tcPr = childOf(tcNode, 'tcPr');
      const body = parseTextBody(childOf(tcNode, 'txBody'), palette, theme, ctx);
      const text = body?.paragraphs.map((p) => p.runs.map((r) => r.text).join('')).join('\n') ?? '';
      const fill = fillFromParsed(parseShapeFill(tcPr, palette));
      const style = body?.paragraphs[0]?.runs[0]?.style;
      row.push({
        text,
        fill: fill && fill.type === 'solid' ? fill.color : undefined,
        color: style?.color,
        bold: style?.bold,
        size: style?.size,
        align: body?.paragraphs[0]?.align,
        valign: ANCHOR_MAP[attr(tcPr, 'anchor') ?? ''] ?? 'middle',
        colSpan: numAttr(tcNode, 'gridSpan'),
        rowSpan: numAttr(tcNode, 'rowSpan'),
        // hMerge / vMerge mark this cell as covered by the top-left merged cell, so it isn't painted
        ...(boolAttr(tcNode, 'hMerge') || boolAttr(tcNode, 'vMerge')
          ? {
              covered: true,
              coveredBy: (boolAttr(tcNode, 'hMerge') ? 'h' : 'v') as 'h' | 'v',
            }
          : {}),
      });
    }
    rows.push(row);
  }
  return rows;
}

/**
 * Table border colour. The model keeps a single colour for the whole table, so it is read from the
 * first cell's left/top border (our own writer emits all four edges with the same colour).
 */
function tableBorderColorOf(node: XmlNode, palette: Palette): string | undefined {
  const firstCell = childrenNamed(childrenNamed(node, 'tr')[0], 'tc')[0];
  const tcPr = childOf(firstCell, 'tcPr');
  const line = childOf(tcPr, 'lnL') ?? childOf(tcPr, 'lnR') ?? childOf(tcPr, 'lnT');
  return resolveColorNode(childOf(line, 'solidFill'), palette)?.color;
}

function parseTable(
  node: XmlNode,
  ctx: ImportContext,
  xfrm: Xfrm | undefined,
  palette: Palette,
  theme: SlideTheme,
): SlideElement {
  // Column widths live under a:tblGrid; a few third-party generators omit tblGrid, so accept direct children too
  const gridNode = childOf(node, 'tblGrid') ?? node;
  const cols = childrenNamed(gridNode, 'gridCol');
  const tblPr = childOf(node, 'tblPr');
  const colWidths = cols.map((col) => emuPx(numAttr(col, 'w')) || 100);
  const rows = parseTableCells(node, palette, theme, ctx);
  const rectWidth = emuPx(xfrm?.width) || colWidths.reduce((a, b) => a + b, 0);
  const rectHeight = emuPx(xfrm?.height) || rows.length * 32;
  const rowHeights = childrenNamed(node, 'tr').map(
    (tr) => emuPx(numAttr(tr, 'h')) || Math.round(rectHeight / Math.max(1, rows.length)),
  );
  const element: TableElement = {
    id: nextId(ctx, 'el'),
    type: 'table',
    ...baseRect(xfrm),
    width: rectWidth,
    height: rectHeight,
    rows,
    colWidths: colWidths.length > 0 ? colWidths : (rows[0]?.map(() => 100) ?? []),
    rowHeights: rowHeights.length > 0 ? rowHeights : rows.map(() => 32),
    // firstRow / bandRow on a:tblPr decide header and banding; they used to be dropped, changing the look after import
    headerRow: tblPr ? boolAttr(tblPr, 'firstRow') : true,
    bandRow: tblPr ? boolAttr(tblPr, 'bandRow') : false,
    // Previously hardcoded: an imported table lost its border colour and re-exported gray
    borderColor: tableBorderColorOf(node, palette) ?? '#BFBFBF',
  };
  return element;
}

async function ensureMedia(
  ctx: ImportContext,
  slidePart: string,
  rId: string,
  rels: Map<string, Relationship>,
): Promise<string | undefined> {
  const rel = rels.get(rId);
  if (!rel) return undefined;
  const path = normalizePartPath(slidePart, rel.target);
  const cached = ctx.mediaByPart.get(path);
  if (cached) return cached;
  const bytes = await readBinaryPart(ctx.zip, path);
  if (!bytes) return undefined;
  const mime = mimeFromFilename(path) ?? 'image/png';
  const result = await createMediaFromBytes(bytes, mime);
  if (!result.ok) return undefined;
  ctx.media[result.value.id] = result.value;
  ctx.mediaByPart.set(path, result.value.id);
  return result.value.id;
}

/**
 * degrade to a placeholder box.
 *
 * Must carry the original geometry: it used to be fixed at 240×160 @(0,0), so charts / SmartArt / OLE all
 * piled up in the top-left corner and users couldn't make out the original layout at all.
 */
function noteUnsupported(
  ctx: ImportContext,
  kind: string,
  label: string,
  rect?: { x: number; y: number; width: number; height: number },
): SlideElement {
  ctx.placeholders += 1;
  ctx.skipped.add(kind);
  const width = rect && rect.width > 0 ? rect.width : 240;
  const height = rect && rect.height > 0 ? rect.height : 160;
  return {
    id: nextId(ctx, 'ph'),
    type: 'placeholder',
    x: rect && rect.width > 0 ? rect.x : 0,
    y: rect && rect.height > 0 ? rect.y : 0,
    width,
    height,
    sourceKind: kind,
    label,
  };
}

/* ------------------------------- Charts ------------------------------- */

/** First chart-type node under c:chart's plotArea → ChartType */
function chartTypeOf(plotArea: XmlNode | undefined): ChartType {
  const kinds: { tag: string; type: ChartType }[] = [
    { tag: 'barChart', type: 'bar' },
    { tag: 'lineChart', type: 'line' },
    { tag: 'areaChart', type: 'area' },
    { tag: 'pieChart', type: 'pie' },
    { tag: 'doughnutChart', type: 'doughnut' },
    { tag: 'scatterChart', type: 'scatter' },
    { tag: 'radarChart', type: 'radar' },
  ];
  for (const kind of kinds) {
    const node = childOf(plotArea, kind.tag);
    if (!node) continue;
    if (kind.tag === 'barChart') {
      const grouping = attr(childOf(node, 'grouping'), 'val') ?? 'clustered';
      if (grouping === 'stacked') return 'barStacked';
      if (grouping === 'percentStacked') return 'barPercent';
    }
    return kind.type;
  }
  return 'bar';
}

/** Value of c:pt: c:pt only has an idx attribute, the real content sits in the child c:v */
function pointValueOf(pt: XmlNode | undefined): string | undefined {
  if (!pt) return undefined;
  return textOf(childOf(pt, 'v'));
}

/**
 * Collect the c:pt nodes from a cache.
 *
 * Categories can be written two ways: single-level `c:strCache/c:pt`, and the multi-level
 * `c:multiLvlStrCache/c:lvl/c:pt` used by pptxgenjs / PowerPoint. Searching downward for the first level
 * that contains pt nodes handles both forms.
 */
function collectPoints(node: XmlNode | undefined): XmlNode[] {
  if (!node) return [];
  const direct = childrenNamed(node, 'pt');
  if (direct.length > 0) return direct;
  for (const child of childrenOf(node)) {
    const deeper = collectPoints(child);
    if (deeper.length > 0) return deeper;
  }
  return [];
}

/** c:cat → category labels (use cached values, ignore c:f formulas); numRef can yield numeric labels too */
function categoryLabelsOf(seriesNode: XmlNode): string[] {
  const cat = childOf(seriesNode, 'cat');
  const points = collectPoints(cat);
  if (points.length === 0) return [];
  return points.map((pt, index) => {
    const value = pointValueOf(pt);
    return value && value.trim() ? value.trim() : String(index + 1);
  });
}

/** c:val → numeric values */
function seriesValuesOf(seriesNode: XmlNode): number[] {
  const val = childOf(seriesNode, 'val');
  return collectPoints(val).map((pt) => {
    const parsed = Number.parseFloat(pointValueOf(pt) ?? '');
    return Number.isFinite(parsed) ? parsed : 0;
  });
}

/** Series name: prefer the cached text in c:tx, fall back to the reference string in c:f */
function seriesNameOf(seriesNode: XmlNode, index: number): string {
  const ref = childOf(childOf(seriesNode, 'tx'), 'strRef');
  const cache = childOf(ref, 'strCache');
  const first = childrenNamed(cache, 'pt')[0];
  const named = first ? pointValueOf(first) : undefined;
  if (named && named.trim()) return named.trim();
  const formula = textOf(childOf(ref, 'f'));
  return formula && formula.trim() ? formula.trim() : `Series ${index + 1}`;
}

/**
 * Chart title: rich text under `c:title/c:tx/c:rich`, or the cached string of a title reference.
 * `c:autoTitleDeleted val="1"` means "no title", which must not become an empty title box.
 */
function chartTitleOf(chart: XmlNode | undefined): string {
  if (!chart) return '';
  if (boolAttr(childOf(chart, 'autoTitleDeleted'), 'val')) return '';
  const tx = childOf(childOf(chart, 'title'), 'tx');
  if (!tx) return '';
  const rich = collect(childOf(tx, 'rich'), 't')
    .map((node) => textOf(node))
    .join('');
  if (rich.trim()) return rich.trim();
  return collectPoints(childOf(childOf(tx, 'strRef'), 'strCache'))
    .map((node) => pointValueOf(node) ?? '')
    .join('')
    .trim();
}

/**
 * Chart display options: `c:legend` presence, `c:dLbls/c:showVal` and the value axis gridlines.
 *
 * PowerPoint always emits a `c:dLbls` block, so the block alone does not mean "labels on" — the
 * `c:showVal` flag is what toggles it. Likewise `c:majorGridlines` only exists while they are on.
 */
function chartOptionsOf(chart: XmlNode | undefined, palette: Palette): ChartOptions {
  const plotArea = childOf(chart, 'plotArea');
  const legend = childOf(chart, 'legend') !== undefined;
  const plotNode = childrenOf(plotArea).find((node) => /Chart$/.test(localNameOf(node)));
  const dLbls = childOf(plotNode, 'dLbls') ?? childOf(childrenNamed(plotNode, 'ser')[0], 'dLbls');
  const dataLabels = attr(childOf(dLbls, 'showVal'), 'val') === '1';
  const gridLines = childrenNamed(plotArea, 'valAx').some(
    (axis) => childOf(axis, 'majorGridlines') !== undefined,
  );
  // Series colours live on c:ser/c:spPr; keeping them makes an imported chart match the source
  // instead of snapping back to the theme palette
  const colors = childrenNamed(plotNode, 'ser')
    .map((ser) => resolveColorNode(childOf(childOf(ser, 'spPr'), 'solidFill'), palette)?.color)
    .filter((color): color is string => Boolean(color));
  return { legend, dataLabels, gridLines, ...(colors.length > 0 ? { palette: colors } : {}) };
}

/** Read a chart part → the data part of a ChartElement; returns null when no data can be parsed */
async function readChartData(
  ctx: ImportContext,
  slidePart: string,
  rels: Map<string, Relationship>,
  chartRId: string,
  palette: Palette,
): Promise<{
  chartType: ChartType;
  categories: string[];
  series: ChartSeries[];
  title: string;
  options: ChartOptions;
} | null> {
  const rel = rels.get(chartRId);
  if (!rel) return null;
  const partPath = normalizePartPath(slidePart, rel.target);
  const xml = await readTextPart(ctx.zip, partPath);
  if (!xml) return null;
  const root = parseXml(xml)[0] as XmlNode | undefined;
  // The root may be a chartSpace under any namespace prefix; strip the prefix before reading children
  const chart = childOf(root, 'chart');
  const plotArea = childOf(chart, 'plotArea');
  const chartType = chartTypeOf(plotArea);

  const seriesNodes: XmlNode[] = [];
  for (const tag of [
    'barChart',
    'lineChart',
    'areaChart',
    'pieChart',
    'doughnutChart',
    'scatterChart',
    'radarChart',
  ]) {
    for (const node of childrenNamed(plotArea, tag) ?? []) {
      for (const ser of childrenNamed(node, 'ser') ?? []) seriesNodes.push(ser);
    }
  }
  if (seriesNodes.length === 0) return null;

  const categories = categoryLabelsOf(seriesNodes[0]!);
  const series = seriesNodes.map((node, index) => ({
    name: seriesNameOf(node, index),
    values: seriesValuesOf(node),
  }));
  return {
    chartType,
    categories,
    series,
    title: chartTitleOf(chart),
    options: chartOptionsOf(chart, palette),
  };
}

/** graphicFrame: table → TableElement; chart → ChartElement; SmartArt / OLE → placeholder box */
async function parseGraphicFrame(
  node: XmlNode,
  ctx: ImportContext,
  slidePart: string,
  rels: Map<string, Relationship>,
  palette: Palette,
  theme: SlideTheme,
): Promise<SlideElement | undefined> {
  const xfrm = readXfrm(childOf(node, 'xfrm'));
  const graphic = childOf(node, 'graphic');
  const graphicData = childOf(graphic, 'graphicData');
  const uri = attr(graphicData, 'uri') ?? '';
  const name = nameOf(node, 'nvGraphicFramePr');
  const base = {
    id: nextId(ctx, 'el'),
    ...baseRect(xfrm ?? { x: 0, y: 0, width: 0, height: 0 }),
    ...(name ? { name } : {}),
    ...(hiddenOf(node, 'nvGraphicFramePr') ? { visible: false } : {}),
  };
  const tableNode = childOf(graphicData, 'tbl');
  if (tableNode) {
    const table = parseTable(tableNode, ctx, xfrm, palette, theme) as TableElement;
    return { ...table, ...base };
  }

  // Chart: read the linked chart part, take categories and series values, and redraw it on the canvas as an editable chart.
  // Only fall back to a placeholder when the data is unavailable (missing rel / corrupt part / no series).
  const chartNode = childOf(graphicData, 'chart');
  const chartRId = chartNode ? (attr(chartNode, 'id') ?? attr(chartNode, 'r:id')) : undefined;
  if (chartRId) {
    const data = await readChartData(ctx, slidePart, rels, chartRId, palette);
    if (data) {
      const normalized = normalizeChartData(data.categories, data.series, data.chartType);
      const element: ChartElement = {
        ...base,
        type: 'chart',
        chartType: data.chartType,
        categories: normalized.categories,
        series: normalized.series,
        options: data.options,
        title: data.title,
        revision: 1,
      };
      return element;
    }
  }

  // The placeholder reuses the original rect to preserve the layout structure
  if (uri.includes('chart')) return noteUnsupported(ctx, 'chart', '图表', base);
  if (uri.includes('diagram')) return noteUnsupported(ctx, 'diagram', 'SmartArt', base);
  if (uri.includes('ole')) return noteUnsupported(ctx, 'ole', '嵌入对象', base);
  return noteUnsupported(ctx, uri || 'unknown', '图形框架', base);
}

async function parseSpTreeNode(
  node: XmlNode,
  ctx: ImportContext,
  slidePart: string,
  rels: Map<string, Relationship>,
  palette: Palette,
  theme: SlideTheme,
): Promise<SlideElement | undefined> {
  const kind = localNameOf(node);
  switch (kind) {
    case 'sp':
      return parseShape(node, ctx, palette, theme);
    case 'pic':
      return parsePicture(node, ctx, slidePart, rels, palette);
    case 'cxnSp':
      return parseConnector(node, ctx, palette);
    case 'graphicFrame':
      return parseGraphicFrame(node, ctx, slidePart, rels, palette, theme);
    case 'grpSp':
      return parseGroup(node, ctx, slidePart, rels, palette, theme);
    case 'AlternateContent': {
      const choice = childOf(node, 'Choice') ?? childOf(node, 'Fallback');
      if (!choice) return undefined;
      const inner = childrenOf(choice).filter((item) => localNameOf(item) !== 'drawing');
      if (inner.length > 0) {
        const first = inner[0];
        return parseSpTreeNode(first, ctx, slidePart, rels, palette, theme);
      }
      return undefined;
    }
    case 'contentPart':
      return noteUnsupported(ctx, 'ink', '墨迹/内容部件');
    default:
      return undefined;
  }
}

/**
 * grpSp: parse children first, then map sub-coordinates to **group-relative coordinates** using chOff/chExt.
 *
 * The model stores children relative to the group origin (see the `GroupElement` comment),
 * so groupX/groupY is not added here — otherwise rendering would offset them twice.
 */
async function parseGroup(
  node: XmlNode,
  ctx: ImportContext,
  slidePart: string,
  rels: Map<string, Relationship>,
  palette: Palette,
  theme: SlideTheme,
): Promise<SlideElement | undefined> {
  const groupPr = childOf(node, 'grpSpPr');
  const xfrm = readXfrm(childOf(groupPr, 'xfrm'));
  const children: SlideElement[] = [];
  for (const childItem of childrenOf(node)) {
    const childNode = localNameOf(childItem) === 'spTree' ? childItem : childItem;
    const parsed = await parseSpTreeNode(childNode, ctx, slidePart, rels, palette, theme);
    if (parsed) children.push(parsed);
  }
  if (children.length === 0) return undefined;

  const groupX = emuPx(xfrm?.x);
  const groupY = emuPx(xfrm?.y);
  const groupW = emuPx(xfrm?.width);
  const groupH = emuPx(xfrm?.height);
  const chOffNode = childOf(childOf(groupPr, 'xfrm'), 'chOff');
  const chExtNode = childOf(childOf(groupPr, 'xfrm'), 'chExt');
  const offX = emuPx(numAttr(chOffNode, 'x'));
  const offY = emuPx(numAttr(chOffNode, 'y'));
  const extW = emuPx(numAttr(chExtNode, 'cx')) || groupW;
  const extH = emuPx(numAttr(chExtNode, 'cy')) || groupH;
  const sx = extW > 0 ? groupW / extW : 1;
  const sy = extH > 0 ? groupH / extH : 1;

  // Only the direct children are re-based on the subgroup origin (their own children are already
  // relative to them), but the outer scale has to reach the whole subtree: nested groups keep a
  // fixed chExt, so an unscaled grandchild would be off by the outer ratio.
  const mapped = children.map((child) =>
    scaleSubtree({ ...child, x: child.x - offX, y: child.y - offY } as SlideElement, sx, sy),
  );

  return {
    id: nextId(ctx, 'el'),
    type: 'group',
    x: groupX,
    y: groupY,
    width: groupW,
    height: groupH,
    rotation: xfrm?.rotation === undefined ? undefined : xfrm.rotation / 60000,
    children: mapped,
    ...(nameOf(node, 'nvGrpSpPr') ? { name: nameOf(node, 'nvGrpSpPr') as string } : {}),
    ...(hiddenOf(node, 'nvGrpSpPr') ? { visible: false } : {}),
    ...(xfrm?.flipX ? { flipX: true } : {}),
    ...(xfrm?.flipY ? { flipY: true } : {}),
  };
}

/**
 * Scale an element and everything below it by (sx, sy).
 *
 * Group children are stored relative to the group origin, so scaling the box and the descendants
 * together keeps the layout consistent; line `points` are relative offsets and must scale too.
 */
function scaleSubtree(element: SlideElement, sx: number, sy: number): SlideElement {
  const next = { ...element } as SlideElement;
  next.x = element.x * sx;
  next.y = element.y * sy;
  next.width = element.width * sx;
  next.height = element.height * sy;
  if (next.type === 'line') {
    next.points = next.points.map((value, index) => (index % 2 === 0 ? value * sx : value * sy));
  } else if (next.type === 'group') {
    next.children = next.children.map((child) => scaleSubtree(child, sx, sy));
  }
  return next;
}

/**
 * Parse speaker notes: find the notesSlide part from the slide's rels and take the body placeholder text.
 * Returns undefined when missing (or empty), so no empty notes field is written.
 */
async function parseNotesText(
  ctx: ImportContext,
  slidePart: string,
  rels: Map<string, Relationship>,
): Promise<string | undefined> {
  const notesRel = [...rels.values()].find((rel) => rel.type.includes('notesSlide'));
  if (!notesRel) return undefined;
  const notesPart = normalizePartPath(slidePart, notesRel.target);
  const notesXml = await readXmlPart(ctx.zip, notesPart);
  if (!notesXml) return undefined;
  const spTree = childOf(childOf(notesXml, 'cSld'), 'spTree');
  for (const sp of childrenNamed(spTree, 'sp')) {
    const ph = childOf(childOf(childOf(sp, 'nvSpPr'), 'nvPr'), 'ph');
    if (!ph) continue;
    // The notes body placeholder is type="body" idx="1"; skip the rest (slide index, slide thumbnail)
    if (attr(ph, 'type') !== 'body' && attr(ph, 'idx') !== '1') continue;
    const body = childOf(sp, 'txBody');
    const text = childrenNamed(body, 'p')
      .map((paragraph) => textOf(paragraph) ?? '')
      .join('\n')
      .trim();
    if (text) return text;
  }
  return undefined;
}

/** Parse one spTree level (document order is z-order) */
async function parseSpTree(
  spTree: XmlNode | undefined,
  ctx: ImportContext,
  slidePart: string,
  rels: Map<string, Relationship>,
  palette: Palette,
  theme: SlideTheme,
): Promise<SlideElement[]> {
  const elements: SlideElement[] = [];
  for (const childNode of childrenOf(spTree)) {
    if (localNameOf(childNode) === 'spTree') continue;
    const parsed = await parseSpTreeNode(childNode, ctx, slidePart, rels, palette, theme);
    if (parsed) elements.push(parsed);
  }
  const merged = mergeInheritedGeometry(elements, ctx.layoutPlaceholders);
  // Resolve connector bindings only for elements at this tree level (group children keep their
  // group-relative coordinates and would need a group-aware pass).
  const present = new Set(merged);
  for (const ref of ctx.connectorRefs) {
    if (!present.has(ref.element)) continue;
    if (ref.start) {
      const shapeId = ctx.shapeIdMap.get(ref.start.id);
      if (shapeId) ref.element.startCxn = { shapeId, site: ref.start.site };
    }
    if (ref.end) {
      const shapeId = ctx.shapeIdMap.get(ref.end.id);
      if (shapeId) ref.element.endCxn = { shapeId, site: ref.end.site };
    }
  }
  return withResolvedConnectors(merged);
}

/**
 * Placeholder geometry inheritance: when a placeholder on the slide has no xfrm of its own,
 * fill position and size from the same-named placeholder (kind + idx) on the layout.
 */
function mergeInheritedGeometry(
  elements: SlideElement[],
  layoutPlaceholders: Map<string, Rect>,
): SlideElement[] {
  return elements.map((element) => {
    if (element.width > 0 && element.height > 0) return element;
    if (!element.placeholder) return element;
    const key = `${element.placeholder.kind}:${element.placeholder.index ?? ''}`;
    const fallback =
      layoutPlaceholders.get(key) ?? layoutPlaceholders.get(`${element.placeholder.kind}:`);
    if (!fallback) return element;
    return { ...element, ...fallback };
  });
}

export interface ImportedDeck {
  doc: SlideDoc;
  report: ImportReport;
}

async function readXmlPart(zip: JSZip, path: string): Promise<XmlNode | undefined> {
  const text = await readTextPart(zip, path);
  if (!text) return undefined;
  const parsed = parseXml(text);
  return parsed[0];
}

/** Resolve the theme palette and font scheme from the layout / master part */
async function resolveThemeChain(
  ctx: ImportContext,
  slidePart: string,
  rels: Map<string, Relationship>,
): Promise<{ theme: SlideTheme; palette: Palette; layoutId: string; masterId: string }> {
  const defaultTheme = createDoc().theme;
  let theme = defaultTheme;
  let layoutId = '';
  let masterId = '';

  const layoutRel = [...rels.values()].find((rel) => rel.type.endsWith('/slideLayout'));
  if (layoutRel) {
    const layoutPart = normalizePartPath(slidePart, layoutRel.target);
    layoutId = layoutPart;
    const layoutXml = await readXmlPart(ctx.zip, layoutPart);
    if (layoutXml) {
      const cSldLayout = childOf(childOf(layoutXml, 'cSld'), 'spTree');
      void cSldLayout;
      const layoutRels = await readRels(ctx.zip, layoutPart);
      const masterRel = [...layoutRels.values()].find((rel) => rel.type.endsWith('/slideMaster'));
      if (masterRel) {
        const masterPart = normalizePartPath(layoutPart, masterRel.target);
        masterId = masterPart;
        const masterRels = await readRels(ctx.zip, masterPart);
        const themeRel = [...masterRels.values()].find((rel) => rel.type.endsWith('/theme'));
        if (themeRel) {
          const themePart = normalizePartPath(masterPart, themeRel.target);
          const themeText = await readTextPart(ctx.zip, themePart);
          if (themeText) theme = parseTheme(themeText);
        }
      }
    }
  }
  return { theme, palette: theme.colors, layoutId, masterId };
}

/** layout part → SlideLayout (with placeholder elements, used by the gallery and geometry inheritance) */
async function parseLayoutPart(
  ctx: ImportContext,
  layoutPart: string,
  palette: Palette,
  theme: SlideTheme,
): Promise<{
  layout: SlideLayout;
  placeholders: Map<string, { x: number; y: number; width: number; height: number }>;
}> {
  const layoutXml = await readXmlPart(ctx.zip, layoutPart);
  const layout: SlideLayout = { id: layoutPart, masterId: '', elements: [] };
  const placeholders = new Map<string, { x: number; y: number; width: number; height: number }>();
  const rels = await readRels(ctx.zip, layoutPart);
  // Hyperlinks inside layout elements resolve against the layout's own rels
  ctx.rels = rels;
  if (!layoutXml) return { layout, placeholders };
  const masterRel = [...rels.values()].find((rel) => rel.type.endsWith('/slideMaster'));
  if (masterRel) layout.masterId = normalizePartPath(layoutPart, masterRel.target);

  const cSld = childOf(layoutXml, 'cSld');
  const spTree = childOf(cSld, 'spTree');
  const layoutCtx = ctx;
  layoutCtx.layoutPlaceholders = new Map();
  for (const node of childrenOf(spTree)) {
    const kind = localNameOf(node);
    if (kind !== 'sp' && kind !== 'pic' && kind !== 'graphicFrame' && kind !== 'grpSp') continue;
    const spPr = childOf(node, 'spPr') ?? childOf(node, 'grpSpPr');
    const xfrm = readXfrm(childOf(spPr, 'xfrm'));
    const nvSpPr = childOf(node, 'nvSpPr');
    const ph = childOf(childOf(nvSpPr, 'nvPr'), 'ph');
    if (ph) {
      const key = `${attr(ph, 'type') ?? 'body'}:${attr(ph, 'idx') ?? ''}`;
      placeholders.set(key, baseRect(xfrm));
    }
    const element = await parseSpTreeNode(node, layoutCtx, layoutPart, rels, palette, theme);
    if (element) layout.elements.push(element);
  }
  layout.name = attr(cSld, 'name');
  const bg = parseBackgroundColor(childOf(layoutXml, 'bg') ?? childOf(cSld, 'bg'), palette);
  if (bg) layout.background = bg;
  return { layout, placeholders };
}

/**
 * slideMaster → SlideMaster (with placeholder geometry).
 *
 * In Office-generated files, layout placeholders usually carry **no** `<p:spPr>/<a:xfrm>`; the real
 * position lives on the matching master placeholder, so the master must be parsed as a geometry fallback.
 */
async function parseMasterPart(
  ctx: ImportContext,
  masterPart: string,
  palette: Palette,
  theme: SlideTheme,
): Promise<{ master: SlideMaster; placeholders: Map<string, Rect> }> {
  const masterXml = await readXmlPart(ctx.zip, masterPart);
  const master: SlideMaster = { id: masterPart, name: theme.name, elements: [] };
  const placeholders = new Map<string, Rect>();
  if (!masterXml) return { master, placeholders };

  const rels = await readRels(ctx.zip, masterPart);
  // Hyperlinks inside master elements resolve against the master's own rels
  ctx.rels = rels;
  const cSld = childOf(masterXml, 'cSld');
  const spTree = childOf(cSld, 'spTree');
  for (const node of childrenOf(spTree)) {
    const kind = localNameOf(node);
    if (kind !== 'sp' && kind !== 'pic' && kind !== 'graphicFrame' && kind !== 'grpSp') continue;
    const spPr = childOf(node, 'spPr') ?? childOf(node, 'grpSpPr');
    const xfrm = readXfrm(childOf(spPr, 'xfrm'));
    const ph = childOf(childOf(childOf(node, 'nvSpPr'), 'nvPr'), 'ph');
    if (ph) {
      const key = `${attr(ph, 'type') ?? 'body'}:${attr(ph, 'idx') ?? ''}`;
      placeholders.set(key, baseRect(xfrm));
    }
    const element = await parseSpTreeNode(node, ctx, masterPart, rels, palette, theme);
    if (element) master.elements.push(element);
  }
  const bg = parseBackgroundColor(childOf(cSld, 'bg'), palette);
  if (bg) master.background = bg;
  return { master, placeholders };
}

/** Merge inherited placeholder geometry: master as fallback → layout overrides (both need a valid size) */
function mergePlaceholderRects(
  base: Map<string, Rect> | undefined,
  override: Map<string, Rect> | undefined,
): Map<string, Rect> {
  const merged = new Map<string, Rect>();
  for (const source of [base, override]) {
    if (!source) continue;
    for (const [key, rect] of source) {
      if (rect.width > 0 && rect.height > 0) merged.set(key, rect);
    }
  }
  return merged;
}

/** Main entry: pptx File → SlideDoc */
export async function importPptxFile(file: File): Promise<ToolResult<ImportedDeck>> {
  const check = checkImportFile(file);
  if (!check.ok) return check;

  let zip: JSZip;
  try {
    zip = await loadZip(file);
  } catch {
    return { ok: false, error: 'IMPORT_FAILED' };
  }
  const presentationText = await readTextPart(zip, 'ppt/presentation.xml');
  const presentationXml = presentationText ? parseXml(presentationText)[0] : undefined;
  if (!presentationXml) return { ok: false, error: 'IMPORT_FAILED' };

  const presentationRels = await readRels(zip, 'ppt/presentation.xml');
  const sldIds = childrenNamed(childOf(presentationXml, 'sldIdLst'), 'sldId');
  const slideParts: string[] = [];
  for (const sldId of sldIds) {
    const rId = attr(sldId, 'r:id');
    const rel = rId ? presentationRels.get(rId) : undefined;
    if (rel) slideParts.push(normalizePartPath('ppt/presentation.xml', rel.target));
  }
  const slidePartNames = Object.keys(zip.files).filter((name) =>
    /^ppt\/slides\/slide\d+\.xml$/.test(name),
  );
  const ordered = slideParts.length > 0 ? slideParts : slidePartNames.sort();

  const sldSz = childOf(presentationXml, 'sldSz');
  const width = emuPx(numAttr(sldSz, 'cx')) || 1280;
  const height = emuPx(numAttr(sldSz, 'cy')) || 720;

  const ctx: ImportContext = {
    zip,
    media: {},
    mediaByPart: new Map(),
    seq: 0,
    placeholders: 0,
    skipped: new Set<string>(),
    layoutPlaceholders: new Map(),
    shapeIdMap: new Map(),
    connectorRefs: [],
    rels: new Map(),
  };
  /** 未能还原的切换/动画（`p:timing` 子集之外的效果），交给保真报告 */
  const unsupportedMotion: string[] = [];

  const doc: SlideDoc = {
    id: createId('doc'),
    name: file.name.replace(/\.pptx?$/i, ''),
    width,
    height,
    theme: createDoc().theme,
    masters: [],
    layouts: [],
    slides: [],
    media: ctx.media,
    version: 1,
    schemaVersion: SCHEMA_VERSION,
  };

  const layoutCache = new Map<string, SlideLayout>();
  const layoutRects = new Map<string, Map<string, Rect>>();
  const masterCache = new Map<string, SlideMaster>();
  const masterRects = new Map<string, Map<string, Rect>>();

  for (const slidePart of ordered) {
    const slideXml = await readXmlPart(zip, slidePart);
    if (!slideXml) continue;
    const rels = await readRels(zip, slidePart);
    const { theme, palette, layoutId } = await resolveThemeChain(ctx, slidePart, rels);
    doc.theme = theme;

    if (layoutId && !layoutCache.has(layoutId)) {
      const parsed = await parseLayoutPart(ctx, layoutId, palette, theme);
      layoutCache.set(layoutId, parsed.layout);
      layoutRects.set(layoutId, parsed.placeholders);
      if (parsed.layout.masterId && !masterCache.has(parsed.layout.masterId)) {
        const masterParsed = await parseMasterPart(ctx, parsed.layout.masterId, palette, theme);
        masterCache.set(masterParsed.master.id, masterParsed.master);
        masterRects.set(masterParsed.master.id, masterParsed.placeholders);
      }
    }
    // Placeholder geometry: master as fallback (Office layouts often omit xfrm on placeholders)
    ctx.layoutPlaceholders = mergePlaceholderRects(
      layoutId ? masterRects.get(layoutCache.get(layoutId ?? '')?.masterId ?? '') : undefined,
      layoutId ? layoutRects.get(layoutId) : undefined,
    );

    const cSld = childOf(slideXml, 'cSld');
    const spTree = childOf(cSld, 'spTree');
    // `cNvPr@id` restarts at 1 on every slide, so the spid map must be per-slide; a stale entry
    // from the previous slide would resolve `p:timing` to the wrong element.
    ctx.shapeIdMap.clear();
    // Layout/master parsing sets ctx.rels to its own part; restore the slide's rels for hyperlinks
    ctx.rels = rels;
    const elements = await parseSpTree(spTree as XmlNode, ctx, slidePart, rels, palette, theme);
    const bgNode = findBackgroundNode(slideXml);
    const background =
      parseBackgroundColor(bgNode, palette) ?? layoutCache.get(layoutId ?? '')?.background;

    const motion = parseSlideMotion(slideXml, ctx.shapeIdMap);
    unsupportedMotion.push(...motion.unsupported);

    doc.slides.push({
      id: slidePart,
      layoutId: layoutId || undefined,
      elements,
      background,
      notes: await parseNotesText(ctx, slidePart, rels),
      ...(motion.transition ? { transition: motion.transition } : {}),
      ...(motion.animations.length > 0 ? { animations: motion.animations } : {}),
    });
  }

  doc.layouts = [...layoutCache.values()];
  doc.masters = [...masterCache.values()];
  if (doc.slides.length === 0) return { ok: false, error: 'EMPTY' };

  return {
    ok: true,
    value: {
      doc,
      report: {
        placeholders: ctx.placeholders,
        skipped: [...ctx.skipped],
        unsupportedMotion: [...new Set(unsupportedMotion)],
      },
    },
  };
}

function findBackgroundNode(slide: XmlNode): XmlNode | undefined {
  const bg = childrenOf(slide).find((node) => localNameOf(node) === 'bg');
  if (bg) return bg;
  const cSld = childOf(slide, 'cSld');
  return childrenOf(cSld).find((node) => localNameOf(node) === 'bg');
}

/** Expose internals for external use (tests/export) */
export const __internals = { pxToEmu, scaleSubtree };
