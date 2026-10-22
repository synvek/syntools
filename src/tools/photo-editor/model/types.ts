/**
 * 照片编辑器文档模型。
 *
 * 与幻灯片编辑器保持同一约定（`model/types.ts` 只描述数据，不含任何 DOM / Konva 类型）：
 * 位图像素不进文档，图层只持有 `assetId`，真正的画布保存在 `model/assets.ts` 的运行时注册表里。
 * 这样历史快照只需复制引用，撤销 / 重做不会反复深拷贝像素。
 */

/**
 * 图层混合模式：取值即 Canvas2D `globalCompositeOperation` 支持的混合模式。
 * 注意：线性加深 / 线性减淡 / 亮光 / 线性光 / 点光 / 实色混合等 PS 模式 Canvas2D 并不支持，
 * 强行加入会退化为「正常」，因此这里只收录渲染引擎真正能表达的取值。
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

/** 对齐到画布的方向（作用域：当前选中图层） */
export type AlignMode = 'left' | 'hcenter' | 'right' | 'top' | 'vcenter' | 'bottom';

/** 像素级滤镜（非 CSS filter 能表达的，走 ImageData 卷积 / 扫描） */
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
  // 扭曲
  | 'twirl'
  | 'spherize'
  | 'pinch'
  // 风格化
  | 'findEdges'
  | 'traceContour'
  // 渲染
  | 'clouds'
  | 'lensFlare'
  // 降噪
  | 'reduceNoise';

/**
 * 滤镜实例：`id` + 可调参数。
 * 旧工程里 `filters: FilterId[]` 会在 `model/migrate.ts` 中升级为带默认参数的规格数组。
 */
export interface FilterSpec {
  id: FilterId;
  params?: Record<string, number>;
  /**
   * 是否参与烘焙；`false` 表示「保留参数但暂时关闭」（智能滤镜列表里逐个启停）。
   * 缺省 / true = 启用。
   */
  enabled?: boolean;
}

/**
 * 图层类型：
 * - `raster` 位图（像素在资产注册表）
 * - `text` / `shape` 矢量呈现（导出时位图化）
 * - `group` 编组（组内子图层作为整体再合成，再套用本组的 opacity / blend）
 * - `adjustment` 调整图层（作用于其下方所有图层的合成结果，参数可反复改）
 * - `smart` 智能对象（保留源像素，缩放 / 变换不重采样）
 */
export type LayerKind = 'raster' | 'text' | 'shape' | 'group' | 'adjustment' | 'smart';

/**
 * 图层蒙版：灰度画布，同样放在资产注册表里（像素不进文档）。
 * 白 = 显示、黑 = 隐藏；`inverted` 为真时反相。
 */
export interface MaskRef {
  assetId: string;
  /** 蒙版像素版本号：绘制 / 填充后自增，驱动烘焙缓存失效 */
  rev: number;
  enabled: boolean;
  inverted: boolean;
  /** 浓度 0~1（1 = 完全按蒙版灰度） */
  density: number;
  /** 羽化半径（像素） */
  feather: number;
}

export type ShapeKind = 'rect' | 'roundRect' | 'ellipse' | 'line' | 'arrow' | 'star';

/**
 * 新建形状的默认样式（参数条可调，属于工具设置、不写进文档）。
 * 画布上落笔时由 `createShapeLayer` 取用，之后再改只影响新形状。
 */
export interface ShapeStyleDefaults {
  fill: string;
  stroke: string;
  strokeWidth: number;
  cornerRadius: number;
}

/* ------------------------------ 矢量蒙版 ------------------------------ */

/**
 * 矢量蒙版：按轮廓（路径）裁切图层，与分辨率无关 —— 缩放图层不会像像素蒙版那样糊掉。
 *
 * 轮廓复用选区的「并集 / 差集 + nonzero」语义（`SelectionPart`）：
 * 顶点为**图层局部坐标**（0,0 = 图层左上角），因此图层移动/缩放不影响蒙版形状。
 *
 * 限制：P1 只提供「从选区创建」，路径的手工编辑（钢笔）留待后续。
 */
export interface VectorMaskRef {
  enabled: boolean;
  inverted: boolean;
  contours: SelectionPart[];
  /** 羽化半径（像素），0 = 硬边 */
  feather: number;
}

/* ------------------------------ 图层样式 ------------------------------ */

/** 描边位置：外侧 / 居中 / 内侧 */
export type StrokePosition = 'outside' | 'center' | 'inside';

export interface DropShadowStyle {
  enabled: boolean;
  color: string;
  /** 0 ~ 1 */
  opacity: number;
  /** 光照角度（度）：阴影落在反方向 */
  angle: number;
  /** 偏移距离（像素） */
  distance: number;
  /** 扩展半径（像素）：整体变胖 */
  spread: number;
  /** 模糊半径（像素） */
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
 * 图层样式：非破坏的效果栈，统一作用于「图层的 alpha 剪影」。
 * 每种效果都是可选的（缺省 = 未添加），`enabled: false` 表示「参数保留但暂时关闭」。
 * 绘制顺序对齐 Photoshop：投影 → 外发光 → 描边（在内容之下），内容，内阴影 → 颜色叠加（在内容之上）。
 */
export interface LayerStyle {
  dropShadow?: DropShadowStyle | null;
  innerShadow?: InnerShadowStyle | null;
  outerGlow?: OuterGlowStyle | null;
  stroke?: StrokeStyle | null;
  colorOverlay?: ColorOverlayStyle | null;
}

export type TextAlign = 'left' | 'center' | 'right';

/** 色阶：输入黑白场 / 灰度系数 / 输出黑白场 */
export interface LevelsParams {
  inBlack: number;
  inWhite: number;
  gamma: number;
  outBlack: number;
  outWhite: number;
}

/** 曲线控制点（0~255 输入 → 0~255 输出） */
export interface CurvePoint {
  x: number;
  y: number;
}

/** 曲线：RGB 主通道 + 可选单通道 */
export interface CurvesParams {
  rgb: CurvePoint[];
  red?: CurvePoint[] | null;
  green?: CurvePoint[] | null;
  blue?: CurvePoint[] | null;
}

/** 色彩平衡：三区间 × 三条轴（青-红 / 洋红-绿 / 黄-蓝），取值 -100 ~ 100 */
export interface ColorBalanceParams {
  shadows: number[];
  midtones: number[];
  highlights: number[];
}

/** 黑白：六色权重，取值 -100 ~ 300 */
export interface BlackWhiteParams {
  red: number;
  yellow: number;
  green: number;
  cyan: number;
  blue: number;
  magenta: number;
}

/** 渐变映射的色标 */
export interface GradientStop {
  /** 0 ~ 1 */
  pos: number;
  color: string;
}

export interface GradientMapParams {
  stops: GradientStop[];
}

/** 照片滤镜：整幅叠一层带密度的彩色滤镜（模拟色温滤镜） */
export interface PhotoFilterParams {
  color: string;
  /** 0 ~ 100 */
  density: number;
  /** 保持明度：只改色相 / 饱和度，亮度还原为原图 */
  preserveLuminosity: boolean;
}

/**
 * 通道混合器：每个输出通道 = 源 R/G/B 的线性组合 + 常数。
 * 系数为百分比（-200 ~ 200），常数为百分比（-100 ~ 100，按 2.55/点 折算）。
 */
export interface ChannelMixerParams {
  /** 红输出：[来自 R, 来自 G, 来自 B, 常数] */
  red: number[];
  green: number[];
  blue: number[];
}

/**
 * 阴影 / 高光：提亮暗部、压暗亮部。
 * 简化实现（不做到「半径 / 局部对比」），用亮度加权的平滑曲线作用在全图。
 */
export interface ShadowsHighlightsParams {
  /** 0 ~ 100：提亮暗部 */
  shadows: number;
  /** 0 ~ 100：压暗亮部 */
  highlights: number;
}

/** 替换颜色：把接近目标色的像素按 HSL 偏移替换（容差内软过渡） */
export interface ReplaceColorParams {
  color: string;
  /** -180 ~ 180 */
  hue: number;
  /** -100 ~ 100 */
  saturation: number;
  /** -100 ~ 100 */
  lightness: number;
  /** 0 ~ 200：颜色匹配的容差 */
  fuzziness: number;
}

/** 可选颜色的 9 个色域 */
export type SelectiveRange =
  'reds' | 'yellows' | 'greens' | 'cyans' | 'blues' | 'magentas' | 'whites' | 'neutrals' | 'blacks';

/** 可选颜色：每个色域 4 个值 [青, 洋红, 黄, 黑]，绝对模式，-100 ~ 100 */
export interface SelectiveColorParams {
  ranges: Record<SelectiveRange, number[]>;
}

/**
 * 非破坏性调整参数：基础 7 项为「面板滑杆原始值」，扩展项为可选的参数化调整。
 * 扩展项缺省（null/undefined）表示未启用，渲染时按顺序依次作用：
 * 色阶 → 曲线 → 色彩平衡 → 黑白 → 阈值 → 渐变映射 → 去色 →
 * 照片滤镜 → 通道混合器 → 阴影 / 高光 → 可选颜色 → 替换颜色。
 */
export interface Adjustments {
  /** -100 ~ 100 */
  brightness: number;
  /** -100 ~ 100 */
  contrast: number;
  /** -100 ~ 100 */
  saturation: number;
  /** -180 ~ 180 度 */
  hue: number;
  /** -100 ~ 100，负值偏冷、正值偏暖 */
  temperature: number;
  /** -100 ~ 100 */
  exposure: number;
  /** 0 ~ 100 */
  sharpen: number;
  /** 色阶 */
  levels?: LevelsParams | null;
  /** 曲线 */
  curves?: CurvesParams | null;
  /** 色彩平衡 */
  colorBalance?: ColorBalanceParams | null;
  /** 黑白 */
  blackWhite?: BlackWhiteParams | null;
  /** 阈值（0 ~ 255）；null / undefined 表示关闭 */
  threshold?: number | null;
  /** 渐变映射 */
  gradientMap?: GradientMapParams | null;
  /** 去色 */
  desaturate?: boolean;
  /** 照片滤镜 */
  photoFilter?: PhotoFilterParams | null;
  /** 通道混合器 */
  channelMixer?: ChannelMixerParams | null;
  /** 阴影 / 高光 */
  shadowsHighlights?: ShadowsHighlightsParams | null;
  /** 可选颜色 */
  selectiveColor?: SelectiveColorParams | null;
  /** 替换颜色 */
  replaceColor?: ReplaceColorParams | null;
}

export interface LayerBase {
  id: string;
  name: string;
  kind: LayerKind;
  visible: boolean;
  locked: boolean;
  /** 锁定位置：禁止拖拽 / 变换（仍可被选中与编辑像素） */
  lockPosition?: boolean;
  /** 锁定透明像素：绘制只作用于已有像素，不新增内容 */
  lockAlpha?: boolean;
  /** 0 ~ 1 */
  opacity: number;
  blend: BlendMode;
  x: number;
  y: number;
  width: number;
  height: number;
  /** 角度制 */
  rotation: number;
  flipX: boolean;
  flipY: boolean;
  /**
   * 所属编组 id（扁平数组表示法：组内子图层紧随编组之后，子图层用 parentId 指回编组）。
   * 顶层图层为 null / 缺省。
   */
  parentId?: string | null;
  /** 编组展开态（仅 group 有意义） */
  expanded?: boolean;
  /** 图层蒙版；null / 缺省表示无蒙版 */
  mask?: MaskRef | null;
  /** 矢量蒙版；null / 缺省表示无 */
  vectorMask?: VectorMaskRef | null;
  /**
   * 剪贴蒙版：为真时本图层被「下方最近的基准图层」的 alpha 裁切（Photoshop 的 ⌘⌥G）。
   * 需要下方存在可绘制图层才生效，否则渲染时忽略。
   */
  clipped?: boolean;
  /** 图层样式；null / 缺省表示无样式 */
  style?: LayerStyle | null;
  /** 网格变形（透视 / 扭曲 / 斜切 / 变形）；null / 缺省 / 全零表示未变形 */
  mesh?: MeshWarp | null;
}

export interface RasterLayer extends LayerBase {
  kind: 'raster';
  /** 位图资产 id（`model/assets.ts` 运行时注册表） */
  assetId: string;
  /** 像素变更版本号：落笔 / 填充 / 裁剪后自增，用于烘焙缓存失效 */
  rev: number;
  adjustments: Adjustments;
  filters: FilterSpec[];
}

/** 文字变形（变形文字）：`kind` 决定位移场，`bend` / `horizontal` 为其强度（百分比 -100~100） */
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
 * 网格变形（自由变换家族的存储形态）。
 *
 * 统一用「控制点网格 + 归一化位移」表达四种变换模式：
 * - 2×2 网格（四角）= **透视** / **扭曲** / **斜切**（约束不同，存储相同）；
 * - 4×4 网格 = **变形（Warp）**，可拖任意控制点。
 *
 * 位移归一化到图层宽 / 高（`0.1` = 10% 宽），因此缩放图层时变形比例保持；
 * 每点两位 `(dx, dy)`，行优先（`index = row * cols + col`）。
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
  /** 行距倍数（相对字号） */
  lineHeight: number;
  /** 字距（px，可负） */
  letterSpacing: number;
  /** 段间距（px）：多段文字之间的额外间距 */
  paragraphSpacing: number;
  /** 变形文字参数 */
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

/** 编组：自身不承载像素，语义是「把子图层先合成成一个整体」 */
export interface GroupLayer extends LayerBase {
  kind: 'group';
  /**
   * 穿透：组内子图层各自按自己的混合模式与下方内容混合（Photoshop 的「穿透」）。
   * 关闭时，组内先合成到离屏画布，再整体按本组的 blend / opacity 与下方混合。
   */
  passThrough: boolean;
}

/** 调整图层：作用于其下方栈的合成结果，参数可随时改（非破坏性） */
export interface AdjustmentLayer extends LayerBase {
  kind: 'adjustment';
  adjustments: Adjustments;
  filters: FilterSpec[];
}

/**
 * 智能对象：保留源像素（`sourceAssetId` + 原始尺寸），
 * 画布上的 width / height / rotation 只是「呈现变换」，不重采样源数据。
 */
export interface SmartLayer extends LayerBase {
  kind: 'smart';
  sourceAssetId: string;
  sourceWidth: number;
  sourceHeight: number;
  /** 非破坏调整参数：与位图图层同一套，作用在呈现结果上 */
  adjustments: Adjustments;
  /**
   * 智能滤镜栈：作用在**呈现尺寸**上的可反复改参滤镜。
   *
   * 与位图图层的 `filters` 是同一套规格（`FilterSpec`），区别只在于施加时机：
   * 位图滤镜烘焙在源像素分辨率上，智能滤镜先把源缩放到当前呈现尺寸再烘焙，
   * 因此改缩放不会让模糊半径等参数「跟着一起缩放」。
   */
  filters: FilterSpec[];
}

export type Layer =
  RasterLayer | TextLayer | ShapeLayer | GroupLayer | AdjustmentLayer | SmartLayer;

export type CanvasBackground = 'transparent' | 'white' | 'black';

export interface PhotoDoc {
  id: string;
  /** 文档名，同时作为导出文件名来源 */
  name: string;
  width: number;
  height: number;
  background: CanvasBackground;
  /** 数组尾部为最上层 */
  layers: Layer[];
  activeLayerId: string | null;
  /** 文档色板（随工程保存）：`#RRGGBB` 列表 */
  swatches: string[];
}

export type SelectionKind = 'rect' | 'ellipse' | 'lasso';

/**
 * 选区的追加轮廓（布尔运算的结果）。
 * `add: true` 为并集（加选），`false` 为差集（减选）；统一用多边形顶点表示。
 *
 * 语义：选区 = （主轮廓 ∪ 加选轮廓）∖（洞 ∪ 减选轮廓）。
 * 渲染与裁剪统一走 **nonzero 填充规则**，因此轮廓方向必须规范化
 * （见 `core.ts` 的 `orientPolygon`），重叠的加选轮廓才会正确取并集而不是异或。
 */
export interface SelectionPart {
  path: number[];
  add: boolean;
}

/** 选区：会话态，不进文档历史 */
export interface Selection {
  kind: SelectionKind;
  /** 外接矩形（文档坐标） */
  x: number;
  y: number;
  width: number;
  height: number;
  /** 套索顶点（文档坐标，[x0,y0,x1,y1,...]），矩形 / 椭圆选区为空 */
  path: number[];
  /** 内轮廓（挖洞）：反选时保存原始选区形状，命中判定与裁剪都按填充规则挖空 */
  hole?: number[];
  /** 布尔运算追加的轮廓 */
  parts?: SelectionPart[];
  /** 羽化半径（像素） */
  feather: number;
}

/**
 * 操作名（i18n 键后缀，展示时拼成 `tools.photo.<label>`）。
 * 存键而不是文案，切换语言时历史面板才会跟着变。
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
 * 历史条目。
 *
 * 语义约定：`past[i].doc` 是「执行 past[i].label 之前」的状态，
 * 因此面板第 i 行展示的**操作名**取自 `past[i-1].label`（第 0 行为 `histOpen`）；
 * `future[j]` 存的是「做完该操作之后」的状态，操作名即其自身的 `label`。
 */
export interface HistoryEntry {
  doc: PhotoDoc;
  label: HistoryLabel;
  at: number;
}

export interface Viewport {
  /** 0 = 尚未适配，宿主会按容器大小自动 fit */
  scale: number;
  x: number;
  y: number;
}

/** 参考线：位置统一用文档坐标（与视口缩放 / 平移无关） */
export interface Guide {
  axis: 'h' | 'v';
  pos: number;
}

/** 辅助视图开关（视图态，不进文档历史） */
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
