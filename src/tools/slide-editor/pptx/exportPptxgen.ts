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
 * SlideDoc → pptxgenjs 导出通道。
 *
 * 为什么引入它：自研 DrawingML 写出（pptx/write.ts）对子元素顺序零容忍，
 * 每补一种能力都要手写一遍 XML 且难以覆盖全；pptxgenjs 已经封装了
 * **原生可编辑图表**、母版、表格合并、run 级字距/上下标/高亮/超链接等能力。
 *
 * 体积约束：pptxgenjs 约 350KB+ gzip，因此这里**只在真正导出时**动态 import，
 * 由 Vite 切成独立 chunk，绝不进入首屏。
 *
 * 已知降级（pptxgenjs 表达不了的部分）：
 * - 渐变填充（ShapeFillProps.type 仅 'none' | 'solid'）→ 取首个色标作为纯色；
 * - 组合 group（无原生分组）→ 导出时展平为绝对坐标的独立元素；
 * - 元素级透明度 opacity（无对应选项）→ 忽略；
 * - 竖排文本 vert → 忽略，按横排导出；
 * - 自定义路径 custGeom → 退化为最接近的 prstGeom；
 * - 公式 formula → 暂以「LaTeX 源码文本框」落盘（见 addFormula）。
 */

export type PptxGenExportErrorCode = 'EMPTY' | 'EXPORT_FAILED' | 'UNSUPPORTED';

/**
 * pptxgenjs 3.12 未导出其命名空间类型，因此这里用本地最小契约
 * （`pptxgenTypes.ts`）承接，实例由 `new PptxGenJS()` 构造后断言为该契约。
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

/** 96dpi：模型用 px，pptxgenjs 用 inch */
const PX_PER_INCH = 96;
/** px → pt（描边宽度、缩进等以磅为单位） */
const PX_PER_PT = 96 / 72;

function toIn(px: number): number {
  return px / PX_PER_INCH;
}

function toPt(px: number): number {
  return px / PX_PER_PT;
}

/** '#RRGGBB' → 'RRGGBB'（pptxgenjs 的 HexColor 不带 #） */
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
  // 渐变降级为首个色标（pptxgenjs 不支持 gradient fill）
  const first = hex(fill.stops[0]?.color);
  return first ? { type: 'solid', color: first } : undefined;
}

function lineToShapeLine(stroke: Stroke | undefined): ShapeProps['line'] {
  if (!stroke) return undefined;
  const color = hex(stroke.color);
  if (!color) return undefined;
  return { color, width: Math.max(0.75, toPt(stroke.width)) };
}

/** 我们的 prstGeom 名 → pptxgenjs SHAPE_NAME；未收录的退化为 rect */
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
  star4: 'star5',
  star5: 'star5',
  star6: 'star6',
  star8: 'star5',
  star12: 'star5',
  star16: 'star5',
  star24: 'star5',
  star32: 'star5',
  line: 'line',
};

function shapeNameOf(prst: string): SHAPE_NAME {
  return SHAPE_MAP[prst] ?? 'rect';
}

/** 图表类型 → pptxgenjs CHART_NAME + 分组方式 */
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

/** 媒体字节 → pptxgenjs 可接受的 data URI */
function mediaDataUri(bytes: Uint8Array, mime: string): string {
  return `data:${mime || 'image/png'};base64,${bytesToBase64(bytes)}`;
}

/* ------------------------------- 文本 ------------------------------- */

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

/** 一个段落 → 若干 TextProps（最后一段不加换行） */
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
      // 段内换行由段落边界控制：每个段落的最后一段不加 breakLine
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

/** 富文本 → 纯文本（段落以换行分隔）：给只接受单字符串的 master text 对象用 */
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

/* ------------------------------- 元素 ------------------------------- */

interface ExportCtx {
  doc: SlideDoc;
  /** 元素级超链接兜底（run 级优先） */
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

  // 形状内文字单独叠一层文本框（pptxgenjs 的 shape 不支持富文本段落）
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
  // 连线用 line 形状近似：坐标取包围盒，方向由起止点决定
  const points = element.points ?? [0, 0, element.width, 0];
  const flipH = (points[2] ?? 0) < 0;
  const flipV = (points[3] ?? 0) < 0;
  const line = lineToShapeLine(element.stroke) ?? { color: '000000', width: 1 };
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
  // pptxgenjs 从 cell.options 上读 colspan/rowspan（不是 cell 顶层字段），
  // 因此所有单元格属性都要放进 options。
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
        // 被合并覆盖的格子已过滤掉，pptxgenjs 会按 span 自动补占位格
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

/** 公式：pptxgenjs 无公式对象，降级为展示 LaTeX 源码的文本框 */
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
 * 内置 SVG → PNG dataURL（浏览器端栅格化）。
 *
 * 图标在画布上是矢量（Konva.Path），但 pptxgenjs 不接受 SVG 路径，
 * 因此在导出时把 24×24 的图标栅格化成本地图再作为图片插入。
 * 导出本身已是异步链路，这里等待一次图片解码是可接受的。
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

/** 占位框（导入时无法解析的图表/SmartArt/OLE）：灰底虚线框 + 说明文字 */
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

/** 图标导出：栅格化为 PNG 后以图片插入；栅格化失败时退回占位说明 */
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
      // 组合展平：子元素坐标是相对 group 原点且缩放比为 1，直接叠加；
      // 组的旋转角累加到子元素上（无原生分组可写）。
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

/* ------------------------------- 母版 ------------------------------- */

const MASTER_NAME = 'SYNTOOLS_MASTER';

/**
 * 把母版元素写进 pptxgenjs 的 slide master。
 * master.objects 只接受 rect / text / image / line，其它类型跳过（母版上的
 * 表格、图表等本就罕见，跳过比写坏包体更安全）。
 */
function defineMaster(pres: PptxPres, doc: SlideDoc): void {
  const master = doc.masters[0];
  const background = normalizeBackground(master?.background);
  const objects: PptxMasterObject[] = [];

  for (const element of master?.elements ?? []) {
    if (element.visible === false) continue;
    if (element.type === 'text') {
      // master 的 text 对象只接受单条 TextProps，段落用换行拼成一段文本
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

/* ------------------------------- 后处理 ------------------------------- */

/** 需要重排形状 id 的部件（同一部件内 id 必须唯一） */
const SHAPE_ID_PARTS = /^ppt\/(slides|slideLayouts|slideMasters|notesSlides)\/[^/]+\.xml$/;

/**
 * 重排 `p:cNvPr/@id`。
 *
 * pptxgenjs 3.12 对 `p:sp` 与 `p:graphicFrame` 用了两套自增计数器，
 * 同一页里混排形状与表格/图表时会出现重复 id（实测 Text=2 与 Table=2）。
 * PowerPoint 对重复 id 会弹出「需要修复」对话框，因此导出后统一按文档顺序重排：
 * 组内第一个（spTree 的 nvGrpSpPr）天然是 1，其余顺延，不影响任何交叉引用。
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

/* ------------------------------- 入口 ------------------------------- */

/**
 * 用 pptxgenjs 导出 .pptx。
 *
 * 与自研通道保持相同的 `ToolResult<Uint8Array>` 契约与错误码，
 * 便于 pptx/export.ts 做双通道调度。
 */
export async function exportPptxPptxGen(doc: SlideDoc): Promise<ToolResult<Uint8Array>> {
  if (!doc.slides || doc.slides.length === 0) return { ok: false, error: 'EMPTY' };

  try {
    // 动态 import：pptxgenjs 单独分包，只在导出时下载
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

  // 页面自身背景覆盖母版；渐变降级为首色（pptxgenjs 仅支持纯色背景）
  const ownBackground = normalizeBackground(slide.background);
  if (ownBackground) {
    pptSlide.background = {
      color: hex(backgroundToColor(slide.background, '#FFFFFF')) ?? 'FFFFFF',
      ...(ownBackground.type === 'solid' && ownBackground.alpha !== undefined
        ? { transparency: Math.round((1 - ownBackground.alpha) * 100) }
        : {}),
    };
  }

  // pptxgenjs 的 defineSlideMaster 只生成一个版式，无法表达「每页引用不同版式」，
  // 因此把该页所属版式的元素直接写到页上，保证视觉与画布一致。
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
