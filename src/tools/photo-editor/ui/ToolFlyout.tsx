import { useEffect, useLayoutEffect, useRef, useState } from 'react';
import type { KeyboardEvent as ReactKeyboardEvent } from 'react';
import { createPortal } from 'react-dom';
import { Icon } from '@/core/components/Icon';

export interface FlyoutItem<T extends string> {
  id: T;
  icon: string;
  label: string;
  /** Display-only shortcut; groups without one (shape kinds) may omit it */
  shortcut?: string;
}

/**
 * Group flyout (Photoshop / Photopea's group picker), used by both "click the active tool again"
 * and the shape group button in the options bar, so expansion and keyboard behavior match exactly.
 *
 * Not the same as a "badge button": the little triangle at a button's corner is merely an icon saying
 * "more options exist", not a second clickable button; the button itself opens the flyout.
 *
 * The flyout renders in a portal with fixed positioning: the toolbox scrolls (`overflow-y-auto`),
 * so an in-place absolute box would be clipped; scrolling / zooming / outside clicks / Esc all close it.
 */
export function ToolFlyout<T extends string>({
  anchor,
  label,
  items,
  activeId,
  prefer = 'right',
  onPick,
  onClose,
}: {
  /** Anchor for the flyout (the current option button) */
  anchor: HTMLElement;
  label: string;
  items: FlyoutItem<T>[];
  /** Current option: highlighted in the list and focused when opened */
  activeId: T;
  /** Right of the vertical toolbox; below the horizontal one on narrow screens */
  prefer?: 'right' | 'bottom';
  onPick: (id: T) => void;
  onClose: () => void;
}) {
  const panelRef = useRef<HTMLDivElement>(null);
  const activeRef = useRef<HTMLButtonElement>(null);
  const [position, setPosition] = useState<{ top: number; left: number } | null>(null);

  useLayoutEffect(() => {
    const place = () => {
      const panel = panelRef.current;
      if (!panel) return;
      const rect = anchor.getBoundingClientRect();
      const width = panel.offsetWidth;
      const height = panel.offsetHeight;
      const available = document.documentElement.clientWidth;
      const maxLeft = Math.max(8, available - width - 8);
      let left: number;
      let top: number;
      if (prefer === 'bottom') {
        // Horizontal toolbox: below the button and clamped horizontally, so siblings stay visible
        left = Math.min(Math.max(8, rect.left), maxLeft);
        top = rect.bottom + 8;
      } else {
        // Vertical toolbox: right of the button, flipping to the left when there's no room
        left = rect.right + 8;
        if (left > maxLeft) left = Math.max(8, rect.left - width - 8);
        top = rect.top;
      }
      top = Math.min(Math.max(8, top), Math.max(8, window.innerHeight - height - 8));
      setPosition((prev) =>
        prev && prev.top === top && prev.left === left ? prev : { top, left },
      );
    };
    place();
    // Size is unknown on the first frame: correct it next frame, hidden until the position is ready
    const raf = requestAnimationFrame(place);

    const onPointerDown = (event: MouseEvent) => {
      const target = event.target as Node;
      if (panelRef.current?.contains(target)) return;
      // The anchor button owns "click again to close"; closing here would let it reopen immediately
      if (anchor.contains(target)) return;
      onClose();
    };
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') onClose();
    };
    document.addEventListener('mousedown', onPointerDown);
    document.addEventListener('keydown', onKeyDown);
    window.addEventListener('resize', place);
    // Scrolling invalidates fixed coordinates, so closing beats leaving a misplaced menu
    window.addEventListener('scroll', onClose, true);
    return () => {
      cancelAnimationFrame(raf);
      document.removeEventListener('mousedown', onPointerDown);
      document.removeEventListener('keydown', onKeyDown);
      window.removeEventListener('resize', place);
      window.removeEventListener('scroll', onClose, true);
    };
  }, [anchor, onClose, prefer]);

  // The panel is hidden on the first frame (no position yet) and focus() does nothing; wait for layout
  useEffect(() => {
    if (!position) return;
    activeRef.current?.focus({ preventScroll: true });
  }, [position]);

  /** ↑↓ / Home / End move focus between options (standard menu keyboard behavior) */
  const handleKeyDown = (event: ReactKeyboardEvent<HTMLDivElement>) => {
    const keys = ['ArrowDown', 'ArrowUp', 'Home', 'End'];
    if (!keys.includes(event.key)) return;
    const buttons = Array.from(
      panelRef.current?.querySelectorAll<HTMLButtonElement>('[data-tool]') ?? [],
    );
    if (buttons.length === 0) return;
    event.preventDefault();
    const index = buttons.findIndex((button) => button === document.activeElement);
    const next =
      event.key === 'Home'
        ? 0
        : event.key === 'End'
          ? buttons.length - 1
          : event.key === 'ArrowDown'
            ? (index + 1 + buttons.length) % buttons.length
            : (index - 1 + buttons.length) % buttons.length;
    buttons[next].focus();
  };

  return createPortal(
    <div
      ref={panelRef}
      role="menu"
      data-testid="photo-tool-flyout"
      aria-label={label}
      onKeyDown={handleKeyDown}
      style={{
        position: 'fixed',
        top: position?.top ?? 0,
        left: position?.left ?? 0,
        // Stay hidden until the position is known (the layout effect applies it before paint)
        visibility: position ? 'visible' : 'hidden',
        maxHeight: 'calc(100vh - 1rem)',
      }}
      className="z-[60] min-w-40 overflow-y-auto rounded-md border border-gray-200 bg-white p-1 shadow-lg dark:border-gray-700 dark:bg-gray-900"
    >
      {items.map((item) => {
        const active = item.id === activeId;
        return (
          <button
            key={item.id}
            ref={active ? activeRef : undefined}
            type="button"
            role="menuitem"
            data-tool={item.id}
            aria-label={item.label}
            onClick={() => {
              onPick(item.id);
              onClose();
            }}
            className={`flex w-full items-center gap-2 rounded px-2 py-1.5 text-left text-[12px] outline-none transition-colors ${
              active
                ? 'bg-blue-50 text-blue-700 dark:bg-blue-950 dark:text-blue-300'
                : 'text-gray-700 hover:bg-gray-100 focus-visible:bg-gray-100 dark:text-gray-200 dark:hover:bg-gray-800 dark:focus-visible:bg-gray-800'
            }`}
          >
            <Icon name={item.icon} className="h-4 w-4 shrink-0" />
            <span className="truncate">{item.label}</span>
            {item.shortcut ? (
              <span className="ml-auto shrink-0 font-mono text-[10px] text-gray-400 dark:text-gray-500">
                {item.shortcut}
              </span>
            ) : null}
          </button>
        );
      })}
    </div>,
    document.body,
  );
}
