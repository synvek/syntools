import { useEffect, useRef } from 'react';
import type { KeyboardEvent as ReactKeyboardEvent } from 'react';
import { useOverlayStack } from './useOverlayStack';

/**
 * Keyboard + dismissal behaviour for `role="menu"` galleries (implementation plan P0-4.4).
 *
 * Unlike the modal dialogs, a gallery is not a focus trap: Tab must still be able to leave it.
 * What it needs is arrow-key navigation between its `menuitem`s, topmost-only Escape, an outside
 * pointer-down dismiss, and focus returned to the opener when it unmounts.
 *
 * The trigger button lives in the same `data-ribbon-group` as the overlay, but outside the overlay
 * DOM subtree. Pointer-down on it is deliberately ignored: the button's own click toggles the
 * gallery, and closing here as well would immediately reopen it.
 */
export function useMenuNavigation(open: boolean, onClose: () => void) {
  const rootRef = useRef<HTMLDivElement | null>(null);
  const previousRef = useRef<HTMLElement | null>(null);
  useOverlayStack(open, onClose);

  useEffect(() => {
    if (!open) return;
    previousRef.current = document.activeElement as HTMLElement | null;
    rootRef.current?.querySelector<HTMLElement>('[role="menuitem"]')?.focus();
    return () => {
      previousRef.current?.focus?.();
    };
  }, [open]);

  useEffect(() => {
    if (!open) return;
    const onPointerDown = (event: PointerEvent) => {
      const root = rootRef.current;
      if (!root || root.contains(event.target as Node)) return;
      const group = root.closest('[data-ribbon-group]');
      if (group && event.target instanceof Node && group.contains(event.target)) return;
      onClose();
    };
    window.addEventListener('pointerdown', onPointerDown);
    return () => window.removeEventListener('pointerdown', onPointerDown);
  }, [open, onClose]);

  const onKeyDown = (event: ReactKeyboardEvent<HTMLDivElement>) => {
    const root = rootRef.current;
    if (!root) return;
    const items = Array.from(root.querySelectorAll<HTMLElement>('[role="menuitem"]')).filter(
      (item) => !item.hasAttribute('disabled'),
    );
    if (items.length === 0) return;
    const index = items.indexOf(document.activeElement as HTMLElement);
    let next: number;
    switch (event.key) {
      case 'ArrowRight':
      case 'ArrowDown':
        next = index < 0 ? 0 : (index + 1) % items.length;
        break;
      case 'ArrowLeft':
      case 'ArrowUp':
        next = index < 0 ? items.length - 1 : (index - 1 + items.length) % items.length;
        break;
      case 'Home':
        next = 0;
        break;
      case 'End':
        next = items.length - 1;
        break;
      default:
        return;
    }
    event.preventDefault();
    items[next]?.focus();
  };

  return { rootRef, onKeyDown };
}
