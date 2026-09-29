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

/**
 * 页面背景形态。
 *
 * 历史上 `background` 是纯色字符串，v2 起升级为 `Fill`（支持渐变）。
 * 读取旧工程/草稿时由 `normalizeBackground()` 统一归一化，因此这里保留
 * `string` 分支以兼容存量数据。
 */
export type SlideBackground = string | Fill;

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
  /** 字间距（pt），对应 DrawingML `a:spc` */
  spacing?: number;
  /**
   * 基线偏移（DrawingML `baseline`，单位为 0.1%）。
   * 正值上标、负值下标；0 表示正常。
   */
  baseline?: number;
  /** 字符高亮底色（#RRGGBB） */
  highlight?: string;
  /** run 级超链接（DrawingML `a:hlinkClick`） */
  hyperlink?: string;
}

export interface TextRun {
  text: string;
  style?: RunStyle;
}

export interface Paragraph {
  runs: TextRun[];
  align?: TextAlign;
  bullet?: boolean;
  /** 编号列表（DrawingML buAutoNum），与 bullet 互斥 */
  numbering?: boolean;
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
  /** 竖排文本（DrawingML `a:bodyPr vert`） */
  vert?: TextVert;
}

/** 文本排列方向 */
export type TextVert = 'horz' | 'vert' | 'vert270' | 'wordArtVert';

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

/** 投影样式（DrawingML `a:outerShdw` 的子集） */
export interface ShadowStyle {
  color: string;
  /** 模糊半径（px，EMU 换算后的值） */
  blur: number;
  offsetX: number;
  offsetY: number;
  /** 0~1，缺省 1 */
  opacity?: number;
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
  /** 锁定：不可选中、不可拖拽，但仍渲染与导出 */
  locked?: boolean;
  /** 隐藏：不渲染、不导出（默认可见，字段缺省即视为可见） */
  visible?: boolean;
  placeholder?: PlaceholderRef;
  /** 元素级超链接（DrawingML `a:hlinkClick`，作用于整个元素） */
  hyperlink?: string;
  /** 投影 */
  shadow?: ShadowStyle;
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
  /**
   * 被合并覆盖的单元格（DrawingML 的 hMerge / vMerge="1"）。
   * OOXML 要求这些格子仍然存在（只是不绘制内容），因此模型里保留它们并打标记，
   * 而不是从行数组里删掉 —— 删掉会让 colWidths 的下标与网格列号错位。
   */
  covered?: boolean;
  /** 被覆盖的方向：h = 横向合并且来自左邻、v = 纵向合并且来自上方 */
  coveredBy?: 'h' | 'v';
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

/**
 * 组合元素。
 *
 * 坐标约定：`children` 的 x/y 是**相对 group 原点**的坐标，与 DrawingML
 * `p:grpSp` 的 chOff/chExt 子坐标系语义一致（导出写 chOff=(0,0)、chExt=(w,h)）。
 * 渲染时子元素直接挂进已位于 group.x/y 的 Konva.Group，不需要再叠加一次原点。
 */
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

/**
 * 图表类型。命名与 pptxgenjs 的 `ChartType` 对齐，导出时直接查表映射。
 * 渲染侧由 echarts 离屏绘制成位图。
 */
export type ChartType =
  'bar' | 'barStacked' | 'barPercent' | 'line' | 'pie' | 'doughnut' | 'area' | 'scatter' | 'radar';

export interface ChartSeries {
  name: string;
  values: number[];
}

/** 图表视觉开关，字段与 pptxgenjs 的 chart 选项同名以便直接透传 */
export interface ChartOptions {
  legend?: boolean;
  dataLabels?: boolean;
  gridLines?: boolean;
  /** 自定义配色（#RRGGBB），缺省走主题 accent 色 */
  palette?: string[];
}

export interface ChartElement extends ElementBase {
  type: 'chart';
  chartType: ChartType;
  /** 类别轴标签 */
  categories: string[];
  series: ChartSeries[];
  options?: ChartOptions;
  /** 标题（可选） */
  title?: string;
  /**
   * 渲染缓存失效标记：数据或配色变化时自增，
   * 渲染层据此决定是否重建 echarts 实例。
   */
  revision?: number;
}

export interface FormulaElement extends ElementBase {
  type: 'formula';
  /** LaTeX 源码 */
  latex: string;
  /** 渲染字号（px） */
  fontSize?: number;
  color?: string;
}

export interface IconElement extends ElementBase {
  type: 'icon';
  /** `model/icons.ts` 内置图标 id */
  iconId: string;
  /** 单色图标着色（#RRGGBB）；缺省用 SVG 自带颜色 */
  color?: string;
}

export type SlideElement =
  | TextElement
  | ShapeElement
  | ImageElement
  | LineElement
  | TableElement
  | GroupElement
  | PlaceholderElement
  | ChartElement
  | FormulaElement
  | IconElement;

export interface Slide {
  id: string;
  layoutId?: string;
  /** 页面背景；未设置时沿用 layout/master */
  background?: SlideBackground;
  elements: SlideElement[];
  notes?: string;
}

export interface SlideLayout {
  id: string;
  masterId: string;
  name?: string;
  /** 布局上的占位符几何（必然带 PlaceholderRef） */
  elements: SlideElement[];
  background?: SlideBackground;
}

export interface SlideMaster {
  id: string;
  name?: string;
  /** 母版上的公共元素（Logo、页码占位符等） */
  elements: SlideElement[];
  background?: SlideBackground;
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
  /**
   * 文档结构版本号（区别于 `version` 的「变更计数」）。
   * v1 = 纯色背景；v2 = 支持 Fill 背景 + chart/formula/icon 元素 + run 级扩展属性。
   * 读取旧数据时由 `model/migrate.ts` 升到 `CURRENT_SCHEMA_VERSION`。
   */
  schemaVersion?: number;
}
