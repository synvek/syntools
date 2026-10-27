import { useLayoutEffect, useRef, useState, type ReactNode } from 'react';
import { createPortal } from 'react-dom';
import { Icon } from '@/core/components/Icon';

/**
 * Generic dropdown button (trigger + panel) in two variants:
 *
 * - `variant="toolbar"` (default): compact editor-toolbar button, icon-first with text in a tooltip.
 *   Rationale: six shapes and six alignments laid out flat would make the toolbar wide and noisy.
 * - `variant="header"`: an "icon + label" button in the document header (`DocumentHeader`'s io slot);
 *   folding import / export into a dropdown keeps them obvious and saves a whole row of buttons.
 *
 * The menu portals to body: every toolbar row and the document header may sit in its own stacking context
 * (backdrop blur, sticky, etc.), where in-place absolute positioning gets covered and swallows clicks.
 */

export interface MenuItem {
  key: string;
  label: string;
  /** Optional leading glyph (e.g. format icon, shape preview) */
  glyph?: ReactNode;
  onClick: () => void;
  disabled?: boolean;
}

export interface MenuButtonProps {
  label: string;
  /** Icon name from the shared Icon set */
  icon?: string;
  /** Custom glyph, takes precedence over icon; for tool-specific icons */
  glyph?: ReactNode;
  items?: MenuItem[];
  /**
   * Custom panel content. Replaces the `items` list when set (for non-menu structures like swatches),
   * with positioning, outside-click and Esc dismissal behaving exactly like a menu.
   *
   * A function receives `close` — clicks inside the panel do not count as "outside",
   * so pick-and-dismiss interactions like swatches must call it themselves.
   */
  panel?: ReactNode | ((close: () => void) => ReactNode);
  /** Custom trigger content (beats icon/glyph/label) for non-text triggers such as color chips */
  triggerContent?: ReactNode;
  disabled?: boolean;
  /** Trigger size (toolbar variant only): match the surrounding row */
  size?: 'sm' | 'md';
  /** Show a text label (toolbar variant): toolbars are icon-first, only category entries show text */
  showLabel?: boolean;
  /** Appearance: compact toolbar button or header "icon + label" button */
  variant?: 'toolbar' | 'header';
  /** Header hierarchy: primary is the filled blue action (export), default the outlined one (import) */
  tone?: 'default' | 'primary';
  className?: string;
  /** Panel container class (swatches need custom padding and width) */
  panelClassName?: string;
  /** Extra trigger class for non-pill shapes (e.g. toolbox corner badge); overrides size and border */
  triggerClassName?: string;
  /** Skip the built-in caret when the trigger already is one */
  hideChevron?: boolean;
}

/**
 * Vertical placement: below the trigger by default, **flipped above when it does not fit**, clamped to the viewport otherwise.
 *
 * Toolbox groups must flip: the last group sits at the workspace bottom and would spill past the viewport edge.
 */
function verticalPlacement(rect: DOMRect, menuHeight: number): number {
  const viewport = window.innerHeight;
  const below = rect.bottom + 4;
  if (menuHeight <= 0) return below;
  if (below + menuHeight <= viewport - 8) return below;
  const above = rect.top - menuHeight - 4;
  if (above >= 8) return above;
  return Math.max(8, viewport - menuHeight - 8);
}

export function MenuButton({
  label,
  icon,
  glyph,
  items = [],
  panel,
  triggerContent,
  disabled,
  size = 'sm',
  showLabel = false,
  variant = 'toolbar',
  tone = 'default',
  className = '',
  panelClassName,
  triggerClassName = '',
  hideChevron = false,
}: MenuButtonProps) {
  const [open, setOpen] = useState(false);
  const [position, setPosition] = useState<{ top: number; left: number } | null>(null);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const menuRef = useRef<HTMLDivElement>(null);

  // Position from the trigger on open (fixed, relative to the viewport not the parent)
  // Use a layout effect to measure before paint, else the menu visibly overflows the trigger's left edge for a frame
  useLayoutEffect(() => {
    if (!open) {
      setPosition(null);
      return;
    }
    const place = () => {
      const trigger = triggerRef.current;
      if (!trigger) return;
      const rect = trigger.getBoundingClientRect();
      // Measure width from documentElement (window.innerWidth includes the scrollbar and would squeeze the panel)
      const available = document.documentElement.clientWidth;
      const width = menuRef.current?.offsetWidth ?? 0;
      const height = menuRef.current?.offsetHeight ?? 0;
      if (width <= 0) {
        // No width on the first frame: park at the trigger's left edge (panel hidden), correct on the next
        setPosition({ top: rect.bottom + 4, left: rect.left });
        return;
      }
      // Header buttons sit right: align to the trigger's right edge and open leftwards, like Office format menus
      const anchor = variant === 'header' ? rect.right - width : rect.left;
      const left = Math.max(8, Math.min(anchor, available - width - 8));
      const top = verticalPlacement(rect, height);
      setPosition((prev) =>
        prev && prev.top === top && prev.left === left ? prev : { top, left },
      );
    };
    place();
    const raf = requestAnimationFrame(place);
    const onPointerDown = (event: MouseEvent) => {
      const target = event.target as Node;
      // The menu lives on body, so clicks in the trigger or menu are not "outside"
      if (triggerRef.current?.contains(target)) return;
      if (menuRef.current?.contains(target)) return;
      setOpen(false);
    };
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') setOpen(false);
    };
    const onScroll = () => setOpen(false);
    document.addEventListener('mousedown', onPointerDown);
    document.addEventListener('keydown', onKeyDown);
    window.addEventListener('resize', place);
    // Scroll or resize invalidates fixed coordinates; closing beats a misaligned menu
    window.addEventListener('scroll', onScroll, true);
    return () => {
      cancelAnimationFrame(raf);
      document.removeEventListener('mousedown', onPointerDown);
      document.removeEventListener('keydown', onKeyDown);
      window.removeEventListener('resize', place);
      window.removeEventListener('scroll', onScroll, true);
    };
  }, [open, variant]);

  const headerTrigger =
    tone === 'primary'
      ? 'h-8 gap-1.5 rounded-md border border-transparent bg-blue-600 px-3 text-sm font-medium text-white hover:bg-blue-700 disabled:opacity-50'
      : 'h-8 gap-1.5 rounded-md border border-gray-300 px-3 text-sm text-gray-700 hover:bg-gray-100 disabled:opacity-50 dark:border-gray-600 dark:text-gray-200 dark:hover:bg-gray-800';

  const toolbarTrigger = `disabled:opacity-40 rounded-md border text-gray-600 hover:bg-gray-100 dark:border-gray-600 dark:text-gray-200 dark:hover:bg-gray-800 ${
    triggerContent ? 'gap-0.5 border-transparent' : 'border-gray-300'
  } ${size === 'md' ? 'h-8 gap-1 px-2 text-[12px]' : 'h-7 gap-1 px-2 text-[11px]'}`;

  const close = () => setOpen(false);

  /** Panel content or items, not both: `panel` wins (for non-menu structures like swatches) */
  const content =
    typeof panel === 'function'
      ? panel(close)
      : (panel ??
        items.map((item) => (
          <button
            key={item.key}
            type="button"
            role="menuitem"
            disabled={item.disabled}
            onClick={() => {
              close();
              item.onClick();
            }}
            className="flex w-full min-w-0 items-center gap-2 rounded px-2 py-1.5 text-left text-[12px] text-gray-700 transition-colors hover:bg-gray-100 disabled:cursor-not-allowed disabled:opacity-40 dark:text-gray-200 dark:hover:bg-gray-800"
          >
            {item.glyph ? <span className="shrink-0">{item.glyph}</span> : null}
            {/* In very narrow windows the panel is capped by the viewport, so drop the text instead of overflowing */}
            <span className="truncate">{item.label}</span>
          </button>
        )));

  return (
    // No `relative` on the wrapper: callers may anchor the trigger elsewhere (e.g. a toolbox badge on the button corner),
    // a hard-coded relative makes it the containing block, and relative vs. the caller's absolute depends on stylesheet order
    <div className={className}>
      <button
        ref={triggerRef}
        type="button"
        title={label}
        aria-label={label}
        aria-haspopup={panel ? 'dialog' : 'menu'}
        aria-expanded={open}
        disabled={disabled}
        onClick={() => setOpen((value) => !value)}
        className={`inline-flex items-center justify-center transition-colors disabled:cursor-not-allowed ${
          variant === 'header' ? headerTrigger : toolbarTrigger
        } ${triggerClassName}`}
      >
        {triggerContent ?? (
          <>
            {glyph ?? (icon ? <Icon name={icon} className="h-4 w-4" /> : null)}
            {showLabel || variant === 'header' ? (
              <span className="whitespace-nowrap">{label}</span>
            ) : null}
          </>
        )}
        {hideChevron ? null : (
          <Icon
            name="chevron"
            className={variant === 'header' ? 'h-3.5 w-3.5 opacity-60' : 'h-3 w-3 opacity-60'}
          />
        )}
      </button>

      {open
        ? createPortal(
            <div
              ref={menuRef}
              role={panel ? 'dialog' : 'menu'}
              aria-label={label}
              style={{
                position: 'fixed',
                top: position?.top ?? 0,
                left: position?.left ?? 0,
                // Hidden until positioned (the layout effect fills it in before paint, so users never see it)
                visibility: position ? 'visible' : 'hidden',
                maxWidth: 'calc(100vw - 1rem)',
                // A panel taller than the viewport (should not happen) scrolls internally instead of spilling offscreen
                maxHeight: 'calc(100vh - 1rem)',
                overflowY: 'auto',
              }}
              className={`z-[60] rounded-md border border-gray-200 bg-white shadow-lg dark:border-gray-700 dark:bg-gray-900 ${
                panelClassName ?? (variant === 'header' ? 'min-w-44 p-1' : 'min-w-max p-1')
              }`}
            >
              {content}
            </div>,
            document.body,
          )
        : null}
    </div>
  );
}
