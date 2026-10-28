import type { ToolResult } from '@/core/types';
import { backgroundToColor, normalizeBackground } from '../core';
import { findIcon, iconSvg } from '../model/icons';
import { extensionForMime } from '../model/media';
import type {
  ChartElement,
  Fill,
  ImageElement,
  LineElement,
  Paragraph,
  RunStyle,
  ShapeElement,
  Slide,
  SlideDoc,
  SlideElement,
  Stroke,
  TableElement,
  TextBody,
  TextElement,
} from '../model/types';
import type {
  PptxChartOptions,
  PptxFill,
  PptxMasterObject,
  PptxPresentation,
  PptxShapeOptions,
  PptxSlide,
  PptxTableOptions,
  PptxTableCell,
  PptxTextOptions,
  PptxTextProps,
} from './pptxgenTypes';

/**
 * SlideDoc → pptxgenjs export channel.
 *
 * Why it exists: the hand-written DrawingML writer (pptx/write.ts) is zero-tolerance about element
 * order — every new capability means hand-writing XML again and still can't cover everything; pptxgenjs
 * already wraps **natively editable charts**, masters, table merges and run-level spacing/baseline/highlight/hyperlinks.
 *
 * Size budget: pptxgenjs is ~350KB+ gzipped, so it is imported dynamically **only when actually exporting**,
 * letting Vite split it into its own chunk that never reaches the first screen.
 *
 * Known degradations (what pptxgenjs cannot express):
 * - gradient fills (ShapeFillProps.type is only 'none' | 'solid') → use the first stop as a solid color;
 * - groups (no native grouping) → flattened into independent elements with absolute coordinates on export;
 * - element-level opacity (no matching option) → ignored;
 * - vertical text vert → ignored, exported horizontally;
 * - custom paths custGeom → degrade to the closest prstGeom;
 * - formulas → persisted for now as a "LaTeX source" text box (see addFormula).
 */

export type PptxGenExportErrorCode = 'EMPTY' | 'EXPORT_FAILED' | 'UNSUPPORTED';

/**
 * pptxgenjs 3.12 doesn't export its namespace types, so a local minimal contract
 * (`pptxgenTypes.ts`) stands in; the instance is built by `new PptxGenJS()` and asserted to it.
 */
type PptxPres = PptxPresentation;
type PresSlide = PptxSlide;
type TextProps = PptxTextProps;
type TextPropsOptions = PptxTextOptions;
type ShapeProps = PptxShapeOptions;
type ShapeFillProps = PptxFill;
type TableProps = PptxTableOptions;
type TableCellProps = PptxTableCell;
type IChartOpts = PptxChartOptions;
type SHAPE_NAME = string;
type CHART_NAME = string;

/** 96dpi: the model uses px, pptxgenjs uses inches */
const PX_PER_INCH = 96;
/** px → pt (stroke widths, indents and similar are measured in points) */
const PX_PER_PT = 96 / 72;

function toIn(px: number): number {
  return px / PX_PER_INCH;
}

function toPt(px: number): number {
  return px / PX_PER_PT;
}

/** '#RRGGBB' → 'RRGGBB' (pptxgenjs HexColor has no leading #) */
function hex(color: string | undefined): string | undefined {
  if (!color) return undefined;
  const text = color.trim().replace(/^#/, '');
  return /^[0-9a-fA-F]{6}$/.test(text) ? text.toUpperCase() : undefined;
}

function fillToShapeFill(fill: Fill | undefined): ShapeFillProps | undefined {
  if (!fill) return undefined;
  if (fill.type === 'none') return { type: 'none' };
  if (fill.type === 'solid') {
    const color = hex(fill.color);
    if (!color) return undefined;
    return {
      type: 'solid',
      color,
      transparency: fill.alpha === undefined ? undefined : Math.round((1 - fill.alpha) * 100),
    };
  }
  // Degrade gradients to the first stop (pptxgenjs has no gradient fill)
  const first = hex(fill.stops[0]?.color);
  return first ? { type: 'solid', color: first } : undefined;
}

function lineToShapeLine(stroke: Stroke | undefined): ShapeProps['line'] {
  if (!stroke) return undefined;
  const color = hex(stroke.color);
  if (!color) return undefined;
  return { color, width: Math.max(0.75, toPt(stroke.width)) };
}

/** Our prstGeom names → pptxgenjs SHAPE_NAME; unknown ones degrade to rect */
const SHAPE_MAP: Record<string, SHAPE_NAME> = {
  rect: 'rect',
  roundRect: 'roundRect',
  snip1Rect: 'snip1Rect',
  snipRoundRect: 'roundRect',
  frame: 'frame',
  ellipse: 'ellipse',
  triangle: 'triangle',
  rtTriangle: 'rtTriangle',
  isoTriangle: 'triangle',
  diamond: 'diamond',
  trapezoid: 'trapezoid',
  pentagon: 'pentagon',
  homePlate: 'homePlate',
  hexagon: 'hexagon',
  octagon: 'octagon',
  rightArrow: 'rightArrow',
  leftArrow: 'leftArrow',
  upArrow: 'upArrow',
  downArrow: 'downArrow',
  chevron: 'chevron',
  star: 'star5',
  star4: 'star4',
  star5: 'star5',
  star6: 'star6',
  star8: 'star8',
  star12: 'star12',
  star16: 'star16',
  star24: 'star24',
  star32: 'star32',
  parallelogram: 'parallelogram',
  cross: 'plus',
  leftRightArrow: 'leftRightArrow',
  upDownArrow: 'upDownArrow',
  quadArrow: 'quadArrow',
  flowChartProcess: 'flowChartProcess',
  flowChartDecision: 'flowChartDecision',
  flowChartDocument: 'flowChartDocument',
  flowChartTerminator: 'flowChartTerminator',
  flowChartConnector: 'flowChartConnector',
  wedgeRectCallout: 'wedgeRectCallout',
  mathPlus: 'mathPlus',
  mathMinus: 'mathMinus',
  mathMultiply: 'mathMultiply',
  line: 'line',
};

function shapeNameOf(prst: string): SHAPE_NAME {
  return SHAPE_MAP[prst] ?? 'rect';
}

/** Chart type → pptxgenjs CHART_NAME + grouping */
function chartNameOf(element: ChartElement): {
  name: CHART_NAME;
  barGrouping?: string;
} {
  switch (element.chartType) {
    case 'bar':
      return { name: 'bar', barGrouping: 'clustered' };
    case 'barStacked':
      return { name: 'bar', barGrouping: 'stacked' };
    case 'barPercent':
      return { name: 'bar', barGrouping: 'percent' };
    case 'line':
      return { name: 'line' };
    case 'pie':
      return { name: 'pie' };
    case 'doughnut':
      return { name: 'doughnut' };
    case 'area':
      return { name: 'area' };
    case 'scatter':
      return { name: 'scatter' };
    case 'radar':
      return { name: 'radar' };
    default:
      return { name: 'bar' };
  }
}

function bytesToBase64(bytes: Uint8Array): string {
  let binary = '';
  const chunk = 0x8000;
  for (let i = 0; i < bytes.length; i += chunk) {
    binary += String.fromCharCode(...bytes.subarray(i, i + chunk));
  }
  return btoa(binary);
}

/** Media bytes → a data URI pptxgenjs accepts */
function mediaDataUri(bytes: Uint8Array, mime: string): string {
  return `data:${mime || 'image/png'};base64,${bytesToBase64(bytes)}`;
}

/* ------------------------------- Text ------------------------------- */

const ALIGN_MAP = { left: 'left', center: 'center', right: 'right', justify: 'justify' } as const;
const VALIGN_MAP = { top: 'top', middle: 'middle', bottom: 'bottom' } as const;

function runOptions(style: RunStyle | undefined): TextPropsOptions {
  const options: TextPropsOptions = {};
  if (style?.size) options.fontSize = Math.round(style.size * 10) / 10;
  if (style?.bold) options.bold = true;
  if (style?.italic) options.italic = true;
  if (style?.underline) options.underline = true;
  if (style?.strike) options.strike = 'sngStrike';
  const color = hex(style?.color);
  if (color) options.color = color;
  if (style?.font) options.fontFace = style.font;
  if (style?.spacing) options.charSpacing = Math.round(style.spacing * 10) / 10;
  if (typeof style?.baseline === 'number' && style.baseline !== 0) {
    if (style.baseline > 0) options.superscript = true;
    else options.subscript = true;
  }
  if (style?.highlight) {
    const hl = hex(style.highlight);
    if (hl) options.highlight = hl;
  }
  if (style?.hyperlink) options.hyperlink = { url: style.hyperlink };
  return options;
}

/** One paragraph → a few TextProps (the last paragraph adds no line break) */
function paragraphToTextProps(paragraph: Paragraph, isLast: boolean): TextProps[] {
  const shared: TextPropsOptions = {};
  if (paragraph.align) shared.align = ALIGN_MAP[paragraph.align];
  if (paragraph.numbering) shared.bullet = { type: 'number', style: 'arabicPeriod' };
  else if (paragraph.bullet) shared.bullet = true;
  if (paragraph.lineSpacing) shared.lineSpacingMultiple = paragraph.lineSpacing;
  if (paragraph.indent) shared.indentLevel = Math.max(0, Math.round(paragraph.indent / 24));
  if (paragraph.spaceBefore) shared.paraSpaceBefore = toPt(paragraph.spaceBefore);
  if (paragraph.spaceAfter) shared.paraSpaceAfter = toPt(paragraph.spaceAfter);

  const runs = paragraph.runs.length > 0 ? paragraph.runs : [{ text: '' }];
  return runs.map((run, index) => ({
    text: run.text,
    options: {
      ...shared,
      ...runOptions(run.style),
      // Line breaks inside a paragraph follow paragraph boundaries: the last chunk adds no breakLine
      breakLine: isLast && index === runs.length - 1 ? false : index === runs.length - 1,
    },
  }));
}

function bodyToTextProps(body: TextBody): TextProps[] {
  const paragraphs = body.paragraphs.length > 0 ? body.paragraphs : [{ runs: [{ text: '' }] }];
  return paragraphs.flatMap((paragraph, index) =>
    paragraphToTextProps(paragraph, index === paragraphs.length - 1),
  );
}

/** Rich text → plain text (paragraphs separated by newlines), for master text objects that take a single string only */
function plainTextOf(body: TextBody): string {
  return body.paragraphs.map((p) => p.runs.map((run) => run.text).join('')).join('\n');
}

function textBaseOptions(
  element: { x: number; y: number; width: number; height: number; rotation?: number },
  body: TextBody | undefined,
): TextPropsOptions {
  const margins = body?.margins ?? { left: 9, top: 5, right: 9, bottom: 5 };
  return {
    x: toIn(element.x),
    y: toIn(element.y),
    w: toIn(element.width),
    h: toIn(element.height),
    rotate: element.rotation ?? 0,
    valign: VALIGN_MAP[body?.anchor ?? 'top'],
    margin: [toPt(margins.top), toPt(margins.right), toPt(margins.bottom), toPt(margins.left)],
    wrap: body?.wrap === false ? false : true,
    fit: body?.autoFit === 'autofit' ? 'shrink' : 'none',
  };
}

/* ------------------------------- Elements ------------------------------- */

interface ExportCtx {
  doc: SlideDoc;
  /** Element-level hyperlink fallback (run level wins) */
  hyperlinkOf: (element: SlideElement) => { url: string } | undefined;
}

function addTextElement(slide: PresSlide, element: TextElement, ctx: ExportCtx): void {
  const options: TextPropsOptions = {
    ...textBaseOptions(element, element.body),
    ...(fillToShapeFill(element.fill) ? { fill: fillToShapeFill(element.fill) } : {}),
    ...(lineToShapeLine(element.stroke) ? { line: lineToShapeLine(element.stroke) } : {}),
    isTextBox: true,
  };
  if (element.hyperlink) options.hyperlink = ctx.hyperlinkOf(element);
  slide.addText(bodyToTextProps(element.body), options);
}

function addShapeElement(slide: PresSlide, element: ShapeElement, ctx: ExportCtx): void {
  const options: ShapeProps = {
    x: toIn(element.x),
    y: toIn(element.y),
    w: toIn(element.width),
    h: toIn(element.height),
    rotate: element.rotation ?? 0,
    flipH: element.flipX,
    flipV: element.flipY,
    shape: shapeNameOf(element.geom.prst),
  };
  const fill = fillToShapeFill(element.fill);
  if (fill) options.fill = fill;
  const line = lineToShapeLine(element.stroke);
  if (line) options.line = line;
  if (element.shadow) {
    options.shadow = {
      type: 'outer',
      color: hex(element.shadow.color) ?? '808080',
      blur: Math.round(element.shadow.blur),
      offset: Math.round(
        Math.sqrt(element.shadow.offsetX ** 2 + element.shadow.offsetY ** 2) / PX_PER_PT,
      ),
      angle: Math.round(
        (Math.atan2(element.shadow.offsetY, element.shadow.offsetX) * 180) / Math.PI,
      ),
      opacity: element.shadow.opacity ?? 1,
    };
  }
  if (element.hyperlink) options.hyperlink = ctx.hyperlinkOf(element);
  slide.addShape(options.shape as SHAPE_NAME, options);

  // Draw text inside a shape as a separate overlay text box (pptxgenjs shapes don't support rich paragraphs)
  if (element.body && element.body.paragraphs.length > 0) {
    slide.addText(bodyToTextProps(element.body), {
      ...textBaseOptions(element, element.body),
      align: element.body.paragraphs[0]?.align
        ? ALIGN_MAP[element.body.paragraphs[0].align]
        : undefined,
      isTextBox: true,
    });
  }
}

function addImageElement(slide: PresSlide, element: ImageElement, ctx: ExportCtx): void {
  const asset = ctx.doc.media[element.mediaId];
  if (!asset?.bytes) return;
  const data = mediaDataUri(asset.bytes, asset.mime || `image/${extensionForMime(asset.mime)}`);
  slide.addImage({
    data,
    x: toIn(element.x),
    y: toIn(element.y),
    w: toIn(element.width),
    h: toIn(element.height),
    rotate: element.rotation ?? 0,
    flipH: element.flipX,
    flipV: element.flipY,
    ...(element.hyperlink ? { hyperlink: ctx.hyperlinkOf(element) } : {}),
  });
}

function addLineElement(slide: PresSlide, element: LineElement): void {
  // Approximate connectors with a line shape: coordinates come from the bounding box, direction from the end points
  const points = element.points ?? [0, 0, element.width, 0];
  const flipH = (points[2] ?? 0) < 0;
  const flipV = (points[3] ?? 0) < 0;
  const line: NonNullable<ShapeProps['line']> = lineToShapeLine(element.stroke) ?? {
    color: '000000',
    width: 1,
  };
  if (element.head) line.beginArrowType = element.head;
  if (element.tail) line.endArrowType = element.tail;
  slide.addShape('line', {
    x: toIn(element.x),
    y: toIn(element.y),
    w: toIn(element.width || 1),
    h: toIn(element.height || 1),
    rotate: element.rotation ?? 0,
    flipH,
    flipV,
    line,
  });
}

function addTableElement(slide: PresSlide, element: TableElement): void {
  // pptxgenjs reads colspan/rowspan from cell.options (not top-level cell fields),
  // so every cell property has to go into options.
  const rows: TableCellProps[][] = element.rows.map((row) =>
    row
      .filter((cell) => !cell.covered)
      .map((cell) => {
        const options: PptxTextOptions = {};
        if (cell.align) options.align = ALIGN_MAP[cell.align];
        if (cell.valign) options.valign = VALIGN_MAP[cell.valign];
        if (cell.bold) options.bold = true;
        if (cell.size) options.fontSize = Math.round(cell.size * 10) / 10;
        const color = hex(cell.color);
        if (color) options.color = color;
        const fill = hex(cell.fill);
        if (fill) options.fill = { type: 'solid', color: fill };
        // Covered cells are filtered out; pptxgenjs fills the placeholder cells from the span automatically
        const span: { colspan?: number; rowspan?: number } = {};
        if (cell.colSpan && cell.colSpan > 1) span.colspan = cell.colSpan;
        if (cell.rowSpan && cell.rowSpan > 1) span.rowspan = cell.rowSpan;
        const item: TableCellProps = { text: cell.text, options: { ...options, ...span } };
        return item;
      }),
  );
  const options: TableProps = {
    x: toIn(element.x),
    y: toIn(element.y),
    w: toIn(element.width),
    h: toIn(element.height),
    colW: element.colWidths.map(toIn),
    rowH: element.rowHeights.map(toIn),
    border: { type: 'solid', color: hex(element.borderColor) ?? 'BFBFBF', pt: 1 },
    autoPage: false,
  };
  if (rows.length > 0) slide.addTable(rows, options);
}

function addChartElement(slide: PresSlide, element: ChartElement): void {
  const { name, barGrouping } = chartNameOf(element);
  const data = element.series.map((series) => ({
    name: series.name,
    labels: element.categories,
    values: series.values,
  }));
  if (data.length === 0) return;

  const options: IChartOpts = {
    x: toIn(element.x),
    y: toIn(element.y),
    w: toIn(element.width),
    h: toIn(element.height),
    showLegend: element.options?.legend ?? true,
    showValue: element.options?.dataLabels ?? false,
    catGridLine: element.options?.gridLines === false ? { style: 'none' } : {},
    valGridLine: element.options?.gridLines === false ? { style: 'none' } : {},
  };
  if (barGrouping) options.barGrouping = barGrouping;
  if (element.options?.palette?.length) {
    options.chartColors = element.options.palette
      .map((color) => hex(color))
      .filter((value): value is string => Boolean(value));
  }
  if (element.title) options.title = element.title;
  slide.addChart(name, data, options);
}

/** Formula: pptxgenjs has no formula object, so degrade to a text box showing the LaTeX source */
function addFormulaElement(
  slide: PresSlide,
  element: {
    id: string;
    x: number;
    y: number;
    width: number;
    height: number;
    rotation?: number;
    latex: string;
    fontSize?: number;
    color?: string;
  },
): void {
  slide.addText([{ text: element.latex, options: { fontFace: 'Consolas' } }], {
    x: toIn(element.x),
    y: toIn(element.y),
    w: toIn(element.width),
    h: toIn(element.height),
    rotate: element.rotation ?? 0,
    fontSize: element.fontSize ?? 24,
    color: hex(element.color) ?? '111827',
    align: 'center',
    valign: 'middle',
    fill: { type: 'solid', color: 'F8FAFC' },
    line: { color: 'CBD5E1', width: 1 },
    isTextBox: true,
  });
}

/**
 * Built-in SVG → PNG dataURL (rasterized in the browser).
 *
 * Icons are vectors on the canvas (Konva.Path), but pptxgenjs doesn't accept SVG paths, so on export a
 * 24×24 icon is rasterized to a bitmap and inserted as an image. Export is already async, so awaiting one
 * image decode here is acceptable.
 */
async function rasterizeSvg(svg: string, size: number): Promise<string | null> {
  try {
    const url = URL.createObjectURL(new Blob([svg], { type: 'image/svg+xml' }));
    try {
      const image = new Image();
      await new Promise<void>((resolve, reject) => {
        image.onload = () => resolve();
        image.onerror = () => reject(new Error('svg load failed'));
        image.src = url;
      });
      const canvas = document.createElement('canvas');
      canvas.width = size;
      canvas.height = size;
      const context = canvas.getContext('2d');
      if (!context) return null;
      context.drawImage(image, 0, 0, size, size);
      return canvas.toDataURL('image/png');
    } finally {
      URL.revokeObjectURL(url);
    }
  } catch {
    return null;
  }
}

/** Placeholder box (charts/SmartArt/OLE that failed to parse on import): gray dashed box + caption */
function addPlaceholderElement(
  slide: PresSlide,
  element: { x: number; y: number; width: number; height: number; label: string },
): void {
  slide.addText([{ text: element.label, options: { fontSize: 14, color: '64748B' } }], {
    x: toIn(element.x),
    y: toIn(element.y),
    w: toIn(element.width),
    h: toIn(element.height),
    align: 'center',
    valign: 'middle',
    fill: { type: 'solid', color: 'F1F5F9' },
    line: { color: '94A3B8', width: 1, dash: 'dash' },
    isTextBox: true,
  });
}

/** Icon export: rasterize to PNG and insert as an image; fall back to a placeholder caption when that fails */
async function addIconElement(
  slide: PresSlide,
  element: { x: number; y: number; width: number; height: number; iconId: string; color?: string },
): Promise<void> {
  const icon = findIcon(element.iconId);
  const size = Math.round(Math.min(element.width, element.height) * 2);
  const data = icon ? await rasterizeSvg(iconSvg(icon, element.color ?? '#2563EB'), size) : null;
  if (data) {
    slide.addImage({
      data,
      x: toIn(element.x),
      y: toIn(element.y),
      w: toIn(element.width),
      h: toIn(element.height),
    });
    return;
  }
  addPlaceholderElement(slide, { ...element, label: `Icon: ${element.iconId}` });
}

async function addElement(slide: PresSlide, element: SlideElement, ctx: ExportCtx): Promise<void> {
  switch (element.type) {
    case 'text':
      return addTextElement(slide, element, ctx);
    case 'shape':
      return addShapeElement(slide, element, ctx);
    case 'image':
      return addImageElement(slide, element, ctx);
    case 'line':
      return addLineElement(slide, element);
    case 'table':
      return addTableElement(slide, element);
    case 'chart':
      return addChartElement(slide, element);
    case 'formula':
      return addFormulaElement(slide, element);
    case 'icon':
      return addIconElement(slide, element);
    case 'placeholder':
      return addPlaceholderElement(slide, element);
    case 'group': {
      // Flatten groups: children use coordinates relative to the group origin at scale 1, so just add them up;
      // the group's rotation accumulates onto the children (there is no native grouping to write).
      const rotation = element.rotation ?? 0;
      for (const child of element.children) {
        await addElement(
          slide,
          {
            ...child,
            x: element.x + child.x,
            y: element.y + child.y,
            rotation: (child.rotation ?? 0) + rotation,
          } as SlideElement,
          ctx,
        );
      }
      return undefined;
    }
    default:
      return undefined;
  }
}

/* ------------------------------- Masters ------------------------------- */

const MASTER_NAME = 'SYNTOOLS_MASTER';

/**
 * Write master elements into the pptxgenjs slide master.
 * master.objects only accepts rect / text / image / line; other types are skipped (tables, charts and the like
 * are rare on masters, and skipping is safer than writing a corrupt package).
 */
function defineMaster(pres: PptxPres, doc: SlideDoc): void {
  const master = doc.masters[0];
  const background = normalizeBackground(master?.background);
  const objects: PptxMasterObject[] = [];

  for (const element of master?.elements ?? []) {
    if (element.visible === false) continue;
    if (element.type === 'text') {
      // The master's text object accepts a single TextProps, so paragraphs are joined with newlines
      objects.push({
        text: {
          text: plainTextOf(element.body),
          options: { ...textBaseOptions(element, element.body), isTextBox: true },
        },
      });
    } else if (element.type === 'shape') {
      const props: ShapeProps = {
        x: toIn(element.x),
        y: toIn(element.y),
        w: toIn(element.width),
        h: toIn(element.height),
        rotate: element.rotation ?? 0,
        shape: shapeNameOf(element.geom.prst),
      };
      const fill = fillToShapeFill(element.fill);
      if (fill) props.fill = fill;
      const line = lineToShapeLine(element.stroke);
      if (line) props.line = line;
      objects.push({ rect: props });
    } else if (element.type === 'image') {
      const asset = doc.media[element.mediaId];
      if (asset?.bytes) {
        objects.push({
          image: {
            data: mediaDataUri(asset.bytes, asset.mime),
            x: toIn(element.x),
            y: toIn(element.y),
            w: toIn(element.width),
            h: toIn(element.height),
          },
        });
      }
    } else if (element.type === 'line') {
      objects.push({
        line: {
          x: toIn(element.x),
          y: toIn(element.y),
          w: toIn(Math.max(element.width, 1)),
          h: toIn(Math.max(element.height, 1)),
          line: lineToShapeLine(element.stroke),
        },
      });
    }
  }

  pres.defineSlideMaster({
    title: MASTER_NAME,
    background: {
      color: hex(backgroundToColor(master?.background, '#FFFFFF')) ?? 'FFFFFF',
      ...(background?.type === 'solid' && background.alpha !== undefined
        ? { transparency: Math.round((1 - background.alpha) * 100) }
        : {}),
    },
    objects,
  });
}

/* ------------------------------- Post-processing ------------------------------- */

/** Parts whose shape ids must be renumbered (ids must be unique within a part) */
const SHAPE_ID_PARTS = /^ppt\/(slides|slideLayouts|slideMasters|notesSlides)\/[^/]+\.xml$/;

/**
 * Renumber `p:cNvPr/@id`.
 *
 * pptxgenjs 3.12 uses two independent auto-increment counters for `p:sp` and `p:graphicFrame`, so mixing
 * shapes with tables/charts on one slide yields duplicate ids (Text=2 and Table=2 in testing).
 * PowerPoint shows a "repair" dialog for duplicate ids, so after export everything is renumbered in
 * document order: the first in a group (spTree's nvGrpSpPr) is naturally 1 and the rest follow, breaking no cross-references.
 */
async function renumberShapeIds(bytes: Uint8Array): Promise<Uint8Array> {
  const { default: JSZip } = await import('jszip');
  const zip = await JSZip.loadAsync(bytes);
  let changed = false;
  for (const name of Object.keys(zip.files)) {
    if (!SHAPE_ID_PARTS.test(name)) continue;
    const entry = zip.file(name);
    if (!entry) continue;
    const xml = await entry.async('string');
    let seq = 0;
    const next = xml.replace(/<p:cNvPr id="\d+"/g, () => {
      seq += 1;
      return `<p:cNvPr id="${seq}"`;
    });
    if (next !== xml) {
      zip.file(name, next);
      changed = true;
    }
  }
  if (!changed) return bytes;
  const buffer = await zip.generateAsync({
    type: 'uint8array',
    compression: 'DEFLATE',
    mimeType: 'application/vnd.openxmlformats-officedocument.presentationml.presentation',
  });
  return new Uint8Array(buffer);
}

/* ------------------------------- Entry ------------------------------- */

/**
 * Export .pptx with pptxgenjs.
 *
 * Keeps the same `ToolResult<Uint8Array>` contract and error codes as the hand-written channel, so
 * pptx/export.ts can dispatch between the two.
 */
export async function exportPptxPptxGen(doc: SlideDoc): Promise<ToolResult<Uint8Array>> {
  if (!doc.slides || doc.slides.length === 0) return { ok: false, error: 'EMPTY' };

  try {
    // Dynamic import: pptxgenjs is its own chunk, downloaded only when exporting
    const { default: PptxGenJS } = await import('pptxgenjs');
    const pres = new PptxGenJS() as unknown as PptxPresentation;

    pres.defineLayout({
      name: 'SYNTOOLS_CUSTOM',
      width: toIn(doc.width || 1280),
      height: toIn(doc.height || 720),
    });
    pres.layout = 'SYNTOOLS_CUSTOM';
    if (doc.name) pres.title = doc.name;

    defineMaster(pres, doc);

    const ctx: ExportCtx = {
      doc,
      hyperlinkOf: (element) => (element.hyperlink ? { url: element.hyperlink } : undefined),
    };

    for (const slide of doc.slides) {
      await addSlide(pres, slide, ctx);
    }

    const output = await pres.write({ outputType: 'uint8array', compression: true });
    if (output instanceof Uint8Array) {
      return { ok: true, value: await renumberShapeIds(output) };
    }
    if (output instanceof ArrayBuffer) {
      return { ok: true, value: await renumberShapeIds(new Uint8Array(output)) };
    }
    return { ok: false, error: 'EXPORT_FAILED' };
  } catch {
    return { ok: false, error: 'EXPORT_FAILED' };
  }
}

async function addSlide(pres: PptxPres, slide: Slide, ctx: ExportCtx): Promise<void> {
  const pptSlide = pres.addSlide({ masterName: MASTER_NAME });

  // The slide's own background overrides the master; gradients degrade to the first color (pptxgenjs supports solid only)
  const ownBackground = normalizeBackground(slide.background);
  if (ownBackground) {
    pptSlide.background = {
      color: hex(backgroundToColor(slide.background, '#FFFFFF')) ?? 'FFFFFF',
      ...(ownBackground.type === 'solid' && ownBackground.alpha !== undefined
        ? { transparency: Math.round((1 - ownBackground.alpha) * 100) }
        : {}),
    };
  }

  // pptxgenjs's defineSlideMaster produces a single layout and can't express "each slide references a different layout",
  // so the slide's layout elements are written straight onto the slide to keep it visually identical to the canvas.
  const layout = ctx.doc.layouts.find((item) => item.id === slide.layoutId);
  for (const element of layout?.elements ?? []) {
    if (element.visible === false) continue;
    await addElement(pptSlide, element, ctx);
  }

  for (const element of slide.elements) {
    if (element.visible === false) continue;
    await addElement(pptSlide, element, ctx);
  }

  if (slide.notes?.trim()) pptSlide.addNotes(slide.notes.trim());
}
