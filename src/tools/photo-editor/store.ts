import { create } from 'zustand';
import {
  clampRect,
  clampUnit,
  fullSelection,
  intersectRect,
  invertSelection,
  moveSubtree,
  polygonBounds,
  selectionPolygon,
  simplifyPath,
} from './core';
import {
  cloneAsset,
  collectUsedAssets,
  createCanvasElement,
  getCanvas,
  registerCanvas,
  releaseExcept,
} from './model/assets';
import { paintSelection } from './render/brush';
import { rasterizeSelection } from './render/export';
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
import { createMaskCanvas, createMaskCanvasFromPolygon } from './render/mask';
import type {
  HistoryEntry,
  HistoryLabel,
  MaskRef,
  Layer,
  PhotoDoc,
  Rect,
  Selection,
  ShapeKind,
  ToolId,
  Viewport,
} from './model/types';

/**
 * 照片编辑器状态：唯一真相源是 `doc`，其余（当前工具 / 选区 / 视口 / 历史）是会话态。
 *
 * 与 slide-editor 一致：所有改 doc 的 action 先 `commit()` 压快照，保证 undo 可回放。
 * 额外约定：**像素级操作必须先 `commitPixels(layerId)`** —— 它会把该图层的位图复制一份，
 * 让历史快照指向「落笔前」的像素，否则撤销只能还原坐标而无法还原笔迹。
 */

const HISTORY_LIMIT = 24;
/** 缩放下限：允许缩到 2% 以观察超大画布全貌，但不会把「待适配」哨兵值也钳到这里 */
const MIN_ZOOM = 0.02;

export interface BrushConfig {
  color: string;
  size: number;
  /** 0~1，1 为硬边 */
  hardness: number;
  opacity: number;
}

interface PhotoState {
  doc: PhotoDoc;
  tool: ToolId;
  brush: BrushConfig;
  eraserSize: number;
  shapeKind: ShapeKind;
  selection: Selection | null;
  cropRect: Rect | null;
  viewport: Viewport;
  clipboard: Layer | null;
  /** 历史：快照 + 操作名 + 时间（面板按此展示，可跳转） */
  past: HistoryEntry[];
  future: HistoryEntry[];

  loadDoc: (doc: PhotoDoc) => void;
  resetDoc: () => void;
  setDocName: (name: string) => void;
  setBackground: (background: PhotoDoc['background']) => void;
  resizeCanvas: (width: number, height: number) => void;

  setTool: (tool: ToolId) => void;
  patchBrush: (patch: Partial<BrushConfig>) => void;
  setEraserSize: (size: number) => void;
  setShapeKind: (kind: ShapeKind) => void;

  setSelection: (selection: Selection | null) => void;
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
  /** 画笔是否写入蒙版（而非图层本体） */
  maskEditing: boolean;
  setMaskEditing: (value: boolean) => void;
  setGroupPassThrough: (id: string, passThrough: boolean) => void;
  reorderLayer: (id: string, toIndex: number) => void;
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

/** 历史中被引用到的资产：回收时必须一并保留，否则撤销会拿到已释放的画布 */
function usedAssetsAcrossHistory(state: Pick<PhotoState, 'doc' | 'past' | 'future'>): Set<string> {
  const used = new Set<string>();
  const collect = (doc: PhotoDoc) => {
    for (const id of collectUsedAssets(doc.layers)) used.add(id);
  };
  collect(state.doc);
  for (const entry of state.past) collect(entry.doc);
  for (const entry of state.future) collect(entry.doc);
  return used;
}

export const usePhotoStore = create<PhotoState>((set, get) => ({
  doc: createDoc(),
  tool: 'move',
  brush: { color: '#111827', size: 12, hardness: 0.9, opacity: 1 },
  eraserSize: 24,
  shapeKind: 'rect',
  selection: null,
  cropRect: null,
  viewport: { scale: 0, x: 0, y: 0 },
  clipboard: null,
  maskEditing: false,
  past: [],
  future: [],

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
      },
    })),

  setEraserSize: (size) => set({ eraserSize: size }),
  setShapeKind: (kind) => set({ shapeKind: kind }),

  setSelection: (selection) => set({ selection }),

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
        ? createMaskCanvasFromPolygon(width, height, selectionPolygon(state.selection))
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
    const layer = createShapeLayer({ doc, shape: get().shapeKind });
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
