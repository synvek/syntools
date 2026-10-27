import { useEffect, useRef, useState } from 'react';
import type { ReactNode } from 'react';
import type { MenuBarMenu, MenuEntry } from './menuModel';

/**
 * Top menu bar: gathers features scattered around the app into a single "feature map".
 *
 * Layout (left → right): menu area → actions (next to the menus, e.g. save status / clear) → center (canvas title)
 * → right (icon buttons such as new / present). center uses flex-1 so the title sits equidistant from both sides.
 *
 * Interaction conventions:
 * - Top-level entries use `role="menuitem"` (not button) so they do not collide with same-named buttons in the
 *   canvas / panels in Playwright's `getByRole('button', ...)` selectors; dropdowns use `role="menu"` and render only when open.
 * - Once open, hovering another top-level entry switches menus (desktop-like).
 * - Clicking outside / pressing Esc closes it.
 */
export function MenuBar({
  menus,
  ariaLabel,
  actions,
  center,
  right,
}: {
  menus: MenuBarMenu[];
  ariaLabel: string;
  /** Actions to the right of the menu area, right after the last menu */
  actions?: ReactNode;
  /** Center slot: the canvas title input */
  center?: ReactNode;
  /** Right-hand actions: icon buttons such as new / present */
  right?: ReactNode;
}) {
  const [openId, setOpenId] = useState<string | null>(null);
  const rootRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    if (!openId) return;
    const onPointerDown = (event: PointerEvent) => {
      if (rootRef.current?.contains(event.target as Node)) return;
      setOpenId(null);
    };
    const onKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape') setOpenId(null);
    };
    window.addEventListener('pointerdown', onPointerDown);
    window.addEventListener('keydown', onKey);
    return () => {
      window.removeEventListener('pointerdown', onPointerDown);
      window.removeEventListener('keydown', onKey);
    };
  }, [openId]);

  return (
    <div className="flex flex-wrap items-center gap-2 rounded-xl border border-gray-200 bg-white px-2 py-1 shadow-sm dark:border-gray-800 dark:bg-gray-900">
      <div
        ref={rootRef}
        role="menubar"
        aria-label={ariaLabel}
        className="flex shrink-0 flex-wrap items-center gap-0.5"
      >
        {menus.map((menu) => {
          const open = openId === menu.id;
          return (
            <div key={menu.id} className="relative">
              <button
                type="button"
                role="menuitem"
                aria-haspopup="menu"
                aria-expanded={open}
                data-testid={`menubar-${menu.id}`}
                onClick={() => setOpenId(open ? null : menu.id)}
                onMouseEnter={() => {
                  if (openId) setOpenId(menu.id);
                }}
                className={`rounded-md px-2 py-1 text-xs transition-colors ${
                  open
                    ? 'bg-blue-600 text-white'
                    : 'text-gray-600 hover:bg-gray-100 dark:text-gray-300 dark:hover:bg-gray-800'
                }`}
              >
                {menu.label}
              </button>
              {open ? (
                <div
                  role="menu"
                  aria-label={menu.label}
                  className="absolute left-0 top-full z-40 mt-0.5 flex min-w-[200px] flex-col rounded-lg border border-gray-200 bg-white p-1 shadow-xl dark:border-gray-700 dark:bg-gray-900"
                >
                  {menu.entries.map((entry, index) => (
                    <MenuEntryView
                      key={entry.type === 'item' ? entry.id : `separator-${index}`}
                      entry={entry}
                      onClose={() => setOpenId(null)}
                    />
                  ))}
                </div>
              ) : null}
            </div>
          );
        })}
      </div>

      {actions ? <div className="flex shrink-0 items-center gap-0.5">{actions}</div> : null}

      {center ? (
        <div className="flex min-w-0 flex-1 items-center justify-center px-2">{center}</div>
      ) : null}

      {right ? <div className="flex shrink-0 items-center gap-0.5">{right}</div> : null}
    </div>
  );
}

function MenuEntryView({ entry, onClose }: { entry: MenuEntry; onClose: () => void }) {
  if (entry.type === 'separator') {
    return <div role="separator" className="my-1 h-px bg-gray-200 dark:bg-gray-700" />;
  }
  return (
    <button
      type="button"
      role="menuitem"
      disabled={entry.disabled}
      onClick={() => {
        onClose();
        entry.onSelect();
      }}
      className={`flex h-8 items-center gap-3 rounded-md px-2 text-left text-xs transition-colors disabled:cursor-not-allowed disabled:opacity-40 ${
        entry.danger
          ? 'text-red-600 hover:bg-red-50 dark:text-red-400 dark:hover:bg-red-950'
          : 'text-gray-700 hover:bg-gray-100 dark:text-gray-200 dark:hover:bg-gray-800'
      }`}
    >
      <span className="min-w-0 flex-1 truncate">{entry.label}</span>
      {entry.shortcut ? (
        <span className="shrink-0 font-mono text-[10px] text-gray-400 dark:text-gray-500">
          {entry.shortcut}
        </span>
      ) : null}
    </button>
  );
}
