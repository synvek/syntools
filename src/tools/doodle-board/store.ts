/**
 * 涂鸦画板状态：唯一真相源是 `scene`（矢量 ops），工具参数是会话态。
 *
 * 历史采用**不可变场景快照**：`past` / `future` 里存的是整个 Scene 对象，
 * 因为 ops 数组不可变，快照只是多一个引用，成本远低于复制位图。
 * `addOp` 属于「正在画」，因此每次落笔前压一次快照，中途的笔迹不进历史。
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
  /** 是否启用触控笔压感（鼠标无效） */
  pressure: boolean;
}

/** 最近使用颜色：新色置顶并去重 */
function pushRecent(list: string[], color: string): string[] {
  return [color, ...list.filter((item) => item !== color)].slice(0, RECENT_LIMIT);
}

interface BoardState {
  scene: Scene;
  tool: ToolId;
  /** 吸管前的工具：取色结束后自动切回，符合经典画板习惯 */
  lastTool: ToolId;
  brush: BrushConfig;
  /** 前景色外的「背景色」：形状填充色，也是右键落笔的颜色 */
  secondary: string;
  recent: string[];
  /** 缩放：`fit` 跟随容器宽度自适应，数值为固定倍率 */
  zoom: number | 'fit';
  /** 画布当前实际倍率，由 BoardCanvas 测算回填，供工具栏缩放控件使用 */
  viewScale: number;
  /** 工具栏是否收起为一条细条（最大化工作区） */
  collapsed: boolean;
  /** 「更多设置」面板是否展开 */
  details: boolean;
  textSize: number;
  /** 形状是否填充 */
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
  /** 整体平移：把位移烘焙进所有 op 的坐标（单条历史） */
  translateScene: (dx: number, dy: number) => void;
  patchBrush: (patch: Partial<BrushConfig>) => void;
  setTextSize: (size: number) => void;
  setFill: (fill: boolean) => void;
  setPreset: (preset: SizePreset) => void;
  setBackground: (patch: Partial<Background>) => void;
  setSize: (width: number, height: number, options?: { history?: boolean }) => void;
  /** 自适应预设：按容器可用宽度重算画布尺寸（不进历史） */
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
  // 默认填充：形状开箱即用「描边=前景色、填充=背景色」的经典画板语义
  fill: true,
  preset: 'fit',
  past: [],
  future: [],

  setTool: (tool) =>
    set((s) => {
      // 荧光笔的观感依赖半透明与粗笔尖：切过去时补齐默认值，回到画笔再还原
      const width = tool === 'marker' ? Math.max(MARKER_MIN_WIDTH, s.brush.width) : s.brush.width;
      const opacity =
        tool === 'marker'
          ? Math.min(s.brush.opacity, MARKER_OPACITY)
          : s.brush.opacity === MARKER_OPACITY
            ? DEFAULT_OPACITY
            : s.brush.opacity;
      return {
        tool,
        // 记住「吸管之前」的工具，取色完成后回退；其余情况持续更新
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

  // 载入草稿 / 场景：进入历史起点状态（preset 交给上层的自适应逻辑重新计算）
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

/** 背景类型顺序（工具栏分段控件用） */
export const BACKGROUND_KINDS: BackgroundKind[] = ['transparent', 'solid', 'grid'];
