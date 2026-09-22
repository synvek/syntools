import { usePhotoStore } from '../store';

/**
 * 快捷键：与桌面端修图软件对齐。
 * 焦点在输入框 / textarea 内时全部让行，避免抢走文字编辑的按键。
 */

export interface KeyboardHooks {
  onExport: () => void;
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
    if (meta && key === 'c') {
      state.copyLayer();
      return;
    }
    if (meta && key === 'v') {
      state.pasteLayer();
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
    if (key === 'delete' || key === 'backspace') {
      if (state.doc.activeLayerId) {
        event.preventDefault();
        state.removeLayer(state.doc.activeLayerId);
      }
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

    const shortcut: Record<string, Parameters<typeof state.setTool>[0]> = {
      v: 'move',
      m: 'rectSelect',
      l: 'lasso',
      c: 'crop',
      b: 'brush',
      e: 'eraser',
      i: 'eyedropper',
      g: 'fill',
      t: 'text',
      u: 'shape',
      h: 'hand',
    };
    if (!meta && shortcut[key]) state.setTool(shortcut[key]);
  };

  const onKeyUp = (event: KeyboardEvent) => {
    if (event.code !== 'Space') return;
    const state = usePhotoStore.getState();
    // 空格临时抓手：松手回到移动工具
    if (state.tool === 'hand') state.setTool('move');
  };

  window.addEventListener('keydown', onKeyDown);
  window.addEventListener('keyup', onKeyUp);
  return () => {
    window.removeEventListener('keydown', onKeyDown);
    window.removeEventListener('keyup', onKeyUp);
  };
}
