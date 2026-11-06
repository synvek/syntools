import { useEffect, useRef, useState } from 'react';
import type { EditorMenu } from '../editorChrome';
import { EditorMenuEntryView } from '../EditorMenuBar';
import { RIBBON_ICON_BUTTON, Z_PANEL } from './ribbonTheme';
import { RibbonIcon } from './ribbonIcons';

/**
 * The single "more" (⋯) dropdown of an editor's ribbon.
 *
 * Deliberately **not** a menu bar: the ribbon already owns every formatting / insert / view command,
 * so a second full menu bar meant two paths to the same action and two places to keep in sync. The
 * editors now pass one menu holding only the commands with no ribbon counterpart (import / export /
 * print / a few insert-time actions), and it opens from one three-dot button.
 *
 * Interaction is the old one (`EditorMenuBar`): outside pointer-down or Esc closes it, entries close it
 * after running.
 */
export function RibbonMoreMenu({ menu }: { menu: EditorMenu }) {
  const [open, setOpen] = useState(false);
  const rootRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    if (!open) return;
    const onPointerDown = (event: PointerEvent) => {
      if (rootRef.current?.contains(event.target as Node)) return;
      setOpen(false);
    };
    const onKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape') setOpen(false);
    };
    window.addEventListener('pointerdown', onPointerDown);
    window.addEventListener('keydown', onKey);
    return () => {
      window.removeEventListener('pointerdown', onPointerDown);
      window.removeEventListener('keydown', onKey);
    };
  }, [open]);

  return (
    <div ref={rootRef} className="relative">
      <button
        type="button"
        aria-haspopup="menu"
        aria-expanded={open}
        aria-label={menu.label}
        title={menu.label}
        data-testid={`menubar-${menu.id}`}
        onClick={() => setOpen((value) => !value)}
        className={`${RIBBON_ICON_BUTTON} ${open ? 'bg-black/[0.08] dark:bg-white/15' : ''}`}
      >
        <RibbonIcon name="more" className="h-3.5 w-3.5" />
      </button>
      {open ? (
        <div
          role="menu"
          aria-label={menu.label}
          className={`absolute left-0 top-full ${Z_PANEL} mt-0.5 flex max-h-[70vh] min-w-[200px] flex-col overflow-y-auto rounded-lg border border-gray-200 bg-white p-1 shadow-xl dark:border-[#3a3a3a] dark:bg-[#252525]`}
        >
          {menu.entries.map((entry, index) => (
            <EditorMenuEntryView
              key={entry.type === 'item' ? entry.id : `separator-${index}`}
              entry={entry}
              onClose={() => setOpen(false)}
            />
          ))}
        </div>
      ) : null}
    </div>
  );
}
