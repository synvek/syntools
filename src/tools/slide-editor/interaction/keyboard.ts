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
  onPrevSlide: () => void;
  onNextSlide: () => void;
  onPresent: () => void;
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
