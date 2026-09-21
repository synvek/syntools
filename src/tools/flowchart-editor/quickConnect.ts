/**
 * 悬停快速连线的会话态：拖拽草稿（画预览线）与图形选择弹窗。
 * 独立于 useFlowStore，避免指针高频移动时触发节点/连线重渲染。
 */

import { create } from 'zustand';

export type QuickDir = 'up' | 'down' | 'left' | 'right';

export interface QuickDraft {
  sourceId: string;
  dir: QuickDir;
  /** 起点（client 坐标） */
  startX: number;
  startY: number;
  /** 当前指针（client 坐标） */
  curX: number;
  curY: number;
  /** 是否已产生有效拖动 */
  moved: boolean;
}

export interface QuickPicker {
  /** 源图形（决定弹窗列出哪个分类） */
  sourceId: string;
  /** 松手时已立即生成的相连节点 id（选择图形后改变其类型） */
  nodeId: string;
  /** 弹窗位置（相对画布容器） */
  x: number;
  y: number;
}

interface QuickConnectState {
  draft: QuickDraft | null;
  picker: QuickPicker | null;
  start: (d: { sourceId: string; dir: QuickDir; x: number; y: number }) => void;
  move: (x: number, y: number) => void;
  cancel: () => void;
  openPicker: (p: QuickPicker) => void;
  closePicker: () => void;
}

export const useQuickConnect = create<QuickConnectState>((set) => ({
  draft: null,
  picker: null,

  start: ({ sourceId, dir, x, y }) =>
    set({
      draft: { sourceId, dir, startX: x, startY: y, curX: x, curY: y, moved: false },
      picker: null,
    }),

  move: (x, y) =>
    set((s) => {
      if (!s.draft) return s;
      const moved = s.draft.moved || Math.hypot(x - s.draft.startX, y - s.draft.startY) > 6;
      return { draft: { ...s.draft, curX: x, curY: y, moved } };
    }),

  cancel: () => set({ draft: null }),

  openPicker: (p) => set({ draft: null, picker: p }),

  closePicker: () => set({ picker: null }),
}));
