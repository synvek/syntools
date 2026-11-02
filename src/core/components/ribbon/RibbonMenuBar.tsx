import { useEffect, useRef, useState } from 'react';
import type { EditorMenu } from '../editorChrome';
import { EditorMenuEntryView } from '../EditorMenuBar';
import { RIBBON_ICON_BUTTON } from './ribbonTheme';
import { RibbonIcon } from './ribbonIcons';

/**
 * Menu id → glyph. Editors name their menus by role (`file` / `edit` / `insert` / `view` / `arrange`),
 * so the icon table can stay here instead of being repeated in three command registries.
 */
const MENU_ICONS: Record<string, string> = {
  file: 'file',
  edit: 'pen',
  insert: 'insert',
  view: 'eye',
  arrange: 'layers',
  format: 'caseConvert',
  slide: 'slides',
};

/**
 * File / edit / insert … menus as icon dropdowns, sitting at the left end of the ribbon's tab strip.
 *
 * Same data as the old `EditorMenuBar` (`EditorMenu[]`) and the same test ids (`menubar-<id>`), so the
 * editors keep exactly one definition of their menu commands. Interaction follows `EditorMenuBar`:
 * outside click / Esc closes, hovering another entry switches while open.
 */
export function RibbonMenuBar({ menus, ariaLabel }: { menus: EditorMenu[]; ariaLabel: string }) {
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
    <div
      ref={rootRef}
      role="group"
      aria-label={ariaLabel}
      className="flex shrink-0 items-center gap-0.5"
    >
      {menus.map((menu) => {
        const open = openId === menu.id;
        return (
          <div key={menu.id} className="relative">
            <button
              type="button"
              aria-haspopup="menu"
              aria-expanded={open}
              aria-label={menu.label}
              title={menu.label}
              data-testid={`menubar-${menu.id}`}
              onClick={() => setOpenId(open ? null : menu.id)}
              onMouseEnter={() => {
                if (openId) setOpenId(menu.id);
              }}
              className={`${RIBBON_ICON_BUTTON} w-auto gap-0.5 px-1 ${
                open ? 'bg-black/[0.08] dark:bg-white/15' : ''
              }`}
            >
              <RibbonIcon name={MENU_ICONS[menu.id] ?? 'menu'} className="h-3.5 w-3.5" />
              <RibbonIcon name="chevron" className="h-2 w-2 opacity-60" />
            </button>
            {open ? (
              <div
                role="menu"
                aria-label={menu.label}
                className="absolute left-0 top-full z-50 mt-0.5 flex max-h-[70vh] min-w-[200px] flex-col overflow-y-auto rounded-lg border border-gray-200 bg-white p-1 shadow-xl dark:border-[#3a3a3a] dark:bg-[#252525]"
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
  );
}
