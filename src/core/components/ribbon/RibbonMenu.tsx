import { useEffect, useRef } from 'react';
import type { RibbonMenuItem } from './types';
import { RibbonIcon } from './ribbonIcons';
import { Z_PANEL } from './ribbonTheme';

/**
 * Dropdown panel of the ribbon.
 *
 * Interaction follows `EditorMenuBar` (outside click / Esc close, desktop hover switching is handled by
 * the parent): one open panel at a time, items are `role="menuitem"` so they never collide with the
 * canvas buttons Playwright finds through `getByRole('button')`.
 */
export function RibbonMenu({
  items,
  ariaLabel,
  onClose,
  align = 'left',
}: {
  items: RibbonMenuItem[];
  ariaLabel: string;
  onClose: () => void;
  align?: 'left' | 'right';
}) {
  const ref = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    const onPointerDown = (event: PointerEvent) => {
      if (ref.current?.contains(event.target as Node)) return;
      onClose();
    };
    const onKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape') onClose();
    };
    window.addEventListener('pointerdown', onPointerDown);
    window.addEventListener('keydown', onKey);
    return () => {
      window.removeEventListener('pointerdown', onPointerDown);
      window.removeEventListener('keydown', onKey);
    };
  }, [onClose]);

  return (
    <div
      ref={ref}
      role="menu"
      aria-label={ariaLabel}
      className={`absolute top-full ${Z_PANEL} mt-0.5 flex max-h-[60vh] min-w-[180px] flex-col overflow-y-auto rounded-md border border-gray-200 bg-white p-1 shadow-xl dark:border-[#3a3a3a] dark:bg-[#252525] ${
        align === 'right' ? 'right-0' : 'left-0'
      }`}
    >
      {items.map((item) => (
        <button
          key={item.id}
          type="button"
          role="menuitem"
          disabled={item.disabled}
          aria-label={item.label}
          aria-haspopup={item.control ? 'dialog' : undefined}
          data-ribbon-control={item.control ? 'true' : undefined}
          onClick={() => {
            onClose();
            item.onSelect();
          }}
          className={`flex h-7 items-center gap-2 rounded px-2 text-left text-[12px] transition-colors disabled:cursor-not-allowed disabled:opacity-40 ${
            item.danger
              ? 'text-red-600 hover:bg-red-50 dark:text-red-400 dark:hover:bg-red-950/50'
              : 'text-gray-700 hover:bg-black/[0.05] dark:text-[#e8e8e8] dark:hover:bg-white/10'
          }`}
        >
          <span className="flex h-4 w-4 shrink-0 items-center justify-center">
            {item.checked ? <RibbonIcon name="check" className="h-3.5 w-3.5" /> : null}
          </span>
          {item.icon ? <RibbonIcon name={item.icon} className="h-4 w-4 shrink-0" /> : null}
          <span className="min-w-0 flex-1 truncate">{item.label}</span>
        </button>
      ))}
    </div>
  );
}
