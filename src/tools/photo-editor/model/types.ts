/**
 * 照片编辑器文档模型。
 *
 * 与幻灯片编辑器保持同一约定（`model/types.ts` 只描述数据，不含任何 DOM / Konva 类型）：
 * 位图像素不进文档，图层只持有 `assetId`，真正的画布保存在 `model/assets.ts` 的运行时注册表里。
 * 这样历史快照只需复制引用，撤销 / 重做不会反复深拷贝像素。
 */

/** 图层混合模式：取值即 Canvas2D `globalCompositeOperation` 支持的混合模式 */
export type BlendMode =
  | 'normal'
  | 'multiply'
  | 'screen'
  | 'overlay'
  | 'darken'
  | 'lighten'
  | 'color-dodge'
  | 'difference'
  | 'exclusion'
  | 'hue'
  | 'saturation'
  | 'color'
  | 'luminosity';

/** 像素级滤镜（非 CSS filter 能表达的，走 ImageData 卷积 / 扫描） */
export type FilterId =
  | 'grayscale'
  | 'sepia'
  | 'invert'
  | 'blur'
  | 'sharpen'
  | 'emboss'
  | 'edge'
  | 'noise'
  | 'pixelate'
  | 'posterize';

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

export type TextAlign = 'left' | 'center' | 'right';

/** 非破坏性调整参数：均为「面板滑杆原始值」，渲染时再换算 */
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
}

export interface LayerBase {
  id: string;
  name: string;
  kind: LayerKind;
  visible: boolean;
  locked: boolean;
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
}

export interface RasterLayer extends LayerBase {
  kind: 'raster';
  /** 位图资产 id（`model/assets.ts` 运行时注册表） */
  assetId: string;
  /** 像素变更版本号：落笔 / 填充 / 裁剪后自增，用于烘焙缓存失效 */
  rev: number;
  adjustments: Adjustments;
  filters: FilterId[];
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
  lineHeight: number;
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
  filters: FilterId[];
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
}

export type SelectionKind = 'rect' | 'ellipse' | 'lasso';

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
  /** 内轮廓（挖洞）：反选时保存原始选区形状，命中判定与裁剪都按奇偶规则挖空 */
  hole?: number[];
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
  | 'histAdjust';

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

export type ToolId =
  | 'move'
  | 'rectSelect'
  | 'ellipseSelect'
  | 'lasso'
  | 'crop'
  | 'brush'
  | 'eraser'
  | 'eyedropper'
  | 'fill'
  | 'text'
  | 'shape'
  | 'hand';

export interface Rect {
  x: number;
  y: number;
  width: number;
  height: number;
}
