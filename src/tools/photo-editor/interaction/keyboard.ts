import type { ToolId } from '../model/types';
import { usePhotoStore } from '../store';

/**
 * 快捷键：与桌面端修图软件对齐。
 * 焦点在输入框 / textarea 内时全部让行，避免抢走文字编辑的按键。
 */

/** 单键工具快捷键（Shift 组合见 `RETOUCH_CYCLE` 与 keydown 中的 fill 分支） */
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

/** ⇧O 在同族工具间循环（与工具箱角标 ⇧O 一致） */
export const RETOUCH_CYCLE: ToolId[] = ['dodge', 'burn', 'sponge'];

export interface KeyboardHooks {
  onExport: () => void;
  /** 适应窗口（⌘0） */
  onFit: () => void;
  /** 100%（⌘1） */
  onActual: () => void;
  /** 打开快捷键一览（F1 / ?） */
  onShortcuts: () => void;
  /** 拷贝到系统剪贴板（⇧⌘C） */
  onCopySystem: () => void;
  /**
   * 从系统剪贴板粘贴（⇧⌘V，以及 ⌘V 的首选路径）。
   * 返回 true 表示系统剪贴板里确实有图像并已处理 —— 此时不再执行内部图层粘贴。
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
      // 拷贝到系统剪贴板：可与 Photoshop / Photopea 直接互贴
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
        // ⇧⌘V：只走系统剪贴板
        void hooks.onPasteSystem();
        return;
      }
      // ⌘V 优先系统剪贴板（外部复制来的图片直接落成新图层）；
      // 读不到再回退到内部图层剪贴板，保证既有的图层复制粘贴手感不变。
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
      // 通过拷贝新建图层
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
      // ⇧⌘T：再次变换（重复上一次的平移 / 缩放 / 旋转）
      event.preventDefault();
      state.repeatTransform();
      return;
    }
    if (meta && key === 't') {
      // 自由变换（Ctrl/⌘ + T）：进入变换工具，选中图层后即可拖拽手柄
      event.preventDefault();
      state.setTool('transform');
      return;
    }
    if ((key === 'enter' || key === 'escape') && state.tool === 'transform') {
      event.preventDefault();
      // Enter = 确认并退出；Esc = 撤销本次变换并退出
      if (key === 'escape') state.undo();
      state.setTool('move');
      return;
    }
    if (key === 'delete' || key === 'backspace') {
      event.preventDefault();
      // 有选区时「删除」清除选区内容（与右键菜单一致），否则删除当前图层
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
      // 前景 / 背景色互换
      event.preventDefault();
      state.swapColors();
      return;
    }
    if (!meta && key === 'd') {
      // 复位为黑前景 / 白背景
      event.preventDefault();
      state.resetColors();
      return;
    }
    if (!meta && key === 'q') {
      // 快速蒙版开关（与 PS 一致）
      event.preventDefault();
      state.toggleQuickMask();
      return;
    }
    if (event.key === 'Escape' && state.quickMask) {
      // 蒙版模式下 Esc 先退出蒙版（把涂改结果转成选区），而不是走「取消选区」的默认行为
      event.preventDefault();
      state.exitQuickMask();
      return;
    }

    // Shift + 字母：工具族内的次级工具（对齐 PS 的分组切换惯例）
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
        // ⇧R：在模糊 / 锐化之间循环（与工具箱角标一致）
        state.setTool(state.tool === 'blurBrush' ? 'sharpenBrush' : 'blurBrush');
        return;
      }
      if (key === 'i') {
        // ⇧I：吸管 ↔ 颜色取样器（与工具箱角标一致）
        state.setTool(state.tool === 'sampler' ? 'eyedropper' : 'sampler');
        return;
      }
      if (key === 'o') {
        const index = RETOUCH_CYCLE.indexOf(state.tool as ToolId);
        state.setTool(RETOUCH_CYCLE[(index + 1) % RETOUCH_CYCLE.length]);
        return;
      }
    }

    if (!meta && TOOL_SHORTCUTS[key]) state.setTool(TOOL_SHORTCUTS[key]);
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
