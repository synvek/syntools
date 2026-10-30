/**
 * Slide editor data model contract.
 *
 * Units: the model uses canvas px (96dpi) internally; EMU conversion happens only at the
 * pptx import/export boundary (1 inch = 914400 EMU = 96px → 1px = 9525 EMU, exact).
 */

import type { CommentThread } from '../../../core/comments/model';

/** Background/fill with no paint */
export interface NoFill {
  type: 'none';
}

export interface SolidFill {
  type: 'solid';
  /** #RRGGBB */
  color: string;
  /** 0~1, DrawingML alpha (100000 = 100%) already converted */
  alpha?: number;
}

export interface GradientStop {
  /** 0~1 */
  offset: number;
  color: string;
}

export interface GradientFill {
  type: 'gradient';
  /** Linear gradient angle in degrees; converted from pptx clockwise `lin ang` */
  angle?: number;
  stops: GradientStop[];
}

export type Fill = NoFill | SolidFill | GradientFill;

/**
 * Slide background form.
 *
 * Historically `background` was a plain color string; since v2 it is a `Fill` (gradients
 * supported). Reading old projects/drafts normalizes it via `normalizeBackground()`, so the
 * `string` branch is kept here for compatibility with existing data.
 */
export type SlideBackground = string | Fill;

export interface Stroke {
  color: string;
  /** Line width in px */
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
  /** Point size (pt) */
  size?: number;
  font?: string;
  color?: string;
  /** Letter spacing (pt), maps to DrawingML `a:spc` */
  spacing?: number;
  /**
   * Baseline offset (DrawingML `baseline`, in units of 0.1%).
   * Positive = superscript, negative = subscript; 0 = normal.
   */
  baseline?: number;
  /** Character highlight background (#RRGGBB) */
  highlight?: string;
  /** Run-level hyperlink (DrawingML `a:hlinkClick`) */
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
  /** Numbered list (DrawingML buAutoNum), mutually exclusive with bullet */
  numbering?: boolean;
  /** Line spacing multiplier (1.2 = 120%) */
  lineSpacing?: number;
  /** Space before/after paragraph (px) */
  spaceBefore?: number;
  spaceAfter?: number;
  /** Indent (px) */
  indent?: number;
}

export interface TextBody {
  paragraphs: Paragraph[];
  anchor?: VAlign;
  wrap?: boolean;
  autoFit?: 'none' | 'autofit';
  /** Inner margins (px) */
  margins?: { left: number; top: number; right: number; bottom: number };
  /** Vertical text (DrawingML `a:bodyPr vert`) */
  vert?: TextVert;
}

/** Text direction */
export type TextVert = 'horz' | 'vert' | 'vert270' | 'wordArtVert';

/**
 * One command of a DrawingML `a:custGeom` path, in **normalized 0~1** coordinates.
 * Normalized so the shape can be resized without rewriting the path; rendering scales it,
 * export multiplies it back into the `a:path@w/h` space.
 */
export type PathCommand =
  | { c: 'M'; x: number; y: number }
  | { c: 'L'; x: number; y: number }
  | { c: 'C'; x1: number; y1: number; x2: number; y2: number; x: number; y: number }
  | { c: 'Q'; x1: number; y1: number; x: number; y: number }
  | { c: 'Z' };

/** DrawingML prstGeom → render-ready geometry description */
export interface ShapeGeometry {
  /** Render form: rect (optionally rounded) / ellipse / star / closed polygon / SVG path */
  kind: 'rect' | 'ellipse' | 'star' | 'polygon' | 'path';
  /** Corner radius ratio when kind==='rect' (0~0.5, relative to the short side) */
  radius?: number;
  /** Normalized vertices (0~1), kind==='polygon' */
  points?: number[];
  /** Normalized SVG path, kind==='path' */
  path?: string;
  /**
   * Explicit custom geometry (normalized commands). When present it wins over `prst`,
   * both when rendering and when exporting (`a:custGeom` is written instead of `a:prstGeom`).
   */
  custGeom?: PathCommand[];
  /** Star inner ratio (0~1), kind==='star' */
  innerRatio?: number;
  /**
   * DrawingML adjustment values, keyed `adj1`/`adj2`… and normalized to 0~1.
   * The preset definition (`model/shapeDefs.ts`) turns them into the render geometry;
   * export writes them to `a:avLst`, import reads them back.
   */
  adj?: Record<string, number>;
  /** Original prstGeom name, written back first on export */
  prst: string;
}

export interface PlaceholderRef {
  /** title / body / ctrTitle / subTitle / dt / sldNum / ftr / pic / tbl ... */
  kind: string;
  index?: string;
}

/** Shadow style (subset of DrawingML `a:outerShdw`) */
export interface ShadowStyle {
  color: string;
  /** Blur radius (px, value after EMU conversion) */
  blur: number;
  offsetX: number;
  offsetY: number;
  /** 0~1, defaults to 1 */
  opacity?: number;
}

interface ElementBase {
  id: string;
  x: number;
  y: number;
  width: number;
  height: number;
  /** Clockwise angle */
  rotation?: number;
  flipX?: boolean;
  flipY?: boolean;
  opacity?: number;
  name?: string;
  /** Locked: cannot be selected or dragged, but still rendered and exported */
  locked?: boolean;
  /** Hidden: not rendered, not exported (visible by default; a missing field means visible) */
  visible?: boolean;
  placeholder?: PlaceholderRef;
  /** Element-level hyperlink (DrawingML `a:hlinkClick`, applies to the whole element) */
  hyperlink?: string;
  /** Shadow */
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
  /** Points to SlideDoc.media */
  mediaId: string;
  /** Crop ratios 0~1 (fraction cropped from left/top/right/bottom) */
  crop?: { left: number; top: number; right: number; bottom: number };
  cornerRadius?: number;
  stroke?: Stroke;
}

/** Arrow head/tail style (DrawingML `a:headEnd` / `a:tailEnd`). */
export type ArrowKind = 'none' | 'arrow' | 'triangle' | 'diamond' | 'oval' | 'stealth';

/**
 * Connector endpoint binding. When `shapeId` is set, the endpoint follows the shape's
 * connection site (`site`, 0–7 clockwise from top); otherwise the point stays free.
 */
export interface ConnectorEnd {
  shapeId?: string;
  /** Connection site index: 0 top, 2 right, 4 bottom, 6 left (odd values are corners). */
  site?: number;
}

export interface LineElement extends ElementBase {
  type: 'line';
  /** Start/end points (offsets relative to x/y, in the pre-rotation coordinate system) */
  points: number[];
  stroke: Stroke;
  /** Arrow at the start of the line */
  head?: ArrowKind;
  /** Arrow at the end of the line */
  tail?: ArrowKind;
  /** Start endpoint bound to a shape connection site */
  startCxn?: ConnectorEnd;
  /** End endpoint bound to a shape connection site */
  endCxn?: ConnectorEnd;
  /** Routing for bound connectors; free lines stay straight */
  route?: 'straight' | 'elbow';
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
   * Cells covered by a merge (DrawingML hMerge / vMerge="1").
   * OOXML requires these cells to still exist (they just don't paint content), so the model keeps
   * them with a marker: removing them from the row array would misalign colWidths against grid columns.
   */
  covered?: boolean;
  /** Covered direction: h = horizontal merge from the left neighbor, v = vertical merge from above */
  coveredBy?: 'h' | 'v';
}

export interface TableElement extends ElementBase {
  type: 'table';
  rows: TableCell[][];
  /** Sum of column widths ≈ width (px) */
  colWidths: number[];
  rowHeights: number[];
  headerRow?: boolean;
  bandRow?: boolean;
  borderColor?: string;
}

/**
 * Group element.
 *
 * Coordinates: `children` x/y are relative to the **group origin**, matching the DrawingML
 * `p:grpSp` chOff/chExt sub-coordinate semantics (export writes chOff=(0,0), chExt=(w,h)).
 * At render time children attach directly to a Konva.Group already at group.x/y — no double origin.
 */
export interface GroupElement extends ElementBase {
  type: 'group';
  children: SlideElement[];
}

export interface PlaceholderElement extends ElementBase {
  type: 'placeholder';
  /** Original pptx element type, e.g. chart / diagram / oleObj */
  sourceKind: string;
  label: string;
}

/**
 * Chart type. Names align with pptxgenjs `ChartType` so export maps them via a lookup.
 * The render side draws them offscreen with echarts into a bitmap.
 */
export type ChartType =
  'bar' | 'barStacked' | 'barPercent' | 'line' | 'pie' | 'doughnut' | 'area' | 'scatter' | 'radar';

export interface ChartSeries {
  name: string;
  values: number[];
}

/** Chart visual toggles; field names match pptxgenjs chart options so they pass through as-is */
export interface ChartOptions {
  legend?: boolean;
  dataLabels?: boolean;
  gridLines?: boolean;
  /** Custom palette (#RRGGBB); defaults to theme accent colors */
  palette?: string[];
}

export interface ChartElement extends ElementBase {
  type: 'chart';
  chartType: ChartType;
  /** Category axis labels */
  categories: string[];
  series: ChartSeries[];
  options?: ChartOptions;
  /** Title (optional) */
  title?: string;
  /**
   * Render cache invalidation marker: increments when data or palette changes,
   * letting the render layer decide whether to rebuild the echarts instance.
   */
  revision?: number;
}

export interface FormulaElement extends ElementBase {
  type: 'formula';
  /** LaTeX source */
  latex: string;
  /** Render font size (px) */
  fontSize?: number;
  color?: string;
}

export interface IconElement extends ElementBase {
  type: 'icon';
  /** Built-in icon id from `model/icons.ts` */
  iconId: string;
  /** Monochrome icon tint (#RRGGBB); defaults to the SVG's own color */
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

/** 页面切换效果（P2-5）：只做淡出/推入，其余在导入时降级为"无"并进保真提示 */
export type SlideTransitionType = 'none' | 'fade' | 'push';

export interface SlideTransition {
  type: SlideTransitionType;
  /** ms */
  duration: number;
  advanceOnClick: boolean;
}

/** 入场效果：只做淡入/飞入，避免"模型说有、播放不出来" */
export type AnimationEffect = 'fadeIn' | 'flyIn';

/** 触发方式：单击 / 与上一动画同时 / 上一动画之后 */
export type AnimationTrigger = 'onClick' | 'withPrevious' | 'afterPrevious';

export interface AnimationStep {
  id: string;
  elementId: string;
  effect: AnimationEffect;
  /** 动画本身时长（ms） */
  duration: number;
  /** 相对触发点的延迟（ms） */
  delay: number;
  trigger: AnimationTrigger;
}

export interface Slide {
  id: string;
  layoutId?: string;
  /** Slide background; falls back to layout/master when unset */
  background?: SlideBackground;
  elements: SlideElement[];
  notes?: string;
  /** 页面切换；缺省表示无切换 */
  transition?: SlideTransition;
  /** 入场动画，按顺序播放（顺序即动画窗格里的次序） */
  animations?: AnimationStep[];
}

export interface SlideLayout {
  id: string;
  masterId: string;
  name?: string;
  /** Placeholder geometry on the layout (always carries a PlaceholderRef) */
  elements: SlideElement[];
  background?: SlideBackground;
}

export interface SlideMaster {
  id: string;
  name?: string;
  /** Shared elements on the master (logo, slide-number placeholder, ...) */
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
  /** DrawingML clrScheme: dk1/lt1/dk2/lt2/accent1..6/hlink/folHlink → #RRGGBB */
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
  /** Runtime-resolved objectURL (not persisted) */
  url?: string;
}

export interface SlideDoc {
  id: string;
  name: string;
  /** Comment threads (P1-2); anchored to elements or page points, persisted with the document */
  comments?: CommentThread[];
  /** Slide size (px @96dpi) */
  width: number;
  height: number;
  theme: SlideTheme;
  masters: SlideMaster[];
  layouts: SlideLayout[];
  slides: Slide[];
  media: Record<string, MediaAsset>;
  /** Increments on every structural change, used to invalidate thumbnail caches */
  version: number;
  /**
   * Document schema version (distinct from the `version` change counter).
   * v1 = solid backgrounds; v2 = Fill backgrounds + chart/formula/icon elements + run-level extras.
   * Reading old data upgrades to `CURRENT_SCHEMA_VERSION` via `model/migrate.ts`.
   */
  schemaVersion?: number;
}
