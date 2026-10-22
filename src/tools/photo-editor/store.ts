import { create } from 'zustand';
import {
  MAX_RETOUCH_STRENGTH,
  MAX_SAMPLES,
  MAX_VECTOR_CONTOURS,
  WARP_COLS,
  WARP_ROWS,
  applyTransformDelta,
  createMesh,
  MAX_VECTOR_FEATHER,
  clampBrushSize,
  clampRect,
  clipBaseIndex,
  clampSpacing,
  clampUnit,
  createColorOverlay,
  selectionToVectorContours,
  createDropShadow,
  createInnerShadow,
  createOuterGlow,
  createStroke,
  fullSelection,
  hexToRgb,
  intersectRect,
  invertSelection,
  moveSubtree,
  normalizeViewRotation,
  polygonBounds,
  rgbToHex,
  selectionFromMask,
  simplifyPath,
} from './core';
import type {
  BrushPreset,
  ChannelView,
  GradientKind,
  GradientMode,
  SamplePoint,
  SnapGuide,
  StyleEffectId,
  TransformDelta,
  TransformMode,
} from './core';
import { loadBrushPresets, saveBrushPresets } from './brushes';
import { normalizeLayerStyle } from './model/migrate';
import {
  cloneAsset,
  collectUsedAssets,
  createCanvasElement,
  getCanvas,
  registerCanvas,
  releaseExcept,
} from './model/assets';
import { paintSelection } from './render/brush';
import { channelViewCanvas, extractDocPalette } from './render/channels';
import { clearMeshCache } from './render/mesh';
import { clearWarpCache } from './render/warp';
import { compositeDoc, rasterizeSelection } from './render/export';
import { applySelectionOp, modifySelection as modifySelectionRaster } from './render/selection';
import type { SelectionModify, SelectionOp } from './render/selection';
import { paintDoc, paintLayer } from './render/paint';
import {
  cloneDoc,
  cloneLayer,
  createAdjustments,
  createAdjustmentLayer,
  createDoc,
  createGroupLayer,
  createId,
  createMaskRef,
  createRasterLayer,
  createShapeLayer,
  createSmartLayer,
  createTextLayer,
} from './model/factory';
import { createBlankAsset } from './model/assets';
import { createMaskCanvas, createMaskCanvasFromSelection } from './render/mask';
import type {
  AlignMode,
  HistoryEntry,
  HistoryLabel,
  MaskRef,
  Layer,
  LayerStyle,
  PhotoDoc,
  Rect,
  Selection,
  ShapeKind,
  ShapeStyleDefaults,
  ToolId,
  VectorMaskRef,
  ViewOverlay,
  Viewport,
} from './model/types';
import { defaultPanelLayout, normalizePanelLayout, panelGroupOf } from './panels';
import type { PanelGroupId, PanelId, PanelLayout } from './panels';

/**
 * 照片编辑器状态：唯一真相源是 `doc`，其余（当前工具 / 选区 / 视口 / 历史）是会话态。
 *
 * 与 slide-editor 一致：所有改 doc 的 action 先 `commit()` 压快照，保证 undo 可回放。
 * 额外约定：**像素级操作必须先 `commitPixels(layerId)`** —— 它会把该图层的位图复制一份，
 * 让历史快照指向「落笔前」的像素，否则撤销只能还原坐标而无法还原笔迹。
 */

const HISTORY_LIMIT = 24;

/** 文档色板容量上限 */
const MAX_SWATCHES = 32;

/** 图层样式各效果的默认参数（新增效果时使用，默认启用） */
const STYLE_DEFAULTS: Record<StyleEffectId, () => NonNullable<LayerStyle[StyleEffectId]>> = {
  dropShadow: createDropShadow,
  innerShadow: createInnerShadow,
  outerGlow: createOuterGlow,
  stroke: createStroke,
  colorOverlay: createColorOverlay,
};
/** 缩放下限：允许缩到 2% 以观察超大画布全貌，但不会把「待适配」哨兵值也钳到这里 */
const MIN_ZOOM = 0.02;

export interface BrushConfig {
  /** 前景色 */
  color: string;
  /** 背景色（渐变工具的第二个端点 / 前景↔背景切换用） */
  background: string;
  size: number;
  /** 0~1，1 为硬边 */
  hardness: number;
  opacity: number;
  /** 落笔间距（相对直径）：越小越连续 */
  spacing: number;
  /** 压感控制笔触大小 */
  pressureSize: boolean;
  /** 压感控制不透明度 */
  pressureOpacity: boolean;
}

/**
 * 快速蒙版：以「一张灰度画布」临时替代选区 —— 白 = 选中、黑 = 未选中。
 *
 * 与选区的关系：进入时按当前选区初始化，退出时按亮度阈值转回选区。
 * `rev` 用于让视图层知道画布变了（画笔直接改写画布，不经过 React）。
 */
interface QuickMaskState {
  assetId: string;
  rev: number;
}

interface PhotoState {
  doc: PhotoDoc;
  tool: ToolId;
  brush: BrushConfig;
  eraserSize: number;
  shapeKind: ShapeKind;
  /** 新建形状的默认填充 / 描边（参数条可调，不写进文档） */
  shapeStyle: ShapeStyleDefaults;
  /** 磁性套索：吸附宽度（文档像素）与边缘对比度阈值 */
  magnetic: { width: number; contrast: number };
  selection: Selection | null;
  cropRect: Rect | null;
  viewport: Viewport;
  /** 辅助视图（标尺 / 网格 / 参考线），视图态，不进历史 */
  overlay: ViewOverlay;
  clipboard: Layer | null;
  /** 历史：快照 + 操作名 + 时间（面板按此展示，可跳转） */
  past: HistoryEntry[];
  future: HistoryEntry[];
  /** 右侧面板布局（视图态，不进文档历史） */
  panels: PanelLayout;
  /** 油漆桶：容差 / 是否只填充连通区域 */
  fillTolerance: number;
  fillContiguous: boolean;
  /** 渐变工具：形状与端点组合 */
  gradientKind: GradientKind;
  gradientMode: GradientMode;
  /** 润饰 / 修复工具族（减淡加深海绵、图章、修复、涂抹、模糊锐化）：笔头大小与强度 */
  retouchSize: number;
  retouchStrength: number;
  /** 自定义画笔预设（持久化） */
  brushPresets: BrushPreset[];
  /** 最近使用颜色（会话态） */
  recentColors: string[];

  loadDoc: (doc: PhotoDoc) => void;
  resetDoc: () => void;
  setDocName: (name: string) => void;
  setBackground: (background: PhotoDoc['background']) => void;
  resizeCanvas: (width: number, height: number) => void;
  /** 一次性应用画布尺寸与背景（单次历史提交，供「画布大小」/ 文档属性使用） */
  applyCanvas: (width: number, height: number, background: PhotoDoc['background']) => void;

  /**
   * 设置图层样式某一效果的参数（效果不存在时按默认值创建）；值会被钳制到合法区间。
   * `history = false` 用于滑杆拖动中：与 AdjustPanel 同一约定，避免每一帧都压一条历史。
   */
  setLayerStyle: (
    id: string,
    effect: StyleEffectId,
    patch: Record<string, string | number | boolean>,
    history?: boolean,
  ) => void;
  /** 添加 / 启停某一效果 */
  toggleLayerStyle: (id: string, effect: StyleEffectId) => void;
  /** 移除某一效果 */
  removeLayerStyle: (id: string, effect: StyleEffectId) => void;
  /** 清空整份图层样式 */
  clearLayerStyle: (id: string) => void;

  setTool: (tool: ToolId) => void;
  patchBrush: (patch: Partial<BrushConfig>) => void;
  setEraserSize: (size: number) => void;
  setShapeKind: (kind: ShapeKind) => void;
  /** 修改新建形状的默认样式（填充 / 描边 / 描边宽度 / 圆角） */
  setShapeStyle: (patch: Partial<ShapeStyleDefaults>) => void;
  /** 修改磁性套索的宽度 / 对比度 */
  setMagnetic: (patch: Partial<{ width: number; contrast: number }>) => void;
  /** 油漆桶设置 */
  setFill: (patch: { tolerance?: number; contiguous?: boolean }) => void;
  /** 渐变工具设置 */
  setGradient: (patch: { kind?: GradientKind; mode?: GradientMode }) => void;
  /** 润饰工具设置 */
  setRetouch: (patch: { size?: number; strength?: number }) => void;
  /** 前景 / 背景色互换（快捷键 X） */
  swapColors: () => void;
  /** 复位为黑前景 / 白背景（快捷键 D） */
  resetColors: () => void;
  /** 记录最近使用的颜色（去重，最多 12 个） */
  pushRecentColor: (color: string) => void;
  /** 保存当前画笔参数为自定义预设 */
  saveBrushPreset: (name: string) => void;
  removeBrushPreset: (id: string) => void;
  /** 应用预设到当前画笔 */
  applyBrushPreset: (preset: BrushPreset) => void;

  setSelection: (selection: Selection | null) => void;
  /** 按布尔运算合并选区（加选 / 减选 / 交集 / 替换） */
  applySelection: (next: Selection, op: SelectionOp) => void;
  /** 改当前选区的羽化半径 */
  setSelectionFeather: (feather: number) => void;
  /** 选区形态学修改：扩展 / 收缩 / 平滑 */
  modifySelection: (mode: SelectionModify, amount: number) => void;
  /** 魔棒设置 */
  wandTolerance: number;
  wandContiguous: boolean;
  setWand: (patch: { tolerance?: number; contiguous?: boolean }) => void;
  /** 全选（Ctrl+A） */
  selectAll: () => void;
  /** 反选：画布外框 + 原选区内框（奇偶规则） */
  invertSelection: () => void;
  /** 填充 / 清除当前选区内容（作用于位图图层） */
  fillSelectionArea: (mode: 'fill' | 'clear') => void;
  /** 通过拷贝新建图层：选区内容 → 新位图图层 */
  copySelectionToLayer: () => void;
  setCropRect: (rect: Rect | null) => void;
  applyCrop: () => void;

  setViewport: (patch: Partial<Viewport>) => void;
  setScale: (scale: number) => void;
  /** 辅助视图：合并式更新（标尺 / 网格 / 参考线） */
  patchOverlay: (patch: Partial<ViewOverlay>) => void;

  selectLayer: (id: string | null) => void;
  addLayer: (layer: Layer) => void;
  patchLayer: (id: string, patch: Partial<Layer>, history?: boolean) => void;
  patchActive: (patch: Partial<Layer>, history?: boolean) => void;
  removeLayer: (id: string) => void;
  /** copySuffix：复制出的图层名后缀（由 UI 传入当前语言，如「 副本」） */
  duplicateLayer: (id: string, copySuffix?: string) => void;
  /** 新建空编组（置于最上层） */
  addGroup: () => string | null;
  /** 用当前图层新建编组：图层被移入组内 */
  groupActive: () => string | null;
  /** 解散编组：子图层上移一层，编组本身删除 */
  ungroup: (id: string) => void;
  /** 把图层（连同子树）移入编组；groupId 为 null 表示移到顶层 */
  moveIntoGroup: (layerId: string, groupId: string | null) => void;
  toggleGroupExpanded: (id: string) => void;
  /** 用当前选区创建矢量蒙版（轮廓转为图层局部坐标，与分辨率无关） */
  addVectorMask: (id: string) => void;
  /** 矢量蒙版参数：启停 / 反相 / 羽化 */
  patchVectorMask: (id: string, patch: Partial<VectorMaskRef>, history?: boolean) => void;
  removeVectorMask: (id: string) => void;
  /** 创建 / 释放剪贴蒙版（PS 的 ⌘⌥G）；下方没有可作基准的图层时不生效 */
  toggleClipping: (id: string) => boolean;

  /** 给图层加蒙版：show = 全部显示，hide = 全部隐藏，selection = 按当前选区 */
  /** 新建调整图层（置于最上层，作用于其下方全部内容） */
  addAdjustment: () => string | null;
  /** 位图 → 智能对象：保留源像素，画布上的尺寸只是呈现变换 */
  convertToSmart: (id: string) => void;
  /** 智能对象 → 普通位图（栅格化），像素按当前呈现尺寸重采样 */
  rasterizeSmart: (id: string) => void;
  addMask: (id: string, mode?: 'show' | 'hide' | 'selection') => void;
  removeMask: (id: string) => void;
  /** 改蒙版参数（浓度 / 羽化 / 反相 / 启用） */
  patchMask: (id: string, patch: Partial<MaskRef>, history?: boolean) => void;
  /** 蒙版像素级快照（绘制前调用） */
  commitMask: (id: string) => void;
  /** 旋转视图（度，视图态，不进历史） */
  viewRotation: number;
  /** 相对当前角度继续旋转（菜单按 15° 步进） */
  rotateView: (delta: number) => void;
  setViewRotation: (degrees: number) => void;
  resetViewRotation: () => void;

  /** 对齐吸附开关（视图态，默认开） */
  snapEnabled: boolean;
  setSnapEnabled: (value: boolean) => void;
  /** 当前正在生效的吸附参考线（拖拽过程中显示，松手即清空） */
  snapGuides: SnapGuide[];
  setSnapGuides: (guides: SnapGuide[]) => void;

  /** 图章 / 修复的取样点（文档坐标，会话态） */
  cloneSource: { x: number; y: number } | null;
  setCloneSource: (point: { x: number; y: number } | null) => void;
  /** 自由变换模式：自由 / 透视 / 扭曲 / 斜切 / 变形 */
  transformMode: TransformMode;
  setTransformMode: (mode: TransformMode) => void;
  /** 清空当前图层的网格变形 */
  resetMesh: (layerId?: string) => void;
  /** 上一次变换的增量（⌘⇧T「再次变换」用） */
  lastTransform: TransformDelta | null;
  /** 记录一次变换（由交互层在松手时提交） */
  recordTransform: (delta: TransformDelta | null) => void;
  /** 再次变换：把上次的增量再作用到当前图层 */
  repeatTransform: () => void;

  /** 快速蒙版会话（null = 未进入） */
  quickMask: QuickMaskState | null;
  /** 进入快速蒙版：以当前选区初始化（无选区则全为「未选中」） */
  enterQuickMask: () => void;
  /** 退出快速蒙版：按亮度阈值把蒙版转回选区 */
  exitQuickMask: () => void;
  /** Q 键切换 */
  toggleQuickMask: () => void;
  /** 蒙版被涂抹后提交一次视觉刷新 */
  bumpQuickMask: () => void;

  /** 通道隔离显示（仅影响画布呈现，不改文档） */
  channelView: ChannelView;
  setChannelView: (view: ChannelView) => void;
  /** 把当前隔离通道的亮部载入为选区（阈值 128）；处于复合视图时不生效 */
  loadChannelSelection: () => void;
  /** 颜色取样点（会话态，最多 `MAX_SAMPLES` 个） */
  samples: SamplePoint[];
  /** 在文档坐标处取样；超过上限时挤掉最早的一个 */
  addSample: (x: number, y: number) => void;
  removeSample: (index: number) => void;
  clearSamples: () => void;
  /** 文档色板（随工程保存） */
  addSwatch: (color: string) => void;
  removeSwatch: (index: number) => void;
  /** 从当前画面提取主色并并入色板 */
  extractSwatches: () => void;

  /** 画笔是否写入蒙版（而非图层本体） */
  maskEditing: boolean;
  setMaskEditing: (value: boolean) => void;
  /** 面板布局：整体替换 / 切换某个面板内的子 tab / 显示某个子面板 / 复位 */
  setPanels: (layout: PanelLayout) => void;
  setPanelTab: (group: PanelGroupId, id: PanelId) => void;
  showPanel: (id: PanelId) => void;
  resetPanels: () => void;
  setGroupPassThrough: (id: string, passThrough: boolean) => void;
  reorderLayer: (id: string, toIndex: number) => void;
  /** 在「同一父级」内上移 / 下移一层（不跨编组边界） */
  moveLayer: (id: string, dir: -1 | 1) => void;
  /** 把当前选中图层对齐到画布 */
  alignLayer: (mode: AlignMode) => void;
  mergeDown: (id: string) => void;
  flattenVisible: () => void;
  copyLayer: () => void;
  pasteLayer: () => void;
  /** 保证存在一个可落笔的位图图层（没有就新建整画布大小的空白图层） */
  ensurePaintLayer: () => string | null;
  /** text：新建文字图层的默认内容（由 UI 传入当前语言） */
  addTextLayer: (x: number, y: number, text?: string) => string | null;
  addShapeLayer: (rect: Rect) => string | null;
  addImageLayer: (assetId: string, width: number, height: number, name: string) => void;
  /** 位图被就地改写后调用：自增 rev 使烘焙缓存失效 */
  bumpRev: (id: string) => void;

  /** `label` 为该操作在历史面板中的名字（缺省 `histEdit`） */
  commit: (label?: HistoryLabel) => void;
  commitPixels: (id: string, label?: HistoryLabel) => void;
  /** 跳到时间轴第 index 行（0 = 最初状态，past.length = 当前） */
  jumpTo: (index: number) => void;
  /** 清空历史（释放可回收资产） */
  clearHistory: () => void;
  undo: () => void;
  redo: () => void;
}

/** 给缺失位图的图层补一张空白画布 */
function repairRasterAsset(get: () => PhotoState, id: string): string {
  const layer = get().doc.layers.find((item) => item.id === id);
  const width = Math.max(1, Math.round(layer?.width ?? get().doc.width));
  const height = Math.max(1, Math.round(layer?.height ?? get().doc.height));
  get().patchLayer(id, { assetId: createBlankAsset(width, height) }, false);
  get().bumpRev(id);
  return id;
}

/**
 * 历史中被引用到的资产：回收时必须一并保留，否则撤销会拿到已释放的画布。
 * 快速蒙版画布也在这里登记 —— 它不属于任何文档，但撤销 / 重做期间仍然要能继续涂抹。
 */
function usedAssetsAcrossHistory(
  state: Pick<PhotoState, 'doc' | 'past' | 'future'> & {
    quickMask?: { assetId: string } | null;
  },
): Set<string> {
  const used = new Set<string>();
  const collect = (doc: PhotoDoc) => {
    for (const id of collectUsedAssets(doc.layers)) used.add(id);
  };
  collect(state.doc);
  for (const entry of state.past) collect(entry.doc);
  for (const entry of state.future) collect(entry.doc);
  if (state.quickMask) used.add(state.quickMask.assetId);
  return used;
}

export const usePhotoStore = create<PhotoState>((set, get) => ({
  doc: createDoc(),
  tool: 'move',
  brush: {
    color: '#111827',
    background: '#FFFFFF',
    size: 12,
    hardness: 0.9,
    opacity: 1,
    spacing: 0.1,
    pressureSize: false,
    pressureOpacity: false,
  },
  eraserSize: 24,
  shapeKind: 'rect',
  shapeStyle: { fill: '#2563EB', stroke: '#1D4ED8', strokeWidth: 0, cornerRadius: 12 },
  magnetic: { width: 10, contrast: 30 },
  selection: null,
  cropRect: null,
  viewport: { scale: 0, x: 0, y: 0 },
  overlay: { rulers: false, grid: false, gridSize: 40, guides: [] },
  clipboard: null,
  maskEditing: false,
  past: [],
  future: [],
  panels: defaultPanelLayout(),
  fillTolerance: 32,
  fillContiguous: true,
  gradientKind: 'linear',
  gradientMode: 'fg-transparent',
  retouchSize: 60,
  retouchStrength: 30,
  brushPresets: loadBrushPresets(),
  recentColors: [],
  channelView: 'rgb',
  samples: [],
  quickMask: null,
  transformMode: 'free',
  lastTransform: null,
  cloneSource: null,
  snapEnabled: true,
  snapGuides: [],
  viewRotation: 0,

  loadDoc: (doc) => {
    set((s) => ({
      doc,
      selection: null,
      cropRect: null,
      viewport: { ...s.viewport, scale: 0 },
      past: [],
      future: [],
    }));
    releaseExcept(usedAssetsAcrossHistory(get()));
    // 换文档后旧文档的变形位图不会再被命中，主动清掉避免白白占内存
    clearMeshCache();
    clearWarpCache();
  },

  resetDoc: () => {
    set({
      selection: null,
      cropRect: null,
      past: [],
      future: [],
      viewport: { scale: 0, x: 0, y: 0 },
    });
    get().loadDoc(createDoc());
  },

  setDocName: (name) => set((s) => ({ doc: { ...s.doc, name } })),

  setBackground: (background) => set((s) => ({ doc: { ...s.doc, background } })),

  resizeCanvas: (width, height) => {
    get().commit('histResize');
    set((s) => ({ doc: { ...s.doc, width, height } }));
  },

  applyCanvas: (width, height, background) => {
    const current = get().doc;
    if (current.width === width && current.height === height && current.background === background) {
      return;
    }
    get().commit('histResize');
    set((s) => ({ doc: { ...s.doc, width, height, background } }));
  },

  setLayerStyle: (id, effect, patch, history = true) => {
    const state = get();
    const layer = state.doc.layers.find((item) => item.id === id);
    if (!layer) return;
    if (history) state.commit('histStyle');
    const current = layer.style?.[effect] ?? STYLE_DEFAULTS[effect]();
    const merged = { ...(layer.style ?? {}), [effect]: { ...current, ...patch } };
    const style = normalizeLayerStyle(merged);
    set((s) => ({
      doc: {
        ...s.doc,
        layers: s.doc.layers.map((item) => (item.id === id ? { ...item, style } : item)),
      },
    }));
  },

  toggleLayerStyle: (id, effect) => {
    const state = get();
    const layer = state.doc.layers.find((item) => item.id === id);
    if (!layer) return;
    state.commit('histStyle');
    const current = layer.style?.[effect] ?? STYLE_DEFAULTS[effect]();
    const style = normalizeLayerStyle({
      ...(layer.style ?? {}),
      [effect]: { ...current, enabled: !current.enabled },
    });
    set((s) => ({
      doc: {
        ...s.doc,
        layers: s.doc.layers.map((item) => (item.id === id ? { ...item, style } : item)),
      },
    }));
  },

  removeLayerStyle: (id, effect) => {
    const state = get();
    const layer = state.doc.layers.find((item) => item.id === id);
    if (!layer?.style) return;
    state.commit('histStyle');
    const next: LayerStyle = { ...layer.style };
    delete next[effect];
    const style = normalizeLayerStyle(next);
    set((s) => ({
      doc: {
        ...s.doc,
        layers: s.doc.layers.map((item) => (item.id === id ? { ...item, style } : item)),
      },
    }));
  },

  clearLayerStyle: (id) => {
    const state = get();
    const layer = state.doc.layers.find((item) => item.id === id);
    if (!layer?.style) return;
    state.commit('histStyle');
    set((s) => ({
      doc: {
        ...s.doc,
        layers: s.doc.layers.map((item) => (item.id === id ? { ...item, style: null } : item)),
      },
    }));
  },

  setTool: (tool) =>
    set((s) => ({
      tool,
      // 切走裁剪工具时丢弃未应用的裁剪框；选区则保留（移动 / 画笔 / 填充都受其约束）
      cropRect: tool === 'crop' ? s.cropRect : null,
    })),

  patchBrush: (patch) =>
    set((s) => ({
      brush: {
        ...s.brush,
        ...patch,
        ...(patch.opacity !== undefined ? { opacity: clampUnit(patch.opacity) } : {}),
        ...(patch.hardness !== undefined ? { hardness: clampUnit(patch.hardness) } : {}),
        ...(patch.spacing !== undefined ? { spacing: clampSpacing(patch.spacing) } : {}),
        ...(patch.size !== undefined ? { size: clampBrushSize(patch.size) } : {}),
      },
    })),

  setEraserSize: (size) => set({ eraserSize: size }),
  setShapeKind: (kind) => set({ shapeKind: kind }),

  setShapeStyle: (patch) => set((s) => ({ shapeStyle: { ...s.shapeStyle, ...patch } })),

  setMagnetic: (patch) => set((s) => ({ magnetic: { ...s.magnetic, ...patch } })),

  setFill: (patch) =>
    set((s) => ({
      fillTolerance:
        patch.tolerance === undefined
          ? s.fillTolerance
          : Math.max(0, Math.min(255, Math.round(patch.tolerance))),
      fillContiguous: patch.contiguous ?? s.fillContiguous,
    })),

  setGradient: (patch) =>
    set((s) => ({
      gradientKind: patch.kind ?? s.gradientKind,
      gradientMode: patch.mode ?? s.gradientMode,
    })),

  setRetouch: (patch) =>
    set((s) => ({
      retouchSize: patch.size === undefined ? s.retouchSize : clampBrushSize(patch.size),
      retouchStrength:
        patch.strength === undefined
          ? s.retouchStrength
          : Math.max(1, Math.min(MAX_RETOUCH_STRENGTH, Math.round(patch.strength))),
    })),

  swapColors: () =>
    set((s) => ({ brush: { ...s.brush, color: s.brush.background, background: s.brush.color } })),

  resetColors: () =>
    set((s) => ({ brush: { ...s.brush, color: '#000000', background: '#FFFFFF' } })),

  pushRecentColor: (color) => {
    const value = color.toUpperCase();
    set((s) => ({
      recentColors: [value, ...s.recentColors.filter((item) => item !== value)].slice(0, 12),
    }));
  },

  saveBrushPreset: (name) => {
    const { brush, brushPresets } = get();
    const preset: BrushPreset = {
      id: createId('brush'),
      name: name.trim() || `#${brushPresets.length + 1}`,
      size: brush.size,
      hardness: brush.hardness,
      opacity: brush.opacity,
      spacing: brush.spacing,
    };
    const next = [...brushPresets, preset].slice(0, 12);
    saveBrushPresets(next);
    set({ brushPresets: next });
  },

  removeBrushPreset: (id) => {
    const next = get().brushPresets.filter((item) => item.id !== id);
    saveBrushPresets(next);
    set({ brushPresets: next });
  },

  applyBrushPreset: (preset) =>
    set((s) => ({
      brush: {
        ...s.brush,
        size: clampBrushSize(preset.size),
        hardness: clampUnit(preset.hardness),
        opacity: clampUnit(preset.opacity),
        spacing: clampSpacing(preset.spacing),
      },
    })),

  setSelection: (selection) => set({ selection }),

  applySelection: (next, op) => {
    const state = get();
    const feather = state.selection?.feather ?? next.feather;
    const result = applySelectionOp(state.selection, next, op, state.doc);
    set({ selection: result ? { ...result, feather } : null });
  },

  setSelectionFeather: (feather) =>
    set((s) =>
      s.selection
        ? { selection: { ...s.selection, feather: Math.max(0, Math.round(feather)) } }
        : {},
    ),

  modifySelection: (mode, amount) =>
    set((s) => {
      if (!s.selection) return {};
      const result = modifySelectionRaster(s.selection, mode, amount, s.doc);
      return { selection: result ? { ...result, feather: s.selection.feather } : null };
    }),

  wandTolerance: 32,
  wandContiguous: true,
  setWand: (patch) =>
    set((s) => ({
      wandTolerance:
        patch.tolerance === undefined
          ? s.wandTolerance
          : Math.max(0, Math.min(255, Math.round(patch.tolerance))),
      wandContiguous: patch.contiguous ?? s.wandContiguous,
    })),

  selectAll: () => set((s) => ({ selection: fullSelection(s.doc) })),

  invertSelection: () =>
    set((s) => ({
      selection: s.selection ? invertSelection(s.selection, s.doc) : fullSelection(s.doc),
    })),

  /**
   * 填充 / 清除选区：作用于当前位图图层。
   * 先 commitPixels 复制落笔前的像素，保证一次撤销能还原。
   */
  fillSelectionArea: (mode) => {
    const state = get();
    if (!state.selection) return;
    const layerId = state.ensurePaintLayer();
    if (!layerId) return;
    get().commitPixels(layerId, mode === 'fill' ? 'histFill' : 'histErase');
    const layer = get().doc.layers.find((item) => item.id === layerId);
    if (!layer || layer.kind !== 'raster') return;
    const changed = paintSelection(
      layer,
      state.selection,
      mode,
      mode === 'clear' ? '#000000' : state.brush.color,
      mode === 'fill' && Boolean(layer.lockAlpha),
    );
    if (changed) get().bumpRev(layerId);
  },

  /** 通过拷贝新建图层：把选区内的合成结果拷成一个新位图图层 */
  copySelectionToLayer: () => {
    const state = get();
    const selection = state.selection;
    if (!selection || selection.width < 1 || selection.height < 1) return;
    const masked = rasterizeSelection(state.doc, selection);
    if (!masked) return;

    const layer = createRasterLayer({
      assetId: registerCanvas(masked),
      x: Math.round(selection.x),
      y: Math.round(selection.y),
      width: masked.width,
      height: masked.height,
      name: '',
    });
    get().addLayer(layer);
  },

  setCropRect: (rect) =>
    set((s) => ({
      cropRect: rect ? clampRect(rect, { width: s.doc.width, height: s.doc.height }) : null,
    })),

  applyCrop: () => {
    const state = get();
    const rect = state.cropRect;
    if (!rect || rect.width < 2 || rect.height < 2) return;
    const inner = intersectRect(rect, {
      x: 0,
      y: 0,
      width: state.doc.width,
      height: state.doc.height,
    });
    if (!inner) return;
    get().commit('histCrop');
    const doc = get().doc;
    const layers: Layer[] = [];
    for (const layer of doc.layers) {
      const bounds = { x: layer.x, y: layer.y, width: layer.width, height: layer.height };
      if (layer.kind === 'raster') {
        const asset = getCanvas(layer.assetId);
        const inter = intersectRect(bounds, inner);
        if (!asset || !inter) continue;
        const scaleX = asset.width / Math.max(1, layer.width);
        const scaleY = asset.height / Math.max(1, layer.height);
        const sx = (inter.x - layer.x) * scaleX;
        const sy = (inter.y - layer.y) * scaleY;
        const sw = Math.max(1, Math.round(inter.width * scaleX));
        const sh = Math.max(1, Math.round(inter.height * scaleY));
        const canvas = createCanvasElement(sw, sh);
        const ctx = canvas.getContext('2d');
        if (!ctx) continue;
        ctx.drawImage(asset, sx, sy, sw, sh, 0, 0, sw, sh);
        layers.push({
          ...layer,
          assetId: registerCanvas(canvas),
          rev: layer.rev + 1,
          x: inter.x - inner.x,
          y: inter.y - inner.y,
          width: inter.width,
          height: inter.height,
        });
      } else {
        layers.push({ ...layer, x: layer.x - inner.x, y: layer.y - inner.y });
      }
    }
    set({
      doc: { ...doc, width: Math.round(inner.width), height: Math.round(inner.height), layers },
      cropRect: null,
      tool: 'move',
    });
    releaseExcept(usedAssetsAcrossHistory(get()));
  },

  setViewport: (patch) => set((s) => ({ viewport: { ...s.viewport, ...patch } })),

  patchOverlay: (patch) => set((s) => ({ overlay: { ...s.overlay, ...patch } })),

  setScale: (scale) =>
    set((s) => ({
      viewport: {
        ...s.viewport,
        // scale === 0 是「尚未适配」哨兵值，不能被钳制——否则适应窗口会被锁在最小比例。
        // 画布宿主按容器算出真实比例后会写回，此后始终是正数。
        scale: scale <= 0 ? 0 : Math.min(8, Math.max(MIN_ZOOM, Math.round(scale * 1000) / 1000)),
      },
    })),

  selectLayer: (id) => set((s) => ({ doc: { ...s.doc, activeLayerId: id } })),

  addLayer: (layer) => {
    get().commit('histAddLayer');
    set((s) => ({
      doc: { ...s.doc, layers: [...s.doc.layers, layer], activeLayerId: layer.id },
    }));
  },

  patchLayer: (id, patch, history = true) => {
    if (history) get().commit('histEdit');
    set((s) => ({
      doc: {
        ...s.doc,
        layers: s.doc.layers.map((layer) =>
          layer.id === id ? ({ ...layer, ...patch } as Layer) : layer,
        ),
      },
    }));
  },

  patchActive: (patch, history = true) => {
    const id = get().doc.activeLayerId;
    if (!id) return;
    get().patchLayer(id, patch, history);
  },

  removeLayer: (id) => {
    get().commit('histDeleteLayer');
    set((s) => {
      const layers = s.doc.layers.filter((layer) => layer.id !== id);
      return {
        doc: {
          ...s.doc,
          layers,
          activeLayerId:
            s.doc.activeLayerId === id
              ? (layers[layers.length - 1]?.id ?? null)
              : s.doc.activeLayerId,
        },
      };
    });
    releaseExcept(usedAssetsAcrossHistory(get()));
  },

  duplicateLayer: (id, copySuffix = '') => {
    const layer = get().doc.layers.find((item) => item.id === id);
    if (!layer) return;
    get().commit('histDuplicate');
    const copy = cloneLayer(layer, true);
    if (copy.kind === 'raster') {
      const clonedAsset = cloneAsset(layer.kind === 'raster' ? layer.assetId : '');
      if (clonedAsset) copy.assetId = clonedAsset;
      copy.rev = layer.kind === 'raster' ? layer.rev : 1;
    }
    copy.name = layer.name ? `${layer.name}${copySuffix}` : '';
    copy.x = layer.x + 12;
    copy.y = layer.y + 12;
    set((s) => {
      const index = s.doc.layers.findIndex((item) => item.id === id);
      const layers = [...s.doc.layers];
      layers.splice(index + 1, 0, copy);
      return { doc: { ...s.doc, layers, activeLayerId: copy.id } };
    });
  },

  addGroup: () => {
    const state = get();
    state.commit('histGroup');
    const group = createGroupLayer({ doc: state.doc });
    set({
      doc: { ...state.doc, layers: [...state.doc.layers, group], activeLayerId: group.id },
    });
    return group.id;
  },

  groupActive: () => {
    const state = get();
    const activeId = state.doc.activeLayerId;
    if (!activeId) return null;
    state.commit('histGroup');
    const group = createGroupLayer({ doc: state.doc });
    // 编组先入栈，再把图层（及其子树）移到组内
    const withGroup = [...state.doc.layers, group];
    const layers = moveSubtree(withGroup, activeId, group.id);
    set({ doc: { ...state.doc, layers, activeLayerId: group.id } });
    return group.id;
  },

  ungroup: (id) => {
    const state = get();
    const group = state.doc.layers.find((item) => item.id === id);
    if (!group || group.kind !== 'group') return;
    state.commit('histGroup');
    const parentId = group.parentId ?? null;
    const layers = state.doc.layers
      .filter((item) => item.id !== id)
      .map((item) => ((item.parentId ?? null) === id ? { ...item, parentId } : item));
    set({
      doc: {
        ...state.doc,
        layers,
        activeLayerId: layers.some((item) => item.id === group.id)
          ? group.id
          : (layers[0]?.id ?? null),
      },
    });
    releaseExcept(usedAssetsAcrossHistory(get()));
  },

  moveIntoGroup: (layerId, groupId) => {
    const state = get();
    if (layerId === groupId) return;
    const layers = moveSubtree(state.doc.layers, layerId, groupId);
    if (layers === state.doc.layers) return;
    state.commit('histGroup');
    set({ doc: { ...state.doc, layers } });
  },

  toggleGroupExpanded: (id) => {
    const state = get();
    const layer = state.doc.layers.find((item) => item.id === id);
    if (!layer || layer.kind !== 'group') return;
    // 展开态属于视图状态，不进撤销历史
    set({
      doc: {
        ...state.doc,
        layers: state.doc.layers.map((item) =>
          item.id === id ? { ...item, expanded: !(item.expanded ?? true) } : item,
        ),
      },
    });
  },

  setGroupPassThrough: (id, passThrough) => {
    get().patchLayer(id, { passThrough } as Partial<Layer>);
  },

  addAdjustment: () => {
    const state = get();
    state.commit('histAdjust');
    const layer = createAdjustmentLayer({ doc: state.doc });
    set({
      doc: { ...state.doc, layers: [...state.doc.layers, layer], activeLayerId: layer.id },
    });
    return layer.id;
  },

  convertToSmart: (id) => {
    const state = get();
    const layer = state.doc.layers.find((item) => item.id === id);
    if (!layer || layer.kind !== 'raster') return;
    const asset = getCanvas(layer.assetId);
    if (!asset) return;
    state.commit('histEdit');
    const smart = createSmartLayer({
      doc: state.doc,
      sourceAssetId: layer.assetId,
      sourceWidth: asset.width,
      sourceHeight: asset.height,
      name: layer.name,
      x: layer.x,
      y: layer.y,
    });
    // 呈现尺寸沿用原图层的显示尺寸（不重采样）
    const smartLayer: Layer = {
      ...smart,
      // 保留原 id：选中态、蒙版引用与层栈关系都不变
      id: layer.id,
      width: layer.width,
      height: layer.height,
      rotation: layer.rotation,
      flipX: layer.flipX,
      flipY: layer.flipY,
      opacity: layer.opacity,
      blend: layer.blend,
      visible: layer.visible,
      locked: layer.locked,
      parentId: layer.parentId ?? null,
      mask: layer.mask ?? null,
      // 位图上的非破坏参数原样升级为智能对象参数，转换不丢数据
      adjustments: layer.adjustments,
      filters: layer.filters,
    };
    set({
      doc: {
        ...state.doc,
        layers: state.doc.layers.map((item) => (item.id === id ? smartLayer : item)),
      },
    });
  },

  rasterizeSmart: (id) => {
    const state = get();
    const layer = state.doc.layers.find((item) => item.id === id);
    if (!layer || layer.kind !== 'smart') return;
    const source = getCanvas(layer.sourceAssetId);
    if (!source) return;
    state.commit('histEdit');
    // 按当前呈现尺寸重采样一份新像素，之后就是普通位图
    const canvas = createCanvasElement(
      Math.max(1, Math.round(layer.width)),
      Math.max(1, Math.round(layer.height)),
    );
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    ctx.drawImage(source, 0, 0, canvas.width, canvas.height);
    const assetId = registerCanvas(canvas);
    const width = layer.sourceWidth;
    const height = layer.sourceHeight;
    const raster: Layer = {
      ...createRasterLayer({ assetId, width, height, name: layer.name, x: layer.x, y: layer.y }),
      id: layer.id,
      width: layer.width,
      height: layer.height,
      rotation: layer.rotation,
      flipX: layer.flipX,
      flipY: layer.flipY,
      opacity: layer.opacity,
      blend: layer.blend,
      visible: layer.visible,
      locked: layer.locked,
      parentId: layer.parentId ?? null,
      mask: layer.mask ?? null,
      // 智能滤镜作用在呈现尺寸上、新的位图也正好是呈现尺寸 → 参数原样带过去即可，画面不变
      adjustments: layer.adjustments,
      filters: layer.filters,
    };
    set({
      doc: {
        ...state.doc,
        layers: state.doc.layers.map((item) => (item.id === id ? raster : item)),
      },
    });
    releaseExcept(usedAssetsAcrossHistory(get()));
  },

  addMask: (id, mode = 'show') => {
    const state = get();
    const layer = state.doc.layers.find((item) => item.id === id);
    if (!layer || layer.mask) return;
    state.commit('histMask');
    const width = Math.max(1, Math.round(layer.width));
    const height = Math.max(1, Math.round(layer.height));
    const assetId =
      mode === 'selection' && state.selection
        ? createMaskCanvasFromSelection(width, height, state.selection)
        : createMaskCanvas(width, height, mode === 'hide' ? 'hide' : 'show');
    const layers = state.doc.layers.map((item) =>
      item.id === id ? { ...item, mask: createMaskRef(assetId) } : item,
    );
    set({ doc: { ...state.doc, layers } });
  },

  removeMask: (id) => {
    const state = get();
    const layer = state.doc.layers.find((item) => item.id === id);
    if (!layer?.mask) return;
    state.commit('histMask');
    const layers = state.doc.layers.map((item) =>
      item.id === id ? { ...item, mask: null } : item,
    );
    set({ doc: { ...state.doc, layers }, maskEditing: false });
    releaseExcept(usedAssetsAcrossHistory(get()));
  },

  patchMask: (id, patch, history = true) => {
    const state = get();
    const layer = state.doc.layers.find((item) => item.id === id);
    if (!layer?.mask) return;
    if (history) state.commit('histMask');
    const layers = state.doc.layers.map((item) =>
      item.id === id && item.mask ? { ...item, mask: { ...item.mask, ...patch } } : item,
    );
    set({ doc: { ...state.doc, layers } });
  },

  addVectorMask: (id) => {
    const state = get();
    const layer = state.doc.layers.find((item) => item.id === id);
    const selection = state.selection;
    if (!layer || !selection) return;
    const contours = selectionToVectorContours(selection, layer.x, layer.y).slice(
      0,
      MAX_VECTOR_CONTOURS,
    );
    if (contours.length === 0) return;
    state.commit('histVectorMask');
    const vectorMask: VectorMaskRef = { enabled: true, inverted: false, contours, feather: 0 };
    set({
      doc: {
        ...state.doc,
        layers: state.doc.layers.map((item) => (item.id === id ? { ...item, vectorMask } : item)),
      },
    });
  },

  patchVectorMask: (id, patch, history = true) => {
    const state = get();
    const layer = state.doc.layers.find((item) => item.id === id);
    if (!layer?.vectorMask) return;
    if (history) state.commit('histVectorMask');
    const next: VectorMaskRef = {
      ...layer.vectorMask,
      ...patch,
      feather:
        patch.feather === undefined
          ? layer.vectorMask.feather
          : Math.min(MAX_VECTOR_FEATHER, Math.max(0, patch.feather)),
    };
    set({
      doc: {
        ...state.doc,
        layers: state.doc.layers.map((item) =>
          item.id === id ? { ...item, vectorMask: next } : item,
        ),
      },
    });
  },

  removeVectorMask: (id) => {
    const state = get();
    const layer = state.doc.layers.find((item) => item.id === id);
    if (!layer?.vectorMask) return;
    state.commit('histVectorMask');
    set({
      doc: {
        ...state.doc,
        layers: state.doc.layers.map((item) =>
          item.id === id ? { ...item, vectorMask: null } : item,
        ),
      },
    });
  },

  toggleClipping: (id) => {
    const state = get();
    const index = state.doc.layers.findIndex((item) => item.id === id);
    const layer = state.doc.layers[index];
    if (!layer) return false;
    // 释放剪贴随时可以；新建剪贴必须存在可作基准的下方图层（否则整组剪贴不生效）
    if (!layer.clipped && clipBaseIndex(state.doc.layers, index) < 0) return false;
    state.commit('histClip');
    set({
      doc: {
        ...state.doc,
        layers: state.doc.layers.map((item) =>
          item.id === id ? { ...item, clipped: !item.clipped } : item,
        ),
      },
    });
    return true;
  },

  commitMask: (id) => {
    const state = get();
    const layer = state.doc.layers.find((item) => item.id === id);
    if (!layer?.mask) {
      state.commit('histMask');
      return;
    }
    const cloned = cloneAsset(layer.mask.assetId);
    const snapshot = cloneDoc(state.doc);
    const target = snapshot.layers.find((item) => item.id === id);
    if (target?.mask && cloned) target.mask.assetId = cloned;
    set({
      past: [
        ...state.past,
        { doc: snapshot, label: 'histMask' as HistoryLabel, at: Date.now() },
      ].slice(-HISTORY_LIMIT),
      future: [],
    });
  },

  setMaskEditing: (value) => set({ maskEditing: value }),

  setChannelView: (view) => set({ channelView: view }),

  rotateView: (delta) =>
    set((s) => ({ viewRotation: normalizeViewRotation(s.viewRotation + delta) })),

  setViewRotation: (degrees) => set({ viewRotation: normalizeViewRotation(degrees) }),

  resetViewRotation: () => set({ viewRotation: 0 }),

  setSnapEnabled: (value) => set({ snapEnabled: value }),

  setSnapGuides: (guides) => set({ snapGuides: guides }),

  setCloneSource: (point) => set({ cloneSource: point }),

  setTransformMode: (mode) => {
    const state = get();
    set({ transformMode: mode, tool: 'transform' });
    const active = state.doc.layers.find((item) => item.id === state.doc.activeLayerId);
    if (!active || active.locked) return;
    // 进入网格模式时确保网格存在（四角模式用 2×2，变形用 4×4）
    const want = mode === 'warp' ? Math.max(WARP_COLS, WARP_ROWS) : 2;
    const has = active.mesh?.cols === want && active.mesh?.rows === want;
    if (mode === 'free' || has) return;
    state.patchLayer(active.id, { mesh: createMesh(want, want) });
  },

  resetMesh: (layerId) => {
    const state = get();
    const id = layerId ?? state.doc.activeLayerId;
    if (!id) return;
    const layer = state.doc.layers.find((item) => item.id === id);
    if (!layer?.mesh) return;
    state.patchLayer(id, { mesh: null });
  },

  recordTransform: (delta) => set({ lastTransform: delta }),

  repeatTransform: () => {
    const state = get();
    const delta = state.lastTransform;
    const layer = state.doc.layers.find((item) => item.id === state.doc.activeLayerId);
    if (!delta || !layer || layer.locked || layer.lockPosition) return;
    state.commit('histTransform');
    const box = applyTransformDelta(
      {
        x: layer.x,
        y: layer.y,
        width: layer.width,
        height: layer.height,
        rotation: layer.rotation,
      },
      delta,
    );
    state.patchLayer(layer.id, box, false);
  },

  enterQuickMask: () => {
    const state = get();
    if (state.quickMask) return;
    // 以当前选区为起点：选区外为黑（未选中）、选区内为白（选中）——与 PS 的进入行为一致
    const assetId = state.selection
      ? createMaskCanvasFromSelection(state.doc.width, state.doc.height, state.selection)
      : createMaskCanvas(state.doc.width, state.doc.height, 'hide');
    // 顺手切到画笔：进入快速蒙版就是为了涂抹选区
    set({ quickMask: { assetId, rev: 0 }, tool: 'brush' });
  },

  exitQuickMask: () => {
    const state = get();
    if (!state.quickMask) return;
    const asset = getCanvas(state.quickMask.assetId);
    const ctx = asset?.getContext('2d', { willReadFrequently: true });
    let selection: Selection | null = null;
    if (asset && ctx) {
      const frame = ctx.getImageData(0, 0, asset.width, asset.height);
      selection = selectionFromMask(frame.data, asset.width, asset.height);
    }
    // 画布本身交给 releaseExcept 惰性回收（quickMask 置空后它自然脱离引用集合）
    set({ quickMask: null, selection });
  },

  toggleQuickMask: () => {
    const state = get();
    if (state.quickMask) state.exitQuickMask();
    else state.enterQuickMask();
  },

  bumpQuickMask: () =>
    set((s) => (s.quickMask ? { quickMask: { ...s.quickMask, rev: s.quickMask.rev + 1 } } : {})),

  loadChannelSelection: () => {
    const state = get();
    if (state.channelView === 'rgb') return;
    const canvas = channelViewCanvas(state.doc, state.channelView);
    const ctx = canvas?.getContext('2d', { willReadFrequently: true });
    if (!canvas || !ctx) return;
    const frame = ctx.getImageData(0, 0, canvas.width, canvas.height);
    // 全黑通道（无亮部）视为「没有可载入的内容」：清空选区而不是留下一个不可见的空选区
    set({ selection: selectionFromMask(frame.data, canvas.width, canvas.height) });
  },

  addSample: (x, y) => {
    const state = get();
    const px = Math.max(0, Math.min(state.doc.width - 1, Math.floor(x)));
    const py = Math.max(0, Math.min(state.doc.height - 1, Math.floor(y)));
    // 取样取自「合成结果」，与吸管一致：用户看到什么就取到什么
    const canvas = compositeDoc(state.doc, { x: px, y: py, width: 1, height: 1 }, 1);
    const ctx = canvas.getContext('2d', { willReadFrequently: true });
    if (!ctx) return;
    const data = ctx.getImageData(0, 0, 1, 1).data;
    const sample: SamplePoint = {
      x: px + 0.5,
      y: py + 0.5,
      hex: rgbToHex(data[0], data[1], data[2]),
      alpha: data[3],
    };
    set({ samples: [...state.samples, sample].slice(-MAX_SAMPLES) });
  },

  removeSample: (index) => set((s) => ({ samples: s.samples.filter((_, i) => i !== index) })),

  clearSamples: () => set({ samples: [] }),

  addSwatch: (color) => {
    const hex = color.trim().toUpperCase();
    if (!hexToRgb(hex)) return;
    const state = get();
    if (state.doc.swatches.includes(hex)) return;
    state.commit('histSwatch');
    set({
      doc: { ...state.doc, swatches: [...state.doc.swatches, hex].slice(0, MAX_SWATCHES) },
    });
  },

  removeSwatch: (index) => {
    const state = get();
    state.commit('histSwatch');
    set({
      doc: { ...state.doc, swatches: state.doc.swatches.filter((_, i) => i !== index) },
    });
  },

  extractSwatches: () => {
    const state = get();
    const picked = extractDocPalette(state.doc);
    const next = [...state.doc.swatches];
    for (const hex of picked) if (!next.includes(hex)) next.push(hex);
    if (next.length === state.doc.swatches.length) return;
    state.commit('histSwatch');
    set({ doc: { ...state.doc, swatches: next.slice(0, MAX_SWATCHES) } });
  },

  setPanels: (panels) => set({ panels }),

  setPanelTab: (group, id) =>
    set((s) =>
      panelGroupOf(id) !== group || s.panels.tabs[group] === id
        ? {}
        : { panels: { tabs: { ...s.panels.tabs, [group]: id } } },
    ),

  // 「显示该面板」的语义：切到它所在面板，并把该面板的子 tab 指向它
  showPanel: (id) =>
    set((s) => {
      const group = panelGroupOf(id);
      return s.panels.tabs[group] === id
        ? {}
        : { panels: { tabs: { ...s.panels.tabs, [group]: id } } };
    }),

  resetPanels: () => set({ panels: normalizePanelLayout(null) }),

  reorderLayer: (id, toIndex) => {
    get().commit('histReorder');
    set((s) => {
      const layers = [...s.doc.layers];
      const from = layers.findIndex((layer) => layer.id === id);
      if (from < 0) return {};
      const target = Math.max(0, Math.min(layers.length - 1, toIndex));
      if (from === target) return {};
      const [moved] = layers.splice(from, 1);
      layers.splice(target, 0, moved);
      return { doc: { ...s.doc, layers } };
    });
  },

  moveLayer: (id, dir) => {
    const state = get();
    const layers = state.doc.layers;
    const from = layers.findIndex((layer) => layer.id === id);
    if (from < 0) return;
    // 只在同一父级内寻找相邻兄弟，避免把子图层移出编组（破坏「子紧随组」的层栈约定）
    const parent = layers[from].parentId ?? null;
    let target = from + dir;
    while (target >= 0 && target < layers.length && (layers[target].parentId ?? null) !== parent) {
      target += dir;
    }
    if (target < 0 || target >= layers.length) return;
    state.reorderLayer(id, target);
  },

  alignLayer: (mode) => {
    const state = get();
    const layer = state.doc.layers.find((item) => item.id === state.doc.activeLayerId);
    if (!layer) return;
    const { width, height } = state.doc;
    let x = layer.x;
    let y = layer.y;
    switch (mode) {
      case 'left':
        x = 0;
        break;
      case 'hcenter':
        x = Math.round((width - layer.width) / 2);
        break;
      case 'right':
        x = Math.round(width - layer.width);
        break;
      case 'top':
        y = 0;
        break;
      case 'vcenter':
        y = Math.round((height - layer.height) / 2);
        break;
      case 'bottom':
        y = Math.round(height - layer.height);
        break;
    }
    if (x === layer.x && y === layer.y) return;
    state.patchLayer(layer.id, { x, y } as Partial<Layer>, true);
  },

  mergeDown: (id) => {
    const state = get();
    const index = state.doc.layers.findIndex((layer) => layer.id === id);
    if (index <= 0) return;
    // 仅支持「位图向下合并」：下方是文字 / 形状时不合并，避免出现内容丢失的假象
    if (
      state.doc.layers[index].kind !== 'raster' ||
      state.doc.layers[index - 1].kind !== 'raster'
    ) {
      return;
    }
    get().commit('histMerge');
    const doc = get().doc;
    const currentTop = doc.layers.find((l) => l.id === id);
    const currentBottom = doc.layers[index - 1];
    if (!currentTop || !currentBottom) return;
    const merged = mergeRasterPair(currentBottom, currentTop);
    if (!merged) return;
    const layers = doc.layers.filter((layer) => layer.id !== id);
    set({
      doc: {
        ...doc,
        layers: layers.map((layer) => (layer.id === currentBottom.id ? merged : layer)),
        activeLayerId: currentBottom.id,
      },
    });
    releaseExcept(usedAssetsAcrossHistory(get()));
  },

  flattenVisible: () => {
    const doc = get().doc;
    if (doc.layers.length === 0) return;
    get().commit('histFlatten');
    const current = get().doc;
    const flat = flattenLayers(current);
    if (!flat) return;
    set({
      doc: {
        ...current,
        layers: [flat],
        activeLayerId: flat.id,
      },
    });
    releaseExcept(usedAssetsAcrossHistory(get()));
  },

  copyLayer: () => {
    const state = get();
    const layer = state.doc.layers.find((item) => item.id === state.doc.activeLayerId);
    set({ clipboard: layer ? cloneLayer(layer, true) : null });
  },

  pasteLayer: () => {
    const state = get();
    if (!state.clipboard) return;
    const source = state.clipboard;
    const copy = cloneLayer(source, true);
    if (copy.kind === 'raster' && source.kind === 'raster') {
      const clonedAsset = cloneAsset(source.assetId);
      if (clonedAsset) copy.assetId = clonedAsset;
    }
    // 粘贴出的图层用自动命名，避免把来源名称带成重复项
    copy.name = '';
    get().addLayer(copy);
  },

  ensurePaintLayer: () => {
    const state = get();
    const active = state.doc.layers.find((layer) => layer.id === state.doc.activeLayerId);
    if (active && active.kind === 'raster' && !active.locked) {
      // 位图缺失（例如超大草稿只恢复了结构）：就地补一张空白画布，
      // 否则落笔会写进「空资产」，表现为「选了画笔却画不出东西」
      if (!getCanvas(active.assetId)) return repairRasterAsset(get, active.id);
      return active.id;
    }
    const top = [...state.doc.layers]
      .reverse()
      .find(
        (layer) => layer.kind === 'raster' && !layer.locked && Boolean(getCanvas(layer.assetId)),
      );
    if (top) {
      set((s) => ({ doc: { ...s.doc, activeLayerId: top.id } }));
      return top.id;
    }
    const assetId = createBlankAsset(state.doc.width, state.doc.height);
    const layer = createRasterLayer({
      assetId,
      width: state.doc.width,
      height: state.doc.height,
      name: '',
    });
    get().addLayer(layer);
    return layer.id;
  },

  addTextLayer: (x, y, text) => {
    const layer = createTextLayer({ doc: get().doc, x, y, text });
    get().addLayer(layer);
    return layer.id;
  },

  addShapeLayer: (rect) => {
    const doc = get().doc;
    const layer = createShapeLayer({
      doc,
      shape: get().shapeKind,
      style: get().shapeStyle,
    });
    const next: typeof layer = {
      ...layer,
      x: rect.x,
      y: rect.y,
      width: Math.max(8, rect.width),
      height: Math.max(8, rect.height),
    };
    get().addLayer(next);
    return next.id;
  },

  addImageLayer: (assetId, width, height, name) => {
    const doc = get().doc;
    // 超出画布的大图按「适应画布」缩放，避免打开 4000px 照片后只能看到局部
    const scale = Math.min(1, doc.width / width, doc.height / height);
    const layer = createRasterLayer({
      assetId,
      width: Math.max(1, Math.round(width * scale)),
      height: Math.max(1, Math.round(height * scale)),
      name,
      x: Math.round((doc.width - width * scale) / 2),
      y: Math.round((doc.height - height * scale) / 2),
    });
    get().addLayer(layer);
  },

  bumpRev: (id) =>
    set((s) => ({
      doc: {
        ...s.doc,
        layers: s.doc.layers.map((layer) =>
          layer.id === id && layer.kind === 'raster' ? { ...layer, rev: layer.rev + 1 } : layer,
        ),
      },
    })),

  commit: (label = 'histEdit') =>
    set((s) => ({
      past: [...s.past, { doc: cloneDoc(s.doc), label, at: Date.now() }].slice(-HISTORY_LIMIT),
      future: [],
    })),

  /**
   * 像素操作前的快照：把目标图层的位图复制一份，
   * 使历史中的 doc 指向「改写前」的画布（资产不可变，撤销即可还原笔迹）。
   */
  commitPixels: (id, label = 'histEdit') => {
    const state = get();
    const layer = state.doc.layers.find((item) => item.id === id);
    if (!layer) {
      state.commit(label);
      return;
    }
    // 蒙版绘制：只克隆蒙版画布，位图不动
    if (layer.kind !== 'raster') {
      if (!layer.mask?.assetId) {
        state.commit(label);
        return;
      }
      const clonedMask = cloneAsset(layer.mask.assetId);
      const snapshot = cloneDoc(state.doc);
      const target = snapshot.layers.find((item) => item.id === id);
      if (target?.mask && clonedMask) target.mask.assetId = clonedMask;
      set({
        past: [...state.past, { doc: snapshot, label, at: Date.now() }].slice(-HISTORY_LIMIT),
        future: [],
      });
      return;
    }
    const clonedAsset = cloneAsset(layer.assetId);
    const snapshot = cloneDoc(state.doc);
    const target = snapshot.layers.find((item) => item.id === id);
    if (target && target.kind === 'raster' && clonedAsset) target.assetId = clonedAsset;
    // 位图图层也可能带蒙版，蒙版像素同样要独立快照
    if (target?.mask?.assetId) {
      const clonedMask = cloneAsset(target.mask.assetId);
      if (clonedMask) target.mask.assetId = clonedMask;
    }
    set({
      past: [...state.past, { doc: snapshot, label, at: Date.now() }].slice(-HISTORY_LIMIT),
      future: [],
    });
  },

  undo: () => {
    const state = get();
    const previous = state.past[state.past.length - 1];
    if (!previous) return;
    set({
      past: state.past.slice(0, -1),
      // 被撤销的状态进 future：它携带「产生它的操作名」
      future: [
        { doc: cloneDoc(state.doc), label: previous.label, at: Date.now() },
        ...state.future,
      ].slice(0, HISTORY_LIMIT),
      doc: previous.doc,
      selection: null,
      cropRect: null,
    });
    releaseExcept(usedAssetsAcrossHistory(get()));
  },

  redo: () => {
    const state = get();
    const next = state.future[0];
    if (!next) return;
    set({
      // 离开的状态进 past：它的 label 就是即将重做的操作
      past: [...state.past, { doc: cloneDoc(state.doc), label: next.label, at: Date.now() }].slice(
        -HISTORY_LIMIT,
      ),
      future: state.future.slice(1),
      doc: next.doc,
      selection: null,
      cropRect: null,
    });
    releaseExcept(usedAssetsAcrossHistory(get()));
  },

  jumpTo: (index) => {
    const state = get();
    const current = state.past.length;
    const max = current + state.future.length;
    const target = Math.max(0, Math.min(max, Math.round(index)));
    if (target === current) return;
    // 线性跳转：落到目标行之前逐步 undo / redo（步数受 HISTORY_LIMIT 约束，开销可忽略）
    if (target < current) {
      for (let step = 0; step < current - target; step += 1) get().undo();
    } else {
      for (let step = 0; step < target - current; step += 1) get().redo();
    }
  },

  clearHistory: () => {
    set({ past: [], future: [] });
    releaseExcept(usedAssetsAcrossHistory(get()));
  },
}));

/* --------------------------- 合并 / 拼合辅助 --------------------------- */

/** 把上方位图图层按几何、不透明度与混合模式烘焙进下方位图图层 */
function mergeRasterPair(bottom: Layer, top: Layer): Layer | null {
  if (bottom.kind !== 'raster' || top.kind !== 'raster') return null;
  // 以两图层并集为合并后画布，避免裁掉超出底图的部分
  const minX = Math.min(bottom.x, top.x);
  const minY = Math.min(bottom.y, top.y);
  const maxX = Math.max(bottom.x + bottom.width, top.x + top.width);
  const maxY = Math.max(bottom.y + bottom.height, top.y + top.height);
  const width = Math.max(1, Math.round(maxX - minX));
  const height = Math.max(1, Math.round(maxY - minY));
  const canvas = createCanvasElement(width, height);
  const ctx = canvas.getContext('2d');
  if (!ctx) return null;
  ctx.translate(-minX, -minY);
  paintLayer(ctx, bottom);
  paintLayer(ctx, top);
  return {
    ...bottom,
    assetId: registerCanvas(canvas),
    rev: bottom.rev + 1,
    x: minX,
    y: minY,
    width,
    height,
  };
}

/** 拼合所有可见图层为一张位图（等价于 PS 的「合并可见图层」） */
export function flattenLayers(doc: PhotoDoc): Layer | null {
  const canvas = createCanvasElement(doc.width, doc.height);
  const ctx = canvas.getContext('2d');
  if (!ctx) return null;
  paintDoc(ctx, doc, { signaturePrefix: 'flat' });
  return {
    id: createId('raster'),
    kind: 'raster',
    name: '',
    visible: true,
    locked: false,
    opacity: 1,
    blend: 'normal',
    x: 0,
    y: 0,
    width: doc.width,
    height: doc.height,
    rotation: 0,
    flipX: false,
    flipY: false,
    assetId: registerCanvas(canvas),
    rev: 1,
    adjustments: createAdjustments(),
    filters: [],
  };
}

/** 套索顶点 → 选区（顺带算外接矩形并抽稀） */
export function selectionFromPath(path: number[], feather: number): Selection | null {
  const simplified = simplifyPath(path);
  if (simplified.length < 6) return null;
  const bounds = polygonBounds(simplified);
  if (bounds.width < 2 || bounds.height < 2) return null;
  return { kind: 'lasso', ...bounds, path: simplified, feather };
}
