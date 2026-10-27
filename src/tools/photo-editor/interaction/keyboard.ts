import type { ToolId } from '../model/types';
import { usePhotoStore } from '../store';

/**
 * Shortcuts: aligned with desktop photo editors.
 * Everything yields while focus is in an input / textarea, so typing keeps its keys.
 */

/** Single-key tool shortcuts (Shift combos live in `RETOUCH_CYCLE` and the fill branch of keydown) */
export const TOOL_SHORTCUTS: Record<string, ToolId> = {
  v: 'move',
  m: 'rectSelect',
  o: 'ellipseSelect',
  l: 'lasso',
  w: 'wand',
  a: 'quickSelect',
  c: 'crop',
  b: 'brush',
  e: 'eraser',
  i: 'eyedropper',
  g: 'gradient',
  s: 'cloneStamp',
  j: 'healing',
  r: 'smudge',
  t: 'text',
  u: 'shape',
  h: 'hand',
};

/** ⇧O cycles within a tool family (matching the ⇧O badge in the toolbox) */
export const RETOUCH_CYCLE: ToolId[] = ['dodge', 'burn', 'sponge'];

/** ⇧L cycles the lasso family: freehand → polygon → magnetic */
export const LASSO_CYCLE: ToolId[] = ['lasso', 'polyLasso', 'magneticLasso'];

export interface KeyboardHooks {
  onExport: () => void;
  /** Fit to window (⌘0) */
  onFit: () => void;
  /** 100% (⌘1) */
  onActual: () => void;
  /** Open the shortcut sheet (F1 / ?) */
  onShortcuts: () => void;
  /** Copy to the system clipboard (⇧⌘C) */
  onCopySystem: () => void;
  /**
   * Paste from the system clipboard (⇧⌘V, and the preferred path for ⌘V).
   * Returning true means the system clipboard had an image and it was handled, so skip the internal paste.
   */
  onPasteSystem: () => Promise<boolean>;
}

export function attachKeyboard(hooks: KeyboardHooks): () => void {
  const onKeyDown = (event: KeyboardEvent) => {
    const target = event.target as HTMLElement | null;
    if (target && /^(INPUT|TEXTAREA|SELECT)$/.test(target.tagName)) return;

    const state = usePhotoStore.getState();
    const meta = event.metaKey || event.ctrlKey;
    const key = event.key.toLowerCase();

    if (meta && key === 'z' && !event.shiftKey) {
      event.preventDefault();
      state.undo();
      return;
    }
    if ((meta && key === 'y') || (meta && key === 'z' && event.shiftKey)) {
      event.preventDefault();
      state.redo();
      return;
    }
    if (meta && key === 'c' && event.shiftKey) {
      // Copy to the system clipboard: pastes straight into and out of Photoshop / Photopea
      event.preventDefault();
      hooks.onCopySystem();
      return;
    }
    if (meta && key === 'c') {
      state.copyLayer();
      return;
    }
    if (meta && key === 'v') {
      event.preventDefault();
      if (event.shiftKey) {
        // ⇧⌘V: system clipboard only
        void hooks.onPasteSystem();
        return;
      }
      // ⌘V prefers the system clipboard (an externally copied image becomes a new layer);
      // if that fails it falls back to the internal layer clipboard, keeping the old copy/paste behavior.
      void hooks.onPasteSystem().then((handled) => {
        if (!handled) usePhotoStore.getState().pasteLayer();
      });
      return;
    }
    if (meta && key === 'i' && event.shiftKey) {
      event.preventDefault();
      state.invertSelection();
      return;
    }
    if (meta && key === 'j') {
      // New layer via copy
      event.preventDefault();
      state.copySelectionToLayer();
      return;
    }
    if (meta && (key === '0' || key === '1')) {
      event.preventDefault();
      if (key === '0') hooks.onFit();
      else hooks.onActual();
      return;
    }
    if (event.key === 'F1' || event.key === '?') {
      event.preventDefault();
      hooks.onShortcuts();
      return;
    }
    if (meta && key === 'a') {
      event.preventDefault();
      state.selectAll();
      return;
    }
    if (meta && key === 'd') {
      event.preventDefault();
      state.setSelection(null);
      return;
    }
    if (meta && key === 's') {
      event.preventDefault();
      hooks.onExport();
      return;
    }
    if (meta && key === 't' && event.shiftKey) {
      // ⇧⌘T: transform again (repeat the last translate / scale / rotate)
      event.preventDefault();
      state.repeatTransform();
      return;
    }
    if (meta && key === 't') {
      // Free transform (Ctrl/⌘ + T): switch to the transform tool and drag the selected layer's handles
      event.preventDefault();
      state.setTool('transform');
      return;
    }
    if ((key === 'enter' || key === 'escape') && state.tool === 'transform') {
      event.preventDefault();
      // Enter = commit and exit; Esc = discard this transform and exit
      if (key === 'escape') state.undo();
      state.setTool('move');
      return;
    }
    if (key === 'delete' || key === 'backspace') {
      event.preventDefault();
      // With a selection, "delete" clears its content (as in the context menu); otherwise it deletes the layer
      if (state.selection) state.fillSelectionArea('clear');
      else if (state.doc.activeLayerId) state.removeLayer(state.doc.activeLayerId);
      return;
    }
    if (key === 'escape') {
      state.setSelection(null);
      state.setCropRect(null);
      return;
    }
    if (key === '[' || key === ']') {
      const next = Math.max(1, state.brush.size + (key === ']' ? 4 : -4));
      state.patchBrush({ size: next });
      return;
    }
    if (event.code === 'Space' && !event.repeat) {
      event.preventDefault();
      state.setTool('hand');
      return;
    }
    if (!meta && key === 'x') {
      // Swap foreground / background color
      event.preventDefault();
      state.swapColors();
      return;
    }
    if (!meta && key === 'd') {
      // Reset to black foreground / white background
      event.preventDefault();
      state.resetColors();
      return;
    }
    if (!meta && key === 'q') {
      // Toggle quick mask (same as PS)
      event.preventDefault();
      state.toggleQuickMask();
      return;
    }
    if (event.key === 'Escape' && state.quickMask) {
      // In mask mode Esc exits the mask first (converting edits to a selection), not the default deselect
      event.preventDefault();
      state.exitQuickMask();
      return;
    }

    // Shift + letter: secondary tools within a family (following PS's group-cycling convention)
    if (!meta && event.shiftKey) {
      if (key === 'g') {
        state.setTool('fill');
        return;
      }
      if (key === 'j') {
        state.setTool(state.tool === 'spotHeal' ? 'healing' : 'spotHeal');
        return;
      }
      if (key === 'r') {
        // ⇧R: cycle blur / sharpen (matching the toolbox badge)
        state.setTool(state.tool === 'blurBrush' ? 'sharpenBrush' : 'blurBrush');
        return;
      }
      if (key === 'i') {
        // ⇧I: eyedropper ↔ color sampler (matching the toolbox badge)
        state.setTool(state.tool === 'sampler' ? 'eyedropper' : 'sampler');
        return;
      }
      if (key === 'o') {
        const index = RETOUCH_CYCLE.indexOf(state.tool as ToolId);
        state.setTool(RETOUCH_CYCLE[(index + 1) % RETOUCH_CYCLE.length]);
        return;
      }
      if (key === 'l') {
        // ⇧L: freehand → polygon → magnetic
        const index = LASSO_CYCLE.indexOf(state.tool as ToolId);
        state.setTool(LASSO_CYCLE[(index + 1) % LASSO_CYCLE.length]);
        return;
      }
    }

    if (!meta && TOOL_SHORTCUTS[key]) state.setTool(TOOL_SHORTCUTS[key]);
  };

  const onKeyUp = (event: KeyboardEvent) => {
    if (event.code !== 'Space') return;
    const state = usePhotoStore.getState();
    // Space temporarily pans; releasing returns to the move tool
    if (state.tool === 'hand') state.setTool('move');
  };

  window.addEventListener('keydown', onKeyDown);
  window.addEventListener('keyup', onKeyUp);
  return () => {
    window.removeEventListener('keydown', onKeyDown);
    window.removeEventListener('keyup', onKeyUp);
  };
}
