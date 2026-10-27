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
import { measureTextBlock } from './render/text';
import { remapRunsAfterTextEdit } from './model/textRuns';
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
  TextDirection,
  TextLayer,
  ToolId,
  VectorMaskRef,
  ViewOverlay,
  Viewport,
} from './model/types';
import { defaultPanelLayout, normalizePanelLayout, panelGroupOf } from './panels';
import type { PanelGroupId, PanelId, PanelLayout } from './panels';

/**
 * Photo editor state: `doc` is the single source of truth; the rest (tool / selection / viewport / history) is session state.
 *
 * Like slide-editor: every action that changes doc calls `commit()` first to push a snapshot, so undo can replay.
 * Extra rule: **pixel-level operations must call `commitPixels(layerId)` first** — it copies that layer's bitmap
 * so the history snapshot points at the pixels from before the stroke; otherwise undo restores coordinates only.
 */

const HISTORY_LIMIT = 24;

/** Document palette capacity cap */
const MAX_SWATCHES = 32;

/** Default parameters per layer-style effect (used when adding one, enabled by default) */
const STYLE_DEFAULTS: Record<StyleEffectId, () => NonNullable<LayerStyle[StyleEffectId]>> = {
  dropShadow: createDropShadow,
  innerShadow: createInnerShadow,
  outerGlow: createOuterGlow,
  stroke: createStroke,
  colorOverlay: createColorOverlay,
};
/** Zoom floor: 2% shows a huge canvas whole, but the "needs fit" sentinel must never be clamped here */
const MIN_ZOOM = 0.02;

export interface BrushConfig {
  /** Foreground color */
  color: string;
  /** Background color (gradient's second stop / used by the fg↔bg swap) */
  background: string;
  size: number;
  /** 0~1, where 1 gives a hard edge */
  hardness: number;
  opacity: number;
  /** Stamp spacing (relative to the diameter): smaller is more continuous */
  spacing: number;
  /** Pressure controls stroke size */
  pressureSize: boolean;
  /** Pressure controls opacity */
  pressureOpacity: boolean;
}

/**
 * Quick mask: a grayscale canvas temporarily stands in for the selection — white = selected, black = not.
 *
 * Relation to the selection: initialized from it on enter, converted back by luminance threshold on exit.
 * `rev` tells the view layer the canvas changed (the brush rewrites it directly, bypassing React).
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
  /** Flow direction for new text layers (chosen from the text tool's badge flyout) */
  textDirection: TextDirection;
  /** Default fill / stroke for new shapes (set in the options bar, not part of the document) */
  shapeStyle: ShapeStyleDefaults;
  /** Magnetic lasso: snap width (document px) and edge-contrast threshold */
  magnetic: { width: number; contrast: number };
  selection: Selection | null;
  cropRect: Rect | null;
  viewport: Viewport;
  /** Auxiliary views (rulers / grid / guides); view state, not in history */
  overlay: ViewOverlay;
  clipboard: Layer | null;
  /** History: snapshots + labels + time (the panel renders these and can jump) */
  past: HistoryEntry[];
  future: HistoryEntry[];
  /** Right-hand panel layout (view state, not part of document history) */
  panels: PanelLayout;
  /** Paint bucket: tolerance / whether to fill only the connected region */
  fillTolerance: number;
  fillContiguous: boolean;
  /** Gradient tool: shape and endpoint combination */
  gradientKind: GradientKind;
  gradientMode: GradientMode;
  /** Retouch / healing family (dodge-burn-sponge, stamp, healing, smudge, blur-sharpen): tip size and strength */
  retouchSize: number;
  retouchStrength: number;
  /** Custom brush presets (persisted) */
  brushPresets: BrushPreset[];
  /** Recently used colors (session state) */
  recentColors: string[];

  loadDoc: (doc: PhotoDoc) => void;
  resetDoc: () => void;
  setDocName: (name: string) => void;
  setBackground: (background: PhotoDoc['background']) => void;
  resizeCanvas: (width: number, height: number) => void;
  /** Apply canvas size and background in one go (a single history entry, for "canvas size" / document properties) */
  applyCanvas: (width: number, height: number, background: PhotoDoc['background']) => void;

  /**
   * Set one parameter of a layer-style effect (created with defaults when absent); values are clamped.
   * `history = false` is for slider drags: same convention as AdjustPanel, so no entry is pushed per frame.
   */
  setLayerStyle: (
    id: string,
    effect: StyleEffectId,
    patch: Record<string, string | number | boolean>,
    history?: boolean,
  ) => void;
  /** Add / toggle one effect */
  toggleLayerStyle: (id: string, effect: StyleEffectId) => void;
  /** Remove one effect */
  removeLayerStyle: (id: string, effect: StyleEffectId) => void;
  /** Clear the whole layer style */
  clearLayerStyle: (id: string) => void;

  setTool: (tool: ToolId) => void;
  patchBrush: (patch: Partial<BrushConfig>) => void;
  setEraserSize: (size: number) => void;
  setShapeKind: (kind: ShapeKind) => void;
  setTextDirection: (direction: TextDirection) => void;
  /** Change the default style for new shapes (fill / stroke / stroke width / radius) */
  setShapeStyle: (patch: Partial<ShapeStyleDefaults>) => void;
  /** Change the magnetic lasso width / contrast */
  setMagnetic: (patch: Partial<{ width: number; contrast: number }>) => void;
  /** Paint bucket settings */
  setFill: (patch: { tolerance?: number; contiguous?: boolean }) => void;
  /** Gradient tool settings */
  setGradient: (patch: { kind?: GradientKind; mode?: GradientMode }) => void;
  /** Retouch tool settings */
  setRetouch: (patch: { size?: number; strength?: number }) => void;
  /** Swap foreground / background color (shortcut X) */
  swapColors: () => void;
  /** Reset to black foreground / white background (shortcut D) */
  resetColors: () => void;
  /** Record a recently used color (de-duplicated, at most 12) */
  pushRecentColor: (color: string) => void;
  /** Save the current brush parameters as a custom preset */
  saveBrushPreset: (name: string) => void;
  removeBrushPreset: (id: string) => void;
  /** Apply a preset to the current brush */
  applyBrushPreset: (preset: BrushPreset) => void;

  setSelection: (selection: Selection | null) => void;
  /** Combine selections with a boolean op (add / subtract / intersect / replace) */
  applySelection: (next: Selection, op: SelectionOp) => void;
  /** Change the feather radius of the current selection */
  setSelectionFeather: (feather: number) => void;
  /** Morphological selection edit: expand / contract / smooth */
  modifySelection: (mode: SelectionModify, amount: number) => void;
  /** Magic wand settings */
  wandTolerance: number;
  wandContiguous: boolean;
  setWand: (patch: { tolerance?: number; contiguous?: boolean }) => void;
  /** Select all (Ctrl+A) */
  selectAll: () => void;
  /** Invert: canvas frame plus the original outlines reversed (even-odd rule) */
  invertSelection: () => void;
  /** Fill / clear the current selection content (applies to bitmap layers) */
  fillSelectionArea: (mode: 'fill' | 'clear') => void;
  /** New layer via copy: selection content becomes a new bitmap layer */
  copySelectionToLayer: () => void;
  setCropRect: (rect: Rect | null) => void;
  applyCrop: () => void;

  setViewport: (patch: Partial<Viewport>) => void;
  setScale: (scale: number) => void;
  /** Auxiliary views: merged update (rulers / grid / guides) */
  patchOverlay: (patch: Partial<ViewOverlay>) => void;

  selectLayer: (id: string | null) => void;
  addLayer: (layer: Layer) => void;
  patchLayer: (id: string, patch: Partial<Layer>, history?: boolean) => void;
  patchActive: (patch: Partial<Layer>, history?: boolean) => void;
  removeLayer: (id: string) => void;
  /** copySuffix: suffix for copied layer names (passed in by the UI, e.g. " copy") */
  duplicateLayer: (id: string, copySuffix?: string) => void;
  /** Create an empty group (placed on top) */
  addGroup: () => string | null;
  /** Make a group from the current layer: the layer moves inside it */
  groupActive: () => string | null;
  /** Ungroup: children move up one level, the group itself is deleted */
  ungroup: (id: string) => void;
  /** Move a layer (with its subtree) into a group; a null groupId means the top level */
  moveIntoGroup: (layerId: string, groupId: string | null) => void;
  toggleGroupExpanded: (id: string) => void;
  /** Create a vector mask from the current selection (outlines become layer-local, resolution-independent) */
  addVectorMask: (id: string) => void;
  /** Vector mask parameters: toggle / invert / feather */
  patchVectorMask: (id: string, patch: Partial<VectorMaskRef>, history?: boolean) => void;
  removeVectorMask: (id: string) => void;
  /** Create / release a clipping mask (PS's ⌘⌥G); no-op when there is no base layer below */
  toggleClipping: (id: string) => boolean;

  /** Add a mask to a layer: show = reveal all, hide = hide all, selection = from the current selection */
  /** New adjustment layer (on top, affecting everything below it) */
  addAdjustment: () => string | null;
  /** Bitmap → smart object: source pixels are kept, the on-canvas size is only a presentation transform */
  convertToSmart: (id: string) => void;
  /** Smart object → plain bitmap (rasterize), pixels resampled at the current presentation size */
  rasterizeSmart: (id: string) => void;
  addMask: (id: string, mode?: 'show' | 'hide' | 'selection') => void;
  removeMask: (id: string) => void;
  /** Change mask parameters (density / feather / invert / enabled) */
  patchMask: (id: string, patch: Partial<MaskRef>, history?: boolean) => void;
  /** Pixel-level mask snapshot (call before painting) */
  commitMask: (id: string) => void;
  /** View rotation (degrees, view state, not in history) */
  viewRotation: number;
  /** Rotate further from the current angle (the menu steps by 15°) */
  rotateView: (delta: number) => void;
  setViewRotation: (degrees: number) => void;
  resetViewRotation: () => void;

  /** Snap toggle (view state, on by default) */
  snapEnabled: boolean;
  setSnapEnabled: (value: boolean) => void;
  /** Snap guides currently in effect (shown while dragging, cleared on release) */
  snapGuides: SnapGuide[];
  setSnapGuides: (guides: SnapGuide[]) => void;

  /** Sample point for stamp / healing (document coordinates, session state) */
  cloneSource: { x: number; y: number } | null;
  setCloneSource: (point: { x: number; y: number } | null) => void;
  /** Free-transform mode: free / perspective / distort / skew / warp */
  transformMode: TransformMode;
  setTransformMode: (mode: TransformMode) => void;
  /** Clear the current layer's mesh warp */
  resetMesh: (layerId?: string) => void;
  /** Delta of the last transform (used by ⌘⇧T "transform again") */
  lastTransform: TransformDelta | null;
  /** Record a transform (submitted by the interaction layer on release) */
  recordTransform: (delta: TransformDelta | null) => void;
  /** Transform again: apply the last delta to the current layer once more */
  repeatTransform: () => void;

  /** Quick mask session (null = not active) */
  quickMask: QuickMaskState | null;
  /** Enter quick mask: initialized from the current selection (all "unselected" when there is none) */
  enterQuickMask: () => void;
  /** Exit quick mask: convert the mask back into a selection by luminance threshold */
  exitQuickMask: () => void;
  /** Toggled by the Q key */
  toggleQuickMask: () => void;
  /** Commit one visual refresh after the mask has been painted */
  bumpQuickMask: () => void;

  /** Channel isolation view (affects canvas rendering only, not the document) */
  channelView: ChannelView;
  setChannelView: (view: ChannelView) => void;
  /** Load the bright parts of the isolated channel as a selection (threshold 128); no-op in composite view */
  loadChannelSelection: () => void;
  /** Color samplers (session state, at most `MAX_SAMPLES`) */
  samples: SamplePoint[];
  /** Sample at document coordinates; when full, evict the oldest */
  addSample: (x: number, y: number) => void;
  removeSample: (index: number) => void;
  clearSamples: () => void;
  /** Document palette (saved with the project) */
  addSwatch: (color: string) => void;
  removeSwatch: (index: number) => void;
  /** Extract dominant colors from the current image and merge them into the palette */
  extractSwatches: () => void;

  /** Whether the brush writes into the mask (instead of the layer itself) */
  maskEditing: boolean;
  setMaskEditing: (value: boolean) => void;
  /** Panel layout: replace wholesale / switch a panel's sub tab / show a sub panel / reset */
  setPanels: (layout: PanelLayout) => void;
  setPanelTab: (group: PanelGroupId, id: PanelId) => void;
  showPanel: (id: PanelId) => void;
  resetPanels: () => void;
  setGroupPassThrough: (id: string, passThrough: boolean) => void;
  reorderLayer: (id: string, toIndex: number) => void;
  /** Move up / down one level within the same parent (never across group boundaries) */
  moveLayer: (id: string, dir: -1 | 1) => void;
  /** Align the current layer to the canvas */
  alignLayer: (mode: AlignMode) => void;
  mergeDown: (id: string) => void;
  flattenVisible: () => void;
  copyLayer: () => void;
  pasteLayer: () => void;
  /** Ensure there is a paintable bitmap layer (create a blank full-canvas one if needed) */
  ensurePaintLayer: () => string | null;
  /** text: default content for a new text layer (passed in by the UI in the active locale) */
  addTextLayer: (x: number, y: number, text?: string) => string | null;
  addShapeLayer: (rect: Rect) => string | null;
  addImageLayer: (assetId: string, width: number, height: number, name: string) => void;
  /** Called after a bitmap is rewritten in place: bump rev so the bake cache goes stale */
  bumpRev: (id: string) => void;

  /** `label` is the operation's name in the history panel (defaults to `histEdit`) */
  commit: (label?: HistoryLabel) => void;
  commitPixels: (id: string, label?: HistoryLabel) => void;
  /** Jump to timeline row index (0 = initial state, past.length = current) */
  jumpTo: (index: number) => void;
  /** Clear history (releases recyclable assets) */
  clearHistory: () => void;
  undo: () => void;
  redo: () => void;
}

/** Give a layer with a missing bitmap a blank canvas */
function repairRasterAsset(get: () => PhotoState, id: string): string {
  const layer = get().doc.layers.find((item) => item.id === id);
  const width = Math.max(1, Math.round(layer?.width ?? get().doc.width));
  const height = Math.max(1, Math.round(layer?.height ?? get().doc.height));
  get().patchLayer(id, { assetId: createBlankAsset(width, height) }, false);
  get().bumpRev(id);
  return id;
}

/**
 * Assets referenced by history: they must be kept alive during GC, or undo would get a freed canvas.
 * The quick mask canvas is registered here too: it belongs to no document, but must stay paintable across undo.
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

/**
 * Recompute a text layer's box after content / style changes.
 *
 * - horizontal: the wrap width is user-controlled, so only the height grows with the number of lines;
 * - vertical: the columns decide the width and the tallest column decides the height.
 * A `null` measurement (no 2D context, e.g. jsdom) leaves the layer untouched instead of zeroing the box.
 */
function fitTextLayer(layer: TextLayer): TextLayer {
  const size = measureTextBlock(layer);
  if (!size) return layer;
  if ((layer.direction ?? 'horizontal') === 'vertical') {
    // Vertical: the box height is the user's column length, so only the width (column count) follows the content
    return { ...layer, width: Math.max(1, Math.ceil(size.width)) };
  }
  return { ...layer, height: Math.max(1, Math.ceil(size.height)) };
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
  textDirection: 'horizontal',
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
    // After a document switch the old warped bitmaps can no longer be hit, so drop them to free memory
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
      // Leaving the crop tool drops the unapplied crop box; the selection stays (move / brush / fill use it)
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
  setTextDirection: (direction) => set({ textDirection: direction }),

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
   * Fill / clear the selection: applies to the current bitmap layer.
   * `commitPixels` runs first to copy the pre-stroke pixels, so a single undo restores everything.
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

  /** New layer via copy: copy the composited selection into a new bitmap layer */
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
        // scale === 0 is the "not yet fitted" sentinel and must not be clamped, or fit-to-window locks to the min.
        // The canvas host writes the real ratio back once it knows its container, and it stays positive after.
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
    const raw = patch as Partial<TextLayer> & Partial<Layer>;
    set((s) => ({
      doc: {
        ...s.doc,
        layers: s.doc.layers.map((layer) => {
          if (layer.id !== id) return layer;
          let next = { ...layer, ...patch } as Layer;
          if (next.kind === 'text' && layer.kind === 'text') {
            // Text edits must remap the rich-text runs, or per-range styles would drift off the characters
            if (typeof raw.text === 'string' && raw.text !== layer.text) {
              next = { ...next, runs: remapRunsAfterTextEdit(layer, raw.text) } as Layer;
            }
            // Keep the selection box aligned with multi-line / rich / vertical content.
            // Only layout-affecting patches need measurement (x/y drags would otherwise measure every frame),
            // and an explicit height (transform resize writes width + height) wins so dragging handles still works.
            const affectsLayout =
              raw.text !== undefined ||
              raw.runs !== undefined ||
              raw.fontSize !== undefined ||
              raw.fontFamily !== undefined ||
              raw.bold !== undefined ||
              raw.italic !== undefined ||
              raw.underline !== undefined ||
              raw.fill !== undefined ||
              raw.lineHeight !== undefined ||
              raw.letterSpacing !== undefined ||
              raw.paragraphSpacing !== undefined ||
              raw.warp !== undefined ||
              raw.direction !== undefined ||
              raw.width !== undefined;
            if (affectsLayout) {
              const textNext = next as TextLayer;
              if ((textNext.direction ?? 'horizontal') === 'vertical') {
                // Switching from horizontal: one line tall would wrap into 1-character columns, so give it room
                if ((layer.direction ?? 'horizontal') !== 'vertical') {
                  const pitch = textNext.fontSize * textNext.lineHeight;
                  if (textNext.height < pitch * 1.5) {
                    next = { ...textNext, height: Math.round(pitch * 8) } as Layer;
                  }
                }
                // Always re-wrapped: a resized box height or new text must recompute the column count
                next = fitTextLayer(next as TextLayer) as Layer;
              } else if (raw.height === undefined) {
                next = fitTextLayer(next as TextLayer) as Layer;
              }
            }
          }
          return next;
        }),
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
    // Push the group first, then move the layer (and its subtree) inside it
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
    // Expanded state is view state and stays out of undo history
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
    // The presentation size reuses the layer's displayed size (no resampling)
    const smartLayer: Layer = {
      ...smart,
      // Keep the id: selection, mask references and layer-stack relations all stay valid
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
      // Non-destructive parameters on the bitmap upgrade as-is to smart object parameters, losing nothing
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
    // Resample fresh pixels at the current presentation size; from here it is a plain bitmap
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
      // Smart filters act on the presentation size and the new bitmap already is that size → carry them over as-is
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
    // Releasing a clip is always fine; creating one needs a drawable layer below, or the clip does nothing
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
    // Make sure a mesh exists when entering mesh mode (2×2 for four corners, 4×4 for warp)
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
    // Start from the current selection: outside is black (unselected), inside is white (selected), as in PS
    const assetId = state.selection
      ? createMaskCanvasFromSelection(state.doc.width, state.doc.height, state.selection)
      : createMaskCanvas(state.doc.width, state.doc.height, 'hide');
    // Also switch to the brush: entering quick mask is all about painting the selection
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
    // The canvas is reclaimed lazily by releaseExcept (it leaves the reference set once quickMask is null)
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
    // An all-black channel (no highlights) means "nothing to load": clear the selection instead of an empty one
    set({ selection: selectionFromMask(frame.data, canvas.width, canvas.height) });
  },

  addSample: (x, y) => {
    const state = get();
    const px = Math.max(0, Math.min(state.doc.width - 1, Math.floor(x)));
    const py = Math.max(0, Math.min(state.doc.height - 1, Math.floor(y)));
    // Sampling reads the composited result, same as the eyedropper: you get what you see
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

  // "Show this panel" means: switch to its group and point that group's sub tab at it
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
    // Only look for siblings inside the same parent, so a child never leaves its group (breaking "child follows group")
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
    // Only "merge bitmap down" is supported: text / shape layers below are not merged, avoiding silent data loss
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
    // Pasted layers get automatic names, so a copied source name doesn't become a duplicate entry
    copy.name = '';
    get().addLayer(copy);
  },

  ensurePaintLayer: () => {
    const state = get();
    const active = state.doc.layers.find((layer) => layer.id === state.doc.activeLayerId);
    if (active && active.kind === 'raster' && !active.locked) {
      // Bitmap missing (e.g. a huge draft restored structure only): fill in a blank canvas here,
      // or painting writes into an "empty asset" and looks like "the brush draws nothing"
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
    const layer = createTextLayer({
      doc: get().doc,
      x,
      y,
      text,
      direction: get().textDirection,
    });
    get().addLayer(fitTextLayer(layer));
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
    // Oversized images are scaled to fit the canvas, so opening a 4000px photo doesn't show only a corner
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
   * Snapshot before a pixel operation: copy the target layer's bitmap
   * so the doc in history points at the pre-write canvas (assets are immutable, so undo restores strokes).
   */
  commitPixels: (id, label = 'histEdit') => {
    const state = get();
    const layer = state.doc.layers.find((item) => item.id === id);
    if (!layer) {
      state.commit(label);
      return;
    }
    // Painting in the mask: clone only the mask canvas, the bitmap stays
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
    // Bitmap layers can have masks too, and mask pixels need their own snapshot
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
      // The state being undone goes to future: it carries "the operation name that produced it"
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
      // The state being left goes to past: its label is the operation about to be redone
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
    // Linear jump: undo / redo step by step to the target row (bounded by HISTORY_LIMIT, so the cost is negligible)
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

/* --------------------------- Merge / flatten helpers --------------------------- */

/** Bake the bitmap layer above into the one below, honoring geometry, opacity and blend mode */
function mergeRasterPair(bottom: Layer, top: Layer): Layer | null {
  if (bottom.kind !== 'raster' || top.kind !== 'raster') return null;
  // Merge onto the union of both canvases, so parts sticking out of the base are not cropped
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

/** Flatten all visible layers into one bitmap (equivalent to PS's "merge visible") */
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

/** Lasso vertices → selection (computes bounds and thins them out along the way) */
export function selectionFromPath(path: number[], feather: number): Selection | null {
  const simplified = simplifyPath(path);
  if (simplified.length < 6) return null;
  const bounds = polygonBounds(simplified);
  if (bounds.width < 2 || bounds.height < 2) return null;
  return { kind: 'lasso', ...bounds, path: simplified, feather };
}
