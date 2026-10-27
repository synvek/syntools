/**
 * Photo editor document model.
 *
 * Same conventions as the slide editor (`model/types.ts` describes data only, with no DOM / Konva types):
 * bitmap pixels never enter the document; layers hold only an `assetId`, and the real canvases live in the
 * `model/assets.ts` runtime registry, so history snapshots copy references instead of deep-copying pixels.
 */

/**
 * Layer blend modes: the values are exactly what Canvas2D `globalCompositeOperation` supports.
 * Note: PS modes such as linear burn / linear dodge / vivid light / linear light / pin light / hard mix are not
 * supported by Canvas2D and would degrade to "normal", so only values the engine can render are listed.
 */
export type BlendMode =
  | 'normal'
  | 'multiply'
  | 'screen'
  | 'overlay'
  | 'soft-light'
  | 'hard-light'
  | 'darken'
  | 'lighten'
  | 'color-dodge'
  | 'color-burn'
  | 'difference'
  | 'exclusion'
  | 'hue'
  | 'saturation'
  | 'color'
  | 'luminosity';

/** Canvas alignment direction (scope: the selected layer) */
export type AlignMode = 'left' | 'hcenter' | 'right' | 'top' | 'vcenter' | 'bottom';

/** Pixel-level filters (the ones CSS filter can't express; they run ImageData convolution / scans) */
export type FilterId =
  | 'grayscale'
  | 'sepia'
  | 'invert'
  | 'blur'
  | 'gaussianBlur'
  | 'motionBlur'
  | 'sharpen'
  | 'unsharp'
  | 'emboss'
  | 'edge'
  | 'noise'
  | 'pixelate'
  | 'posterize'
  // Distort
  | 'twirl'
  | 'spherize'
  | 'pinch'
  // Stylize
  | 'findEdges'
  | 'traceContour'
  // Render
  | 'clouds'
  | 'lensFlare'
  // Noise reduction
  | 'reduceNoise';

/**
 * Filter instance: an `id` plus adjustable parameters.
 * Old projects store `filters: FilterId[]`, upgraded in `model/migrate.ts` to specs with defaults.
 */
export interface FilterSpec {
  id: FilterId;
  params?: Record<string, number>;
  /**
   * Whether it takes part in baking; `false` means "keep the parameters, off for now" (one smart filter at a time).
   * Absent / true = enabled.
   */
  enabled?: boolean;
}

/**
 * Layer kinds:
 * - `raster`: bitmap (pixels in the asset registry)
 * - `text` / `shape`: vector rendering (rasterized on export)
 * - `group`: children are composited into one image, then the group's opacity / blend applies
 * - `adjustment`: acts on the composite of everything below it, with re-editable parameters
 * - `smart`: smart object (keeps source pixels; scaling / transforming does not resample)
 */
export type LayerKind = 'raster' | 'text' | 'shape' | 'group' | 'adjustment' | 'smart';

/**
 * Layer mask: a grayscale canvas, also kept in the asset registry (pixels stay out of the document).
 * White = shown, black = hidden; when `inverted` is true the values are flipped.
 */
export interface MaskRef {
  assetId: string;
  /** Mask pixel revision: bumped after painting / filling to invalidate the bake cache */
  rev: number;
  enabled: boolean;
  inverted: boolean;
  /** Density 0~1 (1 = follow the mask's grayscale exactly) */
  density: number;
  /** Feather radius (px) */
  feather: number;
}

export type ShapeKind = 'rect' | 'roundRect' | 'ellipse' | 'line' | 'arrow' | 'star';

/**
 * Default style for new shapes (set in the options bar; a tool setting, never written to the document).
 * `createShapeLayer` reads it when drawing; later edits only affect new shapes.
 */
export interface ShapeStyleDefaults {
  fill: string;
  stroke: string;
  strokeWidth: number;
  cornerRadius: number;
}

/* ------------------------------ Vector mask ------------------------------ */

/**
 * Vector mask: clips the layer by outlines (paths) and is resolution-independent — scaling never blurs it.
 *
 * Outlines reuse the selection's "union / difference + nonzero" semantics (`SelectionPart`):
 * vertices are in **layer-local coordinates** (0,0 = layer top-left), so moving / scaling the layer is neutral.
 *
 * Limitation: P1 only offers "create from selection"; manual path editing (pen) comes later.
 */
export interface VectorMaskRef {
  enabled: boolean;
  inverted: boolean;
  contours: SelectionPart[];
  /** Feather radius (px), 0 = hard edge */
  feather: number;
}

/* ------------------------------ Layer styles ------------------------------ */

/** Stroke position: outside / center / inside */
export type StrokePosition = 'outside' | 'center' | 'inside';

export interface DropShadowStyle {
  enabled: boolean;
  color: string;
  /** 0 ~ 1 */
  opacity: number;
  /** Light angle (degrees): the shadow falls on the opposite side */
  angle: number;
  /** Offset distance (px) */
  distance: number;
  /** Spread radius (px): fattens the effect overall */
  spread: number;
  /** Blur radius (px) */
  size: number;
}

export interface InnerShadowStyle {
  enabled: boolean;
  color: string;
  opacity: number;
  angle: number;
  distance: number;
  size: number;
}

export interface OuterGlowStyle {
  enabled: boolean;
  color: string;
  opacity: number;
  size: number;
}

export interface StrokeStyle {
  enabled: boolean;
  color: string;
  opacity: number;
  size: number;
  position: StrokePosition;
}

export interface ColorOverlayStyle {
  enabled: boolean;
  color: string;
  opacity: number;
}

/**
 * Layer styles: a non-destructive effect stack, all acting on the layer's alpha silhouette.
 * Every effect is optional (absent = not added); `enabled: false` means "keep the parameters, off for now".
 * Draw order follows Photoshop: shadow → outer glow → stroke (below content), content, inner shadow → overlay.
 */
export interface LayerStyle {
  dropShadow?: DropShadowStyle | null;
  innerShadow?: InnerShadowStyle | null;
  outerGlow?: OuterGlowStyle | null;
  stroke?: StrokeStyle | null;
  colorOverlay?: ColorOverlayStyle | null;
}

export type TextAlign = 'left' | 'center' | 'right';

/** Levels: input black / white points, gamma, output black / white points */
export interface LevelsParams {
  inBlack: number;
  inWhite: number;
  gamma: number;
  outBlack: number;
  outWhite: number;
}

/** Curve control point (0~255 input → 0~255 output) */
export interface CurvePoint {
  x: number;
  y: number;
}

/** Curves: master RGB plus optional per-channel overrides */
export interface CurvesParams {
  rgb: CurvePoint[];
  red?: CurvePoint[] | null;
  green?: CurvePoint[] | null;
  blue?: CurvePoint[] | null;
}

/** Color balance: three ranges × three axes (cyan-red / magenta-green / yellow-blue), values -100 ~ 100 */
export interface ColorBalanceParams {
  shadows: number[];
  midtones: number[];
  highlights: number[];
}

/** Black & white: six color weights, values -100 ~ 300 */
export interface BlackWhiteParams {
  red: number;
  yellow: number;
  green: number;
  cyan: number;
  blue: number;
  magenta: number;
}

/** A gradient map stop */
export interface GradientStop {
  /** 0 ~ 1 */
  pos: number;
  color: string;
}

export interface GradientMapParams {
  stops: GradientStop[];
}

/** Photo filter: overlay a colored, density-weighted filter (simulates color-temperature filters) */
export interface PhotoFilterParams {
  color: string;
  /** 0 ~ 100 */
  density: number;
  /** Preserve luminosity: change only hue / saturation, restoring the original brightness */
  preserveLuminosity: boolean;
}

/**
 * Channel mixer: each output channel = a linear combination of source R/G/B plus a constant.
 * Coefficients are percentages (-200 ~ 200), and so are constants (-100 ~ 100, scaled at 2.55 per point).
 */
export interface ChannelMixerParams {
  /** Red output: [from R, from G, from B, constant] */
  red: number[];
  green: number[];
  blue: number[];
}

/**
 * Shadows / highlights: lift the darks and pull down the brights.
 * Simplified (no radius / local contrast): a luminance-weighted smooth curve applied to the whole image.
 */
export interface ShadowsHighlightsParams {
  /** 0 ~ 100: lift the shadows */
  shadows: number;
  /** 0 ~ 100: pull down the highlights */
  highlights: number;
}

/** Replace color: shift pixels near the target color by an HSL offset (soft falloff within the tolerance) */
export interface ReplaceColorParams {
  color: string;
  /** -180 ~ 180 */
  hue: number;
  /** -100 ~ 100 */
  saturation: number;
  /** -100 ~ 100 */
  lightness: number;
  /** 0 ~ 200: color match tolerance */
  fuzziness: number;
}

/** The 9 selective-color ranges */
export type SelectiveRange =
  'reds' | 'yellows' | 'greens' | 'cyans' | 'blues' | 'magentas' | 'whites' | 'neutrals' | 'blacks';

/** Selective color: 4 values per range [cyan, magenta, yellow, black], absolute mode, -100 ~ 100 */
export interface SelectiveColorParams {
  ranges: Record<SelectiveRange, number[]>;
}

/**
 * Non-destructive adjustments: the 7 basics are raw panel slider values; the extras are optional adjustments.
 * An absent extra (null / undefined) is off; rendering applies them in this order:
 * levels → curves → color balance → black & white → threshold → gradient map → desaturate →
 * photo filter → channel mixer → shadows / highlights → selective color → replace color.
 */
export interface Adjustments {
  /** -100 ~ 100 */
  brightness: number;
  /** -100 ~ 100 */
  contrast: number;
  /** -100 ~ 100 */
  saturation: number;
  /** -180 ~ 180 degrees */
  hue: number;
  /** -100 ~ 100; negative is cooler, positive warmer */
  temperature: number;
  /** -100 ~ 100 */
  exposure: number;
  /** 0 ~ 100 */
  sharpen: number;
  /** Levels */
  levels?: LevelsParams | null;
  /** Curves */
  curves?: CurvesParams | null;
  /** Color balance */
  colorBalance?: ColorBalanceParams | null;
  /** Black & white */
  blackWhite?: BlackWhiteParams | null;
  /** Threshold (0 ~ 255); null / undefined means off */
  threshold?: number | null;
  /** Gradient map */
  gradientMap?: GradientMapParams | null;
  /** Desaturate */
  desaturate?: boolean;
  /** Photo filter */
  photoFilter?: PhotoFilterParams | null;
  /** Channel mixer */
  channelMixer?: ChannelMixerParams | null;
  /** Shadows / highlights */
  shadowsHighlights?: ShadowsHighlightsParams | null;
  /** Selective color */
  selectiveColor?: SelectiveColorParams | null;
  /** Replace color */
  replaceColor?: ReplaceColorParams | null;
}

export interface LayerBase {
  id: string;
  name: string;
  kind: LayerKind;
  visible: boolean;
  locked: boolean;
  /** Lock position: no dragging / transforming (still selectable and pixel-editable) */
  lockPosition?: boolean;
  /** Lock transparent pixels: painting only touches existing pixels and never adds content */
  lockAlpha?: boolean;
  /** 0 ~ 1 */
  opacity: number;
  blend: BlendMode;
  x: number;
  y: number;
  width: number;
  height: number;
  /** Degrees */
  rotation: number;
  flipX: boolean;
  flipY: boolean;
  /**
   * Owning group id (flat-array notation: children follow the group and point back via parentId).
   * Top-level layers are null / absent.
   */
  parentId?: string | null;
  /** Group expansion state (only meaningful for groups) */
  expanded?: boolean;
  /** Layer mask; null / absent means none */
  mask?: MaskRef | null;
  /** Vector mask; null / absent means none */
  vectorMask?: VectorMaskRef | null;
  /**
   * Clipping mask: when true, this layer is clipped by the alpha of the nearest base layer below (PS ⌘⌥G).
   * Requires a drawable layer below; otherwise rendering ignores it.
   */
  clipped?: boolean;
  /** Layer style; null / absent means none */
  style?: LayerStyle | null;
  /** Mesh warp (perspective / distort / skew / warp); null / absent / all-zero means undeformed */
  mesh?: MeshWarp | null;
}

export interface RasterLayer extends LayerBase {
  kind: 'raster';
  /** Bitmap asset id (runtime registry in `model/assets.ts`) */
  assetId: string;
  /** Pixel revision: bumped after painting / filling / cropping, to invalidate the bake cache */
  rev: number;
  adjustments: Adjustments;
  filters: FilterSpec[];
}

/** Text warp: `kind` picks the displacement field, `bend` / `horizontal` scale it (percent, -100 ~ 100) */
export interface TextWarp {
  kind: TextWarpKind;
  bend: number;
  horizontal: number;
}

export type TextWarpKind =
  | 'none'
  | 'arc'
  | 'arcLower'
  | 'arcUpper'
  | 'arch'
  | 'shellLower'
  | 'shellUpper'
  | 'wave'
  | 'flag'
  | 'rise'
  | 'fisheye';

/**
 * Mesh warp (the storage form of the free-transform family).
 *
 * One "control-point grid + normalized offsets" model expresses all four modes:
 * - 2×2 grid (four corners) = **perspective** / **distort** / **skew** (different constraints, same storage);
 * - 4×4 grid = **warp**, where any control point can be dragged.
 *
 * Offsets are normalized to the layer width / height (`0.1` = 10% of the width), so the warp keeps its ratio;
 * each point has two components `(dx, dy)`, row-major (`index = row * cols + col`).
 */
export interface MeshWarp {
  cols: number;
  rows: number;
  points: number[];
}

export interface TextLayer extends LayerBase {
  kind: 'text';
  text: string;
  fontSize: number;
  fontFamily: string;
  fill: string;
  bold: boolean;
  italic: boolean;
  underline: boolean;
  align: TextAlign;
  /** Line height multiplier (relative to the font size) */
  lineHeight: number;
  /** Tracking (px, may be negative) */
  letterSpacing: number;
  /** Paragraph spacing (px): extra space between paragraphs */
  paragraphSpacing: number;
  /** Text warp parameters */
  warp: TextWarp;
}

export interface ShapeLayer extends LayerBase {
  kind: 'shape';
  shape: ShapeKind;
  fill: string;
  stroke: string;
  strokeWidth: number;
  cornerRadius: number;
}

/** Group: carries no pixels itself; its semantics are "composite the children into one image first" */
export interface GroupLayer extends LayerBase {
  kind: 'group';
  /**
   * Pass-through: children blend with what is below using their own modes (Photoshop's "pass through").
   * When off, the group composites to an offscreen canvas, then blends as a whole with its blend / opacity.
   */
  passThrough: boolean;
}

/** Adjustment layer: acts on the composite below it, with re-editable parameters (non-destructive) */
export interface AdjustmentLayer extends LayerBase {
  kind: 'adjustment';
  adjustments: Adjustments;
  filters: FilterSpec[];
}

/**
 * Smart object: keeps the source pixels (`sourceAssetId` plus the original size);
 * width / height / rotation on the canvas are only a presentation transform and never resample the source.
 */
export interface SmartLayer extends LayerBase {
  kind: 'smart';
  sourceAssetId: string;
  sourceWidth: number;
  sourceHeight: number;
  /** Non-destructive adjustments: the same set as bitmap layers, applied to the rendered result */
  adjustments: Adjustments;
  /**
   * Smart filter stack: adjustable filters applied at the **presentation size**.
   *
   * Same spec as a bitmap layer's `filters` (`FilterSpec`); only the moment of application differs:
   * bitmap filters bake at the source resolution, while smart filters first scale the source to the
   * presentation size and then bake, so changing the scale doesn't scale the blur radius along with it.
   */
  filters: FilterSpec[];
}

export type Layer =
  RasterLayer | TextLayer | ShapeLayer | GroupLayer | AdjustmentLayer | SmartLayer;

export type CanvasBackground = 'transparent' | 'white' | 'black';

export interface PhotoDoc {
  id: string;
  /** Document name, also the basis for exported file names */
  name: string;
  width: number;
  height: number;
  background: CanvasBackground;
  /** The tail of the array is the topmost layer */
  layers: Layer[];
  activeLayerId: string | null;
  /** Document palette (saved with the project): a list of `#RRGGBB` */
  swatches: string[];
}

export type SelectionKind = 'rect' | 'ellipse' | 'lasso';

/**
 * Extra selection outlines appended by boolean ops.
 * `add: true` unions (adds), `false` subtracts; all of them are polygon vertices.
 *
 * Semantics: selection = (main outline ∪ added outlines) ∖ (holes ∪ subtracted outlines).
 * Rendering and clipping both use the **nonzero fill rule**, so outline direction must be normalized
 * (see `orientPolygon` in `core.ts`), or overlapping added outlines would XOR instead of union.
 */
export interface SelectionPart {
  path: number[];
  add: boolean;
}

/** Selection: session state, never part of document history */
export interface Selection {
  kind: SelectionKind;
  /** Bounding box (document coordinates) */
  x: number;
  y: number;
  width: number;
  height: number;
  /** Lasso vertices (document coords, [x0,y0,x1,y1,...]); empty for rect / oval selections */
  path: number[];
  /** Inner outlines (holes): invert keeps the original shape, and hit tests / clipping punch them out */
  hole?: number[];
  /** Outlines appended by boolean ops */
  parts?: SelectionPart[];
  /** Feather radius (px) */
  feather: number;
}

/**
 * Operation name (an i18n key suffix, rendered as `tools.photo.<label>`).
 * Storing keys instead of text lets the history panel follow language switches.
 */
export type HistoryLabel =
  | 'histOpen'
  | 'histEdit'
  | 'histBrush'
  | 'histErase'
  | 'histFill'
  | 'histGradient'
  | 'histRetouch'
  | 'histCrop'
  | 'histResize'
  | 'histAddLayer'
  | 'histDeleteLayer'
  | 'histDuplicate'
  | 'histReorder'
  | 'histMerge'
  | 'histFlatten'
  | 'histMove'
  | 'histRename'
  | 'histGroup'
  | 'histMask'
  | 'histAdjust'
  | 'histStyle'
  | 'histVectorMask'
  | 'histClip'
  | 'histSwatch'
  | 'histTransform';

/**
 * History entry.
 *
 * Semantics: `past[i].doc` is the state before `past[i].label` ran,
 * so row i of the panel takes its operation name from `past[i-1].label` (row 0 is `histOpen`);
 * `future[j]` holds the state after its operation, whose name is its own `label`.
 */
export interface HistoryEntry {
  doc: PhotoDoc;
  label: HistoryLabel;
  at: number;
}

export interface Viewport {
  /** 0 = not yet fitted; the host auto-fits to the container size */
  scale: number;
  x: number;
  y: number;
}

/** Guide: positions are always document coordinates (independent of viewport zoom / pan) */
export interface Guide {
  axis: 'h' | 'v';
  pos: number;
}

/** Auxiliary view toggles (view state, not part of document history) */
export interface ViewOverlay {
  rulers: boolean;
  grid: boolean;
  gridSize: number;
  guides: Guide[];
}

export type ToolId =
  | 'move'
  | 'transform'
  | 'rectSelect'
  | 'ellipseSelect'
  | 'lasso'
  | 'polyLasso'
  | 'magneticLasso'
  | 'wand'
  | 'quickSelect'
  | 'crop'
  | 'brush'
  | 'eraser'
  | 'eyedropper'
  | 'sampler'
  | 'fill'
  | 'gradient'
  | 'dodge'
  | 'burn'
  | 'sponge'
  | 'cloneStamp'
  | 'healing'
  | 'spotHeal'
  | 'smudge'
  | 'blurBrush'
  | 'sharpenBrush'
  | 'text'
  | 'shape'
  | 'hand';

export interface Rect {
  x: number;
  y: number;
  width: number;
  height: number;
}
