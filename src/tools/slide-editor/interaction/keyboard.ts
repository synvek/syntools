/**
 * Editor shortcuts: active only when the outer container has focus or no input element is focused,
 * avoiding clashes with browser/system shortcuts and inline text editing.
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
  /** ⌘/Ctrl + F: open the find & replace popover */
  onFind: () => void;
  /** ⌘/Ctrl + Shift + C: copy formatting (format painter step 1) */
  onCopyFormat: () => void;
  /** ⌘/Ctrl + Shift + V: apply formatting (format painter step 2) */
  onPasteFormat: () => void;
  /** ⌘/Ctrl + M: toggle between normal and master view */
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
  // Order matters: Shift combos (format painter) must be checked before plain copy/paste
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
