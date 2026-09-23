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

export type LayerKind = 'raster' | 'text' | 'shape';

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

export type Layer = RasterLayer | TextLayer | ShapeLayer;

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
