import { useEffect, useRef, useState } from 'react';
import type { ReactNode } from 'react';
import type { EditorMenu, EditorMenuEntry } from './editorChrome';

/**
 * Shared "menu toolbar" for document editors.
 *
 * Layout, left to right: menus → actions (next to the menus: save state, clear) → center (title)
 * → right (icon buttons: new, present). center uses flex-1 so its gaps to both sides match.
 *
 * Interaction conventions:
 * - Top-level entries use `role="menuitem"` (not button) so they never collide with same-named
 *   buttons on the canvas or panels in Playwright's `getByRole('button', ...)`; panels use `role="menu"` and mount only when open.
 * - Once open, hovering another top-level entry switches menus (desktop-style).
 * - Closes on outside click / Esc.
 */
export function EditorMenuBar({
  menus,
  ariaLabel,
  actions,
  center,
  right,
}: {
  menus: EditorMenu[];
  ariaLabel: string;
  /** Actions right of the menus, next to the last one */
  actions?: ReactNode;
  /** Center slot: document title input */
  center?: ReactNode;
  /** Right slot: icon buttons for new / present, etc. */
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
                  className="absolute left-0 top-full z-40 mt-0.5 flex max-h-[70vh] min-w-[200px] flex-col overflow-y-auto rounded-lg border border-gray-200 bg-white p-1 shadow-xl dark:border-gray-700 dark:bg-gray-900"
                >
                  {menu.entries.map((entry, index) => (
                    <EditorMenuEntryView
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

function EditorMenuEntryView({ entry, onClose }: { entry: EditorMenuEntry; onClose: () => void }) {
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
