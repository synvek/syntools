import type { PointerEvent as ReactPointerEvent } from 'react';

/**
 * Pointer-based drag lifecycle shared by the image / shape overlays.
 *
 * They used `mousedown` + window `mousemove`, which never fires for touch or pen — on a tablet the
 * resize / rotate / adjustment handles were simply inert. Pointer events cover mouse, touch and pen
 * with one path, and the pointer id is captured so a finger that slides off a 9px handle keeps
 * dragging instead of dropping the gesture.
 */
export interface PointerDragHandlers {
  /** Move in screen coordinates (callers divide by zoom themselves) */
  move: (event: PointerEvent) => void;
  /** Gesture finished by pointerup or pointercancel — commit here */
  end: () => void;
}

/**
 * Start a drag from a pointerdown. Returns nothing: the listeners detach themselves on pointerup /
 * pointercancel, so an interrupted gesture (incoming call, palm rejection) still commits.
 */
export function startPointerDrag(
  event: ReactPointerEvent<HTMLElement>,
  handlers: PointerDragHandlers,
): void {
  // Non-passive moves are pointless here; the browser must not scroll or zoom the page instead
  event.preventDefault();
  event.stopPropagation();
  const pointerId = event.pointerId;
  try {
    // Synthetic pointer events (tests) have no active pointer to capture; window listeners still work
    event.currentTarget.setPointerCapture(pointerId);
  } catch {
    /* capture is an optimization, not a requirement */
  }

  const matches = (candidate: PointerEvent) =>
    candidate.type === 'pointercancel' || candidate.pointerId === pointerId;

  const move = (moveEvent: PointerEvent) => {
    if (!matches(moveEvent)) return;
    moveEvent.preventDefault();
    handlers.move(moveEvent);
  };
  const finish = (finishEvent: PointerEvent) => {
    if (!matches(finishEvent)) return;
    window.removeEventListener('pointermove', move);
    window.removeEventListener('pointerup', finish);
    window.removeEventListener('pointercancel', finish);
    handlers.end();
  };

  window.addEventListener('pointermove', move);
  window.addEventListener('pointerup', finish);
  window.addEventListener('pointercancel', finish);
}
