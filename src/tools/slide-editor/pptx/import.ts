import type { ToolResult } from '@/core/types';
import JSZip from 'jszip';
import { emuToPx, pxToEmu, resolvePresetGeometry } from '../core';
import { createDoc, createId } from '../model/factory';
import { createMediaFromBytes, mimeFromFilename } from '../model/media';
import type {
  Fill,
  ImageElement,
  LineElement,
  MediaAsset,
  Paragraph,
  RunStyle,
  ShapeElement,
  ShapeGeometry,
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
  VAlign,
} from '../model/types';
import type { ImportReport } from '../store';
import { parseShapeFill, parseStroke, resolveColorNode, type Palette } from './color';
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
import {
  attr,
  childOf,
  childrenNamed,
  childrenOf,
  localNameOf,
  numAttr,
  parseXml,
  textOf,
  type XmlNode,
} from './xml';

/** PPTX 导入：OPC 解包 → DrawingML 解析 → SlideDoc（不支持的元素降级为占位框） */

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

/** 占位符几何（页面坐标 px） */
type Rect = { x: number; y: number; width: number; height: number };

interface ImportContext {
  zip: JSZip;
  media: Record<string, MediaAsset>;
  mediaByPart: Map<string, string>;
  seq: number;
  placeholders: number;
  skipped: Set<string>;
  /** 当前 layout（含 master 兜底）的占位符几何，供 slide 上缺失 xfrm 的占位元素继承 */
  layoutPlaceholders: Map<string, Rect>;
}

function nextId(ctx: ImportContext, prefix: string): string {
  ctx.seq += 1;
  return `${prefix}_${ctx.seq}`;
}

/** '+mj-lt' 之类的主题引用 → 真实字体名 */
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

/** rPr → RunStyle */
function parseRunStyle(
  node: XmlNode | undefined,
  palette: Palette,
  theme: SlideTheme,
): RunStyle | undefined {
  if (!node) return undefined;
  const style: RunStyle = {};
  const size = numAttr(node, 'sz');
  if (size !== undefined) style.size = size / 100;
  const typeface = attr(childOf(node, 'latin'), 'typeface');
  const font = resolveTypeface(typeface, theme);
  if (font) style.font = font;
  const resolved = resolveColorNode(childOf(node, 'solidFill'), palette);
  if (resolved) style.color = resolved.color;
  if (attr(node, 'b') === '1') style.bold = true;
  if (attr(node, 'i') === '1') style.italic = true;
  if (attr(node, 'u') === 'sng') style.underline = true;
  if (attr(node, 'strike') === 'sng') style.strike = true;
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

/** p:txBody → TextBody；无可见文本时返回 undefined */
function parseTextBody(
  node: XmlNode | undefined,
  palette: Palette,
  theme: SlideTheme,
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
        runs.push({ text, style: parseRunStyle(childOf(item, 'rPr'), palette, theme) });
      } else if (kind === 'br') {
        runs.push({ text: '\n' });
      }
    }
    const lineSpacingPct = numAttr(childOf(pPr, 'spcPct'), 'val');
    const spaceBef = numAttr(childOf(pPr, 'spcBef'), 'val');
    const spaceAft = numAttr(childOf(pPr, 'spcAft'), 'val');
    paragraphs.push({
      runs: runs.length > 0 ? runs : [{ text: '' }],
      align: ALIGN_MAP[attr(pPr, 'algn') ?? ''] ?? 'left',
      bullet: Boolean(childOf(pPr, 'buChar') || childOf(pPr, 'buAutoNum')),
      lineSpacing: lineSpacingPct ? lineSpacingPct / 1000 : undefined,
      spaceBefore: spaceBef === undefined ? undefined : (spaceBef / 100) * (96 / 72),
      spaceAfter: spaceAft === undefined ? undefined : (spaceAft / 100) * (96 / 72),
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
  return {
    paragraphs,
    anchor: ANCHOR_MAP[attr(bodyPr, 'anchor') ?? ''] ?? 'top',
    wrap: attr(bodyPr, 'wrap') !== 'none',
    autoFit: attr(bodyPr, 'autoFit') === 'normAutofit' ? 'autofit' : 'none',
    margins: {
      left: margin('lIns', 91440),
      top: margin('tIns', 45720),
      right: margin('rIns', 91440),
      bottom: margin('bIns', 45720),
    },
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

function parseGeom(spPrNode: XmlNode | undefined): ShapeGeometry {
  const geomNode = childOf(spPrNode, 'geom') ?? childOf(spPrNode, 'prstGeom');
  const prst = attr(geomNode, 'prst') ?? 'rect';
  return resolvePresetGeometry(prst);
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
  const geometry = parseGeom(spPr);
  const fill = fillFromParsed(parseShapeFill(spPr, palette));
  const stroke = parseStroke(childOf(spPr, 'ln'), palette);
  const body = parseTextBody(childOf(node, 'txBody'), palette, theme);
  const nvSpPr = childOf(node, 'nvSpPr');
  const ph = childOf(childOf(nvSpPr, 'nvPr'), 'ph');
  const placeholder = ph ? { kind: attr(ph, 'type') ?? 'body', index: attr(ph, 'idx') } : undefined;

  // 无自建几何时沿用 baseRect 的 0 尺寸，稍后由 mergeInheritedGeometry 从 layout 继承
  const base = {
    id: nextId(ctx, 'el'),
    ...baseRect(xfrm),
    placeholder,
  };
  if (body && geometry.kind === 'rect' && !fill && !stroke) {
    const element: TextElement = { type: 'text', ...base, body };
    return element;
  }
  if (body) {
    const element: ShapeElement = { type: 'shape', ...base, geom: geometry, body };
    if (fill) element.fill = fill;
    if (stroke) element.stroke = stroke;
    return element;
  }
  const element: ShapeElement = { type: 'shape', ...base, geom: geometry };
  if (fill) element.fill = fill;
  if (stroke) element.stroke = stroke;
  return element;
}

/** p:pic → ImageElement */
async function parsePicture(
  node: XmlNode,
  ctx: ImportContext,
  slidePart: string,
  rels: Map<string, Relationship>,
): Promise<SlideElement | undefined> {
  const spPr = childOf(node, 'spPr');
  const xfrm = readXfrm(childOf(spPr, 'xfrm'));
  const blipFill = childOf(node, 'blipFill');
  const blip = childOf(blipFill, 'blip');
  const embed = attr(blip, 'embed') ?? attr(blip, 'link');
  const mediaId = embed ? await ensureMedia(ctx, slidePart, embed, rels) : undefined;

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

/** p:cxnSp → LineElement */
function parseConnector(
  node: XmlNode,
  ctx: ImportContext,
  palette: Palette,
): SlideElement | undefined {
  const spPr = childOf(node, 'spPr');
  const xfrm = readXfrm(childOf(spPr, 'xfrm'));
  if (!xfrm) return undefined;
  const stroke = parseStroke(childOf(spPr, 'ln'), palette);
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
  return element;
}

/** a:tbl → TableElement 的单元格部分 */
function parseTableCells(node: XmlNode, palette: Palette, theme: SlideTheme): TableCell[][] {
  const rows: TableCell[][] = [];
  for (const trNode of childrenNamed(node, 'tr')) {
    const row: TableCell[] = [];
    for (const tcNode of childrenNamed(trNode, 'tc')) {
      const tcPr = childOf(tcNode, 'tcPr');
      const body = parseTextBody(childOf(tcNode, 'txBody'), palette, theme);
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
      });
    }
    rows.push(row);
  }
  return rows;
}

function parseTable(
  node: XmlNode,
  ctx: ImportContext,
  xfrm: Xfrm | undefined,
  palette: Palette,
  theme: SlideTheme,
): SlideElement {
  // 列宽定义在 a:tblGrid 下；少数第三方生成的文件会省略 tblGrid，故兼容直接子节点
  const gridNode = childOf(node, 'tblGrid') ?? node;
  const cols = childrenNamed(gridNode, 'gridCol');
  const colWidths = cols.map((col) => emuPx(numAttr(col, 'w')) || 100);
  const rows = parseTableCells(node, palette, theme);
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
    borderColor: '#BFBFBF',
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

function noteUnsupported(ctx: ImportContext, kind: string, label: string): SlideElement {
  ctx.placeholders += 1;
  ctx.skipped.add(kind);
  return {
    id: nextId(ctx, 'ph'),
    type: 'placeholder',
    x: 0,
    y: 0,
    width: 240,
    height: 160,
    sourceKind: kind,
    label,
  };
}

/** graphicFrame：表格 → TableElement；图表 / SmartArt / OLE → 占位框 */
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
  const base = {
    id: nextId(ctx, 'el'),
    ...baseRect(xfrm ?? { x: 0, y: 0, width: 0, height: 0 }),
  };
  const tableNode = childOf(graphicData, 'tbl');
  if (tableNode) {
    const table = parseTable(tableNode, ctx, xfrm, palette, theme) as TableElement;
    return { ...table, ...base };
  }
  if (uri.includes('chart')) return noteUnsupported(ctx, 'chart', '图表');
  if (uri.includes('diagram')) return noteUnsupported(ctx, 'diagram', 'SmartArt');
  if (uri.includes('ole')) return noteUnsupported(ctx, 'ole', '嵌入对象');
  void slidePart;
  void rels;
  return noteUnsupported(ctx, uri || 'unknown', '图形框架');
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
      return parsePicture(node, ctx, slidePart, rels);
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

/** grpSp：先解析子节点，再按 chOff/chExt 把子坐标换算到组内绝对坐标 */
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

  const mapped = children.map((child) => {
    const next = { ...child } as SlideElement;
    next.x = groupX + (child.x - offX) * sx;
    next.y = groupY + (child.y - offY) * sy;
    next.width = child.width * sx;
    next.height = child.height * sy;
    return next;
  });

  return {
    id: nextId(ctx, 'el'),
    type: 'group',
    x: groupX,
    y: groupY,
    width: groupW,
    height: groupH,
    rotation: xfrm?.rotation === undefined ? undefined : xfrm.rotation / 60000,
    children: mapped,
  };
}

/** 解析一层 spTree（保持文档顺序即 z-order） */
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
  return mergeInheritedGeometry(elements, ctx.layoutPlaceholders);
}

/**
 * 占位符几何继承：slide 上的占位元素若没有自己的 xfrm，
 * 从 layout 同名占位符（kind + idx）补齐位置与尺寸。
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

/** 依据 layout / master part 解析出 theme 的色板与字体方案 */
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

/** layout part → SlideLayout（含占位符元素，用于 Gallery 与几何继承） */
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
 * slideMaster → SlideMaster（含占位符几何）。
 *
 * Office 生成的文件里，layout 上的占位符通常**不带** `<p:spPr>/<a:xfrm>`，
 * 真实位置写在 master 的对应占位符上，因此必须把 master 也解析出来做几何兜底。
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

/** 占位符几何继承合并：master 兜底 → layout 覆盖（两者都要求尺寸有效） */
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

/** 主入口：pptx File → SlideDoc */
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
  };

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
    // 占位符几何：master 兜底（Office 的 layout 占位符往往不带 xfrm）
    ctx.layoutPlaceholders = mergePlaceholderRects(
      layoutId ? masterRects.get(layoutCache.get(layoutId ?? '')?.masterId ?? '') : undefined,
      layoutId ? layoutRects.get(layoutId) : undefined,
    );

    const cSld = childOf(slideXml, 'cSld');
    const spTree = childOf(cSld, 'spTree');
    const elements = await parseSpTree(spTree as XmlNode, ctx, slidePart, rels, palette, theme);
    const bgNode = findBackgroundNode(slideXml);
    const background =
      parseBackgroundColor(bgNode, palette) ?? layoutCache.get(layoutId ?? '')?.background;

    doc.slides.push({
      id: slidePart,
      layoutId: layoutId || undefined,
      elements,
      background,
    });
  }

  doc.layouts = [...layoutCache.values()];
  doc.masters = [...masterCache.values()];
  if (doc.slides.length === 0) return { ok: false, error: 'EMPTY' };

  return {
    ok: true,
    value: {
      doc,
      report: { placeholders: ctx.placeholders, skipped: [...ctx.skipped] },
    },
  };
}

function findBackgroundNode(slide: XmlNode): XmlNode | undefined {
  const bg = childrenOf(slide).find((node) => localNameOf(node) === 'bg');
  if (bg) return bg;
  const cSld = childOf(slide, 'cSld');
  return childrenOf(cSld).find((node) => localNameOf(node) === 'bg');
}

/** 导出字形知识供外部使用（测试/导出） */
export const __internals = { pxToEmu };
