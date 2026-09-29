/**
 * 编辑器快捷键：仅在外层容器获得焦点或无输入元素聚焦时生效，
 * 避免与浏览器/系统快捷键以及行内文本编辑冲突。
 */

export interface KeyboardCallbacks {
  onDelete: () => void;
  onUndo: () => void;
  onRedo: () => void;
  onDuplicate: () => void;
  onNudge: (dx: number, dy: number) => void;
  onSelectAll: () => void;
  onEscape: () => void;
  onCopy: () => void;
  onCut: () => void;
  onPaste: () => void;
  onGroup: () => void;
  onUngroup: () => void;
  onPrevSlide: () => void;
  onNextSlide: () => void;
  onPresent: () => void;
  /** ⌘/Ctrl + F：打开查找替换浮层 */
  onFind: () => void;
  /** ⌘/Ctrl + Shift + C：复制格式（格式刷第一步） */
  onCopyFormat: () => void;
  /** ⌘/Ctrl + Shift + V：套用格式（格式刷第二步） */
  onPasteFormat: () => void;
  /** ⌘/Ctrl + M：在普通视图与母版视图之间切换 */
  onToggleMaster: () => void;
}

const EDIT_TAGS = new Set(['INPUT', 'TEXTAREA', 'SELECT']);

function isEditing(target: EventTarget | null): boolean {
  if (!(target instanceof HTMLElement)) return false;
  if (EDIT_TAGS.has(target.tagName)) return true;
  return target.isContentEditable;
}

export function handleShortcut(event: KeyboardEvent, callbacks: KeyboardCallbacks): boolean {
  if (isEditing(event.target)) return false;
  const meta = event.metaKey || event.ctrlKey;

  if (meta && event.key.toLowerCase() === 'z') {
    event.preventDefault();
    if (event.shiftKey) callbacks.onRedo();
    else callbacks.onUndo();
    return true;
  }
  if (meta && event.key.toLowerCase() === 'y') {
    event.preventDefault();
    callbacks.onRedo();
    return true;
  }
  if (meta && event.key.toLowerCase() === 'd') {
    event.preventDefault();
    callbacks.onDuplicate();
    return true;
  }
  if (meta && event.key.toLowerCase() === 'a') {
    event.preventDefault();
    callbacks.onSelectAll();
    return true;
  }
  // 注意顺序：带 Shift 的组合（格式刷）必须排在普通复制/粘贴之前判断
  if (meta && event.shiftKey && event.key.toLowerCase() === 'c') {
    event.preventDefault();
    callbacks.onCopyFormat();
    return true;
  }
  if (meta && event.shiftKey && event.key.toLowerCase() === 'v') {
    event.preventDefault();
    callbacks.onPasteFormat();
    return true;
  }
  if (meta && !event.shiftKey && event.key.toLowerCase() === 'c') {
    event.preventDefault();
    callbacks.onCopy();
    return true;
  }
  if (meta && event.key.toLowerCase() === 'x') {
    event.preventDefault();
    callbacks.onCut();
    return true;
  }
  if (meta && !event.shiftKey && event.key.toLowerCase() === 'v') {
    event.preventDefault();
    callbacks.onPaste();
    return true;
  }
  if (meta && event.key.toLowerCase() === 'g') {
    event.preventDefault();
    if (event.shiftKey) callbacks.onUngroup();
    else callbacks.onGroup();
    return true;
  }
  if (meta && event.key.toLowerCase() === 'f') {
    event.preventDefault();
    callbacks.onFind();
    return true;
  }
  if (meta && event.key.toLowerCase() === 'm') {
    event.preventDefault();
    callbacks.onToggleMaster();
    return true;
  }
  if (event.key === 'Delete' || event.key === 'Backspace') {
    event.preventDefault();
    callbacks.onDelete();
    return true;
  }
  if (event.key === 'Escape') {
    callbacks.onEscape();
    return true;
  }
  if (event.key === 'ArrowLeft') {
    event.preventDefault();
    callbacks.onNudge(event.shiftKey ? -10 : -1, 0);
    return true;
  }
  if (event.key === 'ArrowRight') {
    event.preventDefault();
    callbacks.onNudge(event.shiftKey ? 10 : 1, 0);
    return true;
  }
  if (event.key === 'ArrowUp') {
    event.preventDefault();
    callbacks.onNudge(0, event.shiftKey ? -10 : -1);
    return true;
  }
  if (event.key === 'ArrowDown') {
    event.preventDefault();
    callbacks.onNudge(0, event.shiftKey ? 10 : 1);
    return true;
  }
  if (event.key === 'PageDown' || event.key === 'PageUp') {
    event.preventDefault();
    if (event.key === 'PageDown') callbacks.onNextSlide();
    else callbacks.onPrevSlide();
    return true;
  }
  if (event.key === 'F5') {
    event.preventDefault();
    callbacks.onPresent();
    return true;
  }
  return false;
}

export function attachKeyboard(callbacks: KeyboardCallbacks): () => void {
  const listener = (event: KeyboardEvent) => {
    handleShortcut(event, callbacks);
  };
  window.addEventListener('keydown', listener);
  return () => window.removeEventListener('keydown', listener);
}
