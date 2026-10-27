/**
 * Session state for hover quick-connect: the drag draft (drawing a preview line) and the shape picker popup.
 * Kept outside useFlowStore so high-frequency pointer moves do not re-render nodes/edges.
 */

import { create } from 'zustand';

export type QuickDir = 'up' | 'down' | 'left' | 'right';

export interface QuickDraft {
  sourceId: string;
  dir: QuickDir;
  /** Start point (client coordinates) */
  startX: number;
  startY: number;
  /** Current pointer position (client coordinates) */
  curX: number;
  curY: number;
  /** Whether a valid drag has started */
  moved: boolean;
}

export interface QuickPicker {
  /** Source shape (decides which category the popup lists) */
  sourceId: string;
  /** Id of the connected node already created on release (its type changes after picking a shape) */
  nodeId: string;
  /** Popup position (relative to the canvas container) */
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
