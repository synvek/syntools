import { useEffect, useRef, useState } from 'react';

/**
 * A tiny, framework-agnostic dismiss stack (implementation plan P0-4.1).
 *
 * Escape must close *only* the topmost layer. Before this hook, every dialog / menu / find panel
 * registered its own window keydown listener (some in the capture phase with stopPropagation),
 * so one Escape could close several layers and clear selection, find and draw state at once.
 *
 * Design choice: this hook does NOT call stopPropagation / stopImmediatePropagation. Other tools'
 * listeners keep seeing the event untouched; only the *dismiss decision* is coordinated. That
 * makes the stack safe to adopt one editor at a time (the rollback strategy in plan §5.4).
 */

interface OverlayEntry {
  id: string;
}

const stack: OverlayEntry[] = [];
const subscribers = new Set<() => void>();
let sequence = 0;

function notify(): void {
  for (const subscriber of subscribers) subscriber();
}

/** True while at least one layer is registered — guards global Esc fallbacks (find / draw tools). */
export function hasOverlay(): boolean {
  return stack.length > 0;
}

/** Current depth, exposed for tests and diagnostics. */
export function overlayDepth(): number {
  return stack.length;
}

/**
 * Register one dismissable layer. `onDismiss` fires on Escape only while this layer is topmost.
 * Layers are pushed in mount order, so a nested dialog mounted later is naturally on top.
 */
export function useOverlayStack(open: boolean, onDismiss: () => void): { isTop: boolean } {
  const idRef = useRef('');
  if (!idRef.current) idRef.current = `overlay-${++sequence}`;
  const dismissRef = useRef(onDismiss);
  dismissRef.current = onDismiss;
  const [isTop, setIsTop] = useState(false);

  useEffect(() => {
    if (!open) return;
    const id = idRef.current;
    stack.push({ id });
    notify();
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key !== 'Escape') return;
      if (stack[stack.length - 1]?.id !== id) return;
      event.preventDefault();
      dismissRef.current();
    };
    window.addEventListener('keydown', onKeyDown);
    return () => {
      window.removeEventListener('keydown', onKeyDown);
      const index = stack.findIndex((entry) => entry.id === id);
      if (index >= 0) stack.splice(index, 1);
      notify();
    };
  }, [open]);

  useEffect(() => {
    const update = () => setIsTop(stack[stack.length - 1]?.id === idRef.current);
    subscribers.add(update);
    update();
    return () => {
      subscribers.delete(update);
    };
  }, []);

  return { isTop };
}

const FOCUSABLE =
  'a[href],button:not([disabled]),input:not([disabled]),select:not([disabled]),textarea:not([disabled]),[tabindex]:not([tabindex="-1"])';

function isFocusable(element: HTMLElement): boolean {
  return !element.hasAttribute('disabled') && element.getAttribute('aria-hidden') !== 'true';
}

/**
 * Modal behaviour built on the stack (P0-4.3): topmost-only Escape, Tab cycling inside the
 * dialog, and focus returned to the opener when the dialog actually closes. The focus-restore
 * effect depends on `open` only, so covering it with another layer does not steal focus back.
 */
export function useModalBehavior(open: boolean, onDismiss: () => void): { isTop: boolean } {
  const { isTop } = useOverlayStack(open, onDismiss);
  const previousRef = useRef<HTMLElement | null>(null);

  useEffect(() => {
    if (!open) return;
    previousRef.current = document.activeElement as HTMLElement | null;
    return () => {
      previousRef.current?.focus?.();
    };
  }, [open]);

  useEffect(() => {
    if (!open) return;
    // Registered unconditionally: `isTop` arrives one render *after* the layer is pushed, so
    // gating this listener on it lets the first Tab escape on a slow render. All open modals
    // resolve the same topmost dialog node below, so duplicate listeners are harmless and the
    // covering dialog still owns the focus cycle.
    // The newest modal dialog is the topmost one; the word processor opens these exclusively,
    // so no per-component ref wiring is needed to trap Tab inside it.
    const currentDialog = (): HTMLElement | null => {
      const nodes = document.querySelectorAll<HTMLElement>('[role="dialog"][aria-modal="true"]');
      return nodes[nodes.length - 1] ?? null;
    };
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key !== 'Tab') return;
      const node = currentDialog();
      if (!node) return;
      const focusables = Array.from(node.querySelectorAll<HTMLElement>(FOCUSABLE)).filter(
        isFocusable,
      );
      if (!focusables.length) {
        event.preventDefault();
        return;
      }
      const first = focusables[0]!;
      const last = focusables[focusables.length - 1]!;
      const active = document.activeElement;
      const outside = !node.contains(active);
      if (event.shiftKey && (active === first || outside)) {
        event.preventDefault();
        last.focus();
      } else if (!event.shiftKey && (active === last || outside)) {
        event.preventDefault();
        first.focus();
      }
    };
    document.addEventListener('keydown', onKeyDown, true);
    return () => document.removeEventListener('keydown', onKeyDown, true);
  }, [open]);

  return { isTop };
}
