import { useEffect, useRef } from 'react';
import { useTranslation } from 'react-i18next';
import { Z_PANEL } from '@/core/components/ribbon/ribbonTheme';
import { modifierShortcut } from '@/core/components/editorChrome';
import { useModalBehavior } from '@/core/hooks/useOverlayStack';

/**
 * Keyboard shortcut help (implementation plan P0-4.5).
 *
 * The labels come from the nine-language incremental block, while the modifier glyph is resolved
 * at render time by `modifierShortcut()` so macOS and Windows/Linux never see a wrong hint.
 * `useModalBehavior` puts the dialog on the shared dismiss stack: Escape closes only this layer,
 * Tab stays inside, and focus returns to the ⋯ menu item that opened it.
 */
const GROUPS = [
  {
    title: 'shortcutGroupEditing',
    rows: [
      { label: 'shortcutSelectAll', combo: () => modifierShortcut('A') },
      { label: 'shortcutBold', combo: () => modifierShortcut('B') },
      { label: 'shortcutItalic', combo: () => modifierShortcut('I') },
      { label: 'shortcutUnderline', combo: () => modifierShortcut('U') },
      { label: 'shortcutFind', combo: () => modifierShortcut('F') },
    ],
  },
  {
    title: 'shortcutGroupFile',
    rows: [
      { label: 'shortcutSave', combo: () => modifierShortcut('S') },
      { label: 'shortcutPrint', combo: () => modifierShortcut('P') },
      { label: 'shortcutNew', combo: () => modifierShortcut('N') },
    ],
  },
  {
    title: 'shortcutGroupOverlay',
    rows: [
      { label: 'shortcutContextMenu', combo: () => 'Shift+F10 / ContextMenu' },
      { label: 'shortcutCloseOverlay', combo: () => 'Esc' },
    ],
  },
] as const;

export function ShortcutHelpDialog({ open, onClose }: { open: boolean; onClose: () => void }) {
  const { t } = useTranslation();
  const closeRef = useRef<HTMLButtonElement | null>(null);
  useModalBehavior(open, onClose);

  useEffect(() => {
    if (open) closeRef.current?.focus();
  }, [open]);

  if (!open) return null;

  return (
    <div
      className={`fixed inset-0 ${Z_PANEL} flex items-center justify-center bg-black/40 p-4`}
      role="presentation"
      onClick={onClose}
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="rte-shortcut-help-title"
        aria-describedby="rte-shortcut-help-desc"
        data-testid="rich-text-shortcut-help"
        className="max-h-[85vh] w-full max-w-lg overflow-y-auto rounded-xl border border-gray-200 bg-white p-4 shadow-xl dark:border-gray-700 dark:bg-gray-900"
        onClick={(event) => event.stopPropagation()}
      >
        <h2
          id="rte-shortcut-help-title"
          className="text-base font-semibold text-gray-900 dark:text-gray-100"
        >
          {t('tools.richText.shortcutHelp')}
        </h2>
        <p id="rte-shortcut-help-desc" className="mt-1 text-sm text-gray-500 dark:text-gray-400">
          {t('tools.richText.shortcutHelpDesc')}
        </p>

        <div className="mt-4 grid gap-4 sm:grid-cols-2">
          {GROUPS.map((group) => (
            <section key={group.title}>
              <h3 className="mb-1 text-xs font-semibold uppercase tracking-wide text-gray-500 dark:text-gray-400">
                {t(`tools.richText.${group.title}`)}
              </h3>
              <ul className="flex flex-col gap-1">
                {group.rows.map((row) => (
                  <li
                    key={row.label}
                    className="flex items-center justify-between gap-3 text-[13px] text-gray-700 dark:text-gray-200"
                  >
                    <span>{t(`tools.richText.${row.label}`)}</span>
                    <kbd className="shrink-0 rounded border border-gray-300 bg-gray-50 px-1.5 py-0.5 font-mono text-[11px] text-gray-600 dark:border-gray-600 dark:bg-gray-800 dark:text-gray-300">
                      {row.combo()}
                    </kbd>
                  </li>
                ))}
              </ul>
            </section>
          ))}
        </div>

        <div className="mt-4 flex justify-end">
          <button
            ref={closeRef}
            type="button"
            onClick={onClose}
            className="rounded-md border border-gray-300 px-3 py-1.5 text-xs text-gray-700 hover:bg-gray-100 dark:border-gray-600 dark:text-gray-200 dark:hover:bg-gray-800"
          >
            {t('tools.richText.shortcutHelpClose')}
          </button>
        </div>
      </div>
    </div>
  );
}
