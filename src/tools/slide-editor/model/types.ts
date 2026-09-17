/**
 * 幻灯片编辑器数据模型契约。
 *
 * 单位约定：模型内部统一使用画布 px（96dpi），EMU 换算只在 pptx 进出口进行
 * （1 inch = 914400 EMU = 96px → 1px = 9525 EMU，整除无损）。
 */

/** 无元素的背景/填充 */
export interface NoFill {
  type: 'none';
}

export interface SolidFill {
  type: 'solid';
  /** #RRGGBB */
  color: string;
  /** 0~1，DrawingML 的 alpha（100000 = 100%）已换算 */
  alpha?: number;
}

export interface GradientStop {
  /** 0~1 */
  offset: number;
  color: string;
}

export interface GradientFill {
  type: 'gradient';
  /** 线性渐变角度（度），pptx 的 lin ang 顺时针换算结果 */
  angle?: number;
  stops: GradientStop[];
}

export type Fill = NoFill | SolidFill | GradientFill;

export interface Stroke {
  color: string;
  /** px 线宽 */
  width: number;
  dash?: number[];
  alpha?: number;
}

export type TextAlign = 'left' | 'center' | 'right' | 'justify';
export type VAlign = 'top' | 'middle' | 'bottom';

export interface RunStyle {
  bold?: boolean;
  italic?: boolean;
  underline?: boolean;
  strike?: boolean;
  /** 磅值（pt） */
  size?: number;
  font?: string;
  color?: string;
}

export interface TextRun {
  text: string;
  style?: RunStyle;
}

export interface Paragraph {
  runs: TextRun[];
  align?: TextAlign;
  bullet?: boolean;
  /** 行距倍数（1.2 = 120%） */
  lineSpacing?: number;
  /** 段前/段后（px） */
  spaceBefore?: number;
  spaceAfter?: number;
  /** 缩进（px） */
  indent?: number;
}

export interface TextBody {
  paragraphs: Paragraph[];
  anchor?: VAlign;
  wrap?: boolean;
  autoFit?: 'none' | 'autofit';
  /** 内边距（px） */
  margins?: { left: number; top: number; right: number; bottom: number };
}

/** DrawingML prstGeom → 渲染可用的几何描述 */
export interface ShapeGeometry {
  /** 渲染形态：矩形（可带圆角）/ 椭圆 / 星形 / 折线闭合多边形 / SVG 路径 */
  kind: 'rect' | 'ellipse' | 'star' | 'polygon' | 'path';
  /** kind==='rect' 时的圆角比例（0~0.5，相对短边） */
  radius?: number;
  /** 归一化顶点（0~1），kind==='polygon' */
  points?: number[];
  /** 归一化 SVG 路径，kind==='path' */
  path?: string;
  /** 星形的内接比（0~1），kind==='star' */
  innerRatio?: number;
  /** 原始 prstGeom 名称，导出时优先写回 */
  prst: string;
}

export interface PlaceholderRef {
  /** title / body / ctrTitle / subTitle / dt / sldNum / ftr / pic / tbl ... */
  kind: string;
  index?: string;
}

interface ElementBase {
  id: string;
  x: number;
  y: number;
  width: number;
  height: number;
  /** 顺时针角度 */
  rotation?: number;
  flipX?: boolean;
  flipY?: boolean;
  opacity?: number;
  name?: string;
  locked?: boolean;
  placeholder?: PlaceholderRef;
}

export interface TextElement extends ElementBase {
  type: 'text';
  body: TextBody;
  fill?: Fill;
  stroke?: Stroke;
  cornerRadius?: number;
}

export interface ShapeElement extends ElementBase {
  type: 'shape';
  geom: ShapeGeometry;
  fill?: Fill;
  stroke?: Stroke;
  body?: TextBody;
}

export interface ImageElement extends ElementBase {
  type: 'image';
  /** 指向 SlideDoc.media */
  mediaId: string;
  /** 裁剪比例 0~1（左/上/右/下各裁掉的比例） */
  crop?: { left: number; top: number; right: number; bottom: number };
  cornerRadius?: number;
  stroke?: Stroke;
}

export interface LineElement extends ElementBase {
  type: 'line';
  /** 起止点（相对 x/y 的偏移，未旋转前坐标系） */
  points: number[];
  stroke: Stroke;
}

export interface TableCell {
  text: string;
  fill?: string;
  color?: string;
  bold?: boolean;
  size?: number;
  align?: TextAlign;
  valign?: VAlign;
  colSpan?: number;
  rowSpan?: number;
}

export interface TableElement extends ElementBase {
  type: 'table';
  rows: TableCell[][];
  /** 列宽之和 ≈ width（px） */
  colWidths: number[];
  rowHeights: number[];
  headerRow?: boolean;
  bandRow?: boolean;
  borderColor?: string;
}

export interface GroupElement extends ElementBase {
  type: 'group';
  children: SlideElement[];
}

export interface PlaceholderElement extends ElementBase {
  type: 'placeholder';
  /** 原始 pptx 元素类型，如 chart / diagram / oleObj */
  sourceKind: string;
  label: string;
}

export type SlideElement =
  | TextElement
  | ShapeElement
  | ImageElement
  | LineElement
  | TableElement
  | GroupElement
  | PlaceholderElement;

export interface Slide {
  id: string;
  layoutId?: string;
  /** 页面背景色；未设置时沿用 layout/master */
  background?: string;
  elements: SlideElement[];
  notes?: string;
}

export interface SlideLayout {
  id: string;
  masterId: string;
  name?: string;
  /** 布局上的占位符几何（必然带 PlaceholderRef） */
  elements: SlideElement[];
  background?: string;
}

export interface SlideMaster {
  id: string;
  name?: string;
  /** 母版上的公共元素（Logo、页码占位符等） */
  elements: SlideElement[];
  background?: string;
}

export interface ThemeFonts {
  latin: string;
  ea?: string;
  cs?: string;
}

export interface SlideTheme {
  name: string;
  /** DrawingML clrScheme：dk1/lt1/dk2/lt2/accent1..6/hlink/folHlink → #RRGGBB */
  colors: Record<string, string>;
  majorFont: ThemeFonts;
  minorFont: ThemeFonts;
}

export interface MediaAsset {
  id: string;
  mime: string;
  width: number;
  height: number;
  bytes?: Uint8Array;
  /** 运行时解析出的 objectURL（不参与持久化） */
  url?: string;
}

export interface SlideDoc {
  id: string;
  name: string;
  /** 幻灯片尺寸（px @96dpi） */
  width: number;
  height: number;
  theme: SlideTheme;
  masters: SlideMaster[];
  layouts: SlideLayout[];
  slides: Slide[];
  media: Record<string, MediaAsset>;
  /** 每次结构性变更自增，用于缩略图缓存失效 */
  version: number;
}
