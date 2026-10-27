/**
 * Doodle board state: the single source of truth is `scene` (vector ops); tool settings are session state.
 *
 * History uses **immutable scene snapshots**: `past` / `future` hold whole Scene objects. Because
 * the ops arrays are immutable a snapshot is just one extra reference, far cheaper than copying
 * bitmaps. `addOp` is "drawing in progress", so a snapshot is pushed before each stroke and
 * intermediate strokes never enter history.
 */

import { create } from 'zustand';
import type { Background, BackgroundKind, Op, Scene, SizePreset, ToolId } from './core';
import {
  BRUSH_MAX,
  BRUSH_MIN,
  DEFAULT_COLOR,
  DEFAULT_OPACITY,
  DEFAULT_SECONDARY,
  DEFAULT_TEXT_SIZE,
  DEFAULT_WIDTH,
  FIT_ASPECT,
  FIT_MAX_WIDTH,
  FIT_MIN_WIDTH,
  HISTORY_LIMIT,
  MARKER_MIN_WIDTH,
  MARKER_OPACITY,
  MOVE_MIN_DELTA,
  RECENT_LIMIT,
  TEXT_MAX,
  TEXT_MIN,
  clampBrushSize,
  clampInt,
  clampUnit,
  clampZoom,
  createScene,
  SIZE_PRESETS,
  translateOps,
} from './core';

export interface BrushConfig {
  color: string;
  width: number;
  opacity: number;
  /** Enable stylus pressure (no effect for a mouse) */
  pressure: boolean;
}

/** Recent colours: the newest goes first and duplicates are dropped */
function pushRecent(list: string[], color: string): string[] {
  return [color, ...list.filter((item) => item !== color)].slice(0, RECENT_LIMIT);
}

interface BoardState {
  scene: Scene;
  tool: ToolId;
  /** Tool used before the eyedropper: restored after sampling, matching classic drawing apps */
  lastTool: ToolId;
  brush: BrushConfig;
  /** The "background colour" beside the foreground: shape fill and right-click ink colour */
  secondary: string;
  recent: string[];
  /** Zoom: `fit` follows the container width; a number is a fixed scale */
  zoom: number | 'fit';
  /** Current effective canvas scale, measured by BoardCanvas for the toolbar zoom control */
  viewScale: number;
  /** Whether the toolbar is collapsed to a thin strip (maximises the canvas) */
  collapsed: boolean;
  /** Whether the "more settings" panel is expanded */
  details: boolean;
  textSize: number;
  /** Whether shapes are filled */
  fill: boolean;
  preset: SizePreset;
  past: Scene[];
  future: Scene[];

  setTool: (tool: ToolId) => void;
  setPrimaryColor: (color: string) => void;
  setSecondaryColor: (color: string) => void;
  swapColors: () => void;
  setZoom: (zoom: number | 'fit') => void;
  setViewScale: (scale: number) => void;
  toggleCollapsed: () => void;
  toggleDetails: () => void;
  /** Pan: bake the delta into every op's coordinates (one history entry) */
  translateScene: (dx: number, dy: number) => void;
  patchBrush: (patch: Partial<BrushConfig>) => void;
  setTextSize: (size: number) => void;
  setFill: (fill: boolean) => void;
  setPreset: (preset: SizePreset) => void;
  setBackground: (patch: Partial<Background>) => void;
  setSize: (width: number, height: number, options?: { history?: boolean }) => void;
  /** Fit preset: recompute the canvas size from the available container width (no history entry) */
  applyFitSize: (availableWidth: number) => void;
  addOp: (op: Op) => void;
  replaceScene: (scene: Scene) => void;
  undo: () => void;
  redo: () => void;
  clear: () => void;
}

const initialScene = createScene(960, Math.round(960 * FIT_ASPECT));

export const useBoardStore = create<BoardState>((set, get) => ({
  scene: initialScene,
  tool: 'pen',
  lastTool: 'pen',
  brush: { color: DEFAULT_COLOR, width: DEFAULT_WIDTH, opacity: DEFAULT_OPACITY, pressure: true },
  secondary: DEFAULT_SECONDARY,
  recent: [],
  zoom: 'fit',
  viewScale: 1,
  collapsed: false,
  details: true,
  textSize: DEFAULT_TEXT_SIZE,
  // Filled by default: shapes start with the classic "stroke = foreground, fill = background" semantics
  fill: true,
  preset: 'fit',
  past: [],
  future: [],

  setTool: (tool) =>
    set((s) => {
      // The marker look depends on translucency and a broad tip: fill in defaults when switching to it, restore on the way back
      const width = tool === 'marker' ? Math.max(MARKER_MIN_WIDTH, s.brush.width) : s.brush.width;
      const opacity =
        tool === 'marker'
          ? Math.min(s.brush.opacity, MARKER_OPACITY)
          : s.brush.opacity === MARKER_OPACITY
            ? DEFAULT_OPACITY
            : s.brush.opacity;
      return {
        tool,
        // Remember the tool used before the eyedropper so it can be restored; otherwise keep updating
        lastTool: s.tool === 'picker' ? s.lastTool : s.tool,
        brush: { ...s.brush, width, opacity },
      };
    }),

  setPrimaryColor: (color) =>
    set((s) => ({ brush: { ...s.brush, color }, recent: pushRecent(s.recent, color) })),

  setSecondaryColor: (color) =>
    set((s) => ({ secondary: color, recent: pushRecent(s.recent, color) })),

  swapColors: () =>
    set((s) => ({
      brush: { ...s.brush, color: s.secondary },
      secondary: s.brush.color,
    })),

  setZoom: (zoom) => set({ zoom: zoom === 'fit' ? 'fit' : clampZoom(zoom) }),

  setViewScale: (scale) => {
    if (!Number.isFinite(scale) || scale <= 0) return;
    if (Math.abs(get().viewScale - scale) < 0.001) return;
    set({ viewScale: scale });
  },

  toggleCollapsed: () => set((s) => ({ collapsed: !s.collapsed })),

  toggleDetails: () => set((s) => ({ details: !s.details })),

  translateScene: (dx, dy) => {
    if (!Number.isFinite(dx) || !Number.isFinite(dy)) return;
    if (Math.abs(dx) < MOVE_MIN_DELTA && Math.abs(dy) < MOVE_MIN_DELTA) return;
    const current = get().scene;
    set({
      past: [...get().past, current].slice(-HISTORY_LIMIT),
      future: [],
      scene: { ...current, ops: translateOps(current.ops, dx, dy) },
    });
  },

  patchBrush: (patch) =>
    set((s) => ({
      brush: {
        ...s.brush,
        ...patch,
        ...(patch.width !== undefined
          ? { width: clampBrushSize(patch.width, BRUSH_MIN, BRUSH_MAX) }
          : {}),
        ...(patch.opacity !== undefined ? { opacity: clampUnit(patch.opacity) } : {}),
      },
    })),

  setTextSize: (size) => set({ textSize: clampInt(size, TEXT_MIN, TEXT_MAX, DEFAULT_TEXT_SIZE) }),
  setFill: (fill) => set({ fill }),

  setPreset: (preset) => {
    const presetSize = preset === 'fit' || preset === 'custom' ? null : SIZE_PRESETS[preset];
    set({ preset });
    if (presetSize) get().setSize(presetSize.width, presetSize.height);
  },

  setBackground: (patch) => {
    const current = get().scene;
    const background = { ...current.background, ...patch };
    if (
      background.kind === current.background.kind &&
      background.color === current.background.color
    ) {
      return;
    }
    set({
      past: [...get().past, current].slice(-HISTORY_LIMIT),
      future: [],
      scene: { ...current, background },
    });
  },

  setSize: (width, height, options) => {
    const history = options?.history ?? true;
    const current = get().scene;
    const next = {
      width: clampInt(width, FIT_MIN_WIDTH, 4096, current.width),
      height: clampInt(height, 1, 4096, current.height),
    };
    if (next.width === current.width && next.height === current.height) return;
    set({
      past: history ? [...get().past, current].slice(-HISTORY_LIMIT) : get().past,
      future: history ? [] : get().future,
      scene: { ...current, ...next },
    });
  },

  applyFitSize: (availableWidth) => {
    if (get().preset !== 'fit') return;
    const width = clampInt(availableWidth, FIT_MIN_WIDTH, FIT_MAX_WIDTH, 960);
    get().setSize(width, Math.round(width * FIT_ASPECT), { history: false });
  },

  addOp: (op) => {
    const current = get().scene;
    set({
      past: [...get().past, current].slice(-HISTORY_LIMIT),
      future: [],
      scene: { ...current, ops: [...current.ops, op] },
    });
  },

  // Loading a draft / scene: enters a fresh history state (the caller recomputes the fit preset)
  replaceScene: (scene) => set({ scene, past: [], future: [] }),

  undo: () => {
    const { past, future, scene } = get();
    if (past.length === 0) return;
    set({
      past: past.slice(0, -1),
      future: [scene, ...future].slice(0, HISTORY_LIMIT),
      scene: past[past.length - 1],
    });
  },

  redo: () => {
    const { past, future, scene } = get();
    if (future.length === 0) return;
    set({
      past: [...past, scene].slice(-HISTORY_LIMIT),
      future: future.slice(1),
      scene: future[0],
    });
  },

  clear: () => {
    const { scene } = get();
    if (scene.ops.length === 0) return;
    set({
      past: [...get().past, scene].slice(-HISTORY_LIMIT),
      future: [],
      scene: { ...scene, ops: [] },
    });
  },
}));

/** Background kinds in display order (for the toolbar segmented control) */
export const BACKGROUND_KINDS: BackgroundKind[] = ['transparent', 'solid', 'grid'];
