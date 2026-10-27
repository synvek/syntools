import { useEffect, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';

/**
 * Text color picker popover.
 *
 * Why not a bare `<input type="color">`: in Tauri (WKWebView / WebView2) the native picker opens the
 * system palette and **does not close** after picking, forcing users to close the window every time.
 * So this uses "preset swatches + close on pick": clicking a swatch applies and closes, as do outside clicks / Esc.
 * For exact colors the native picker stays as a fallback (it does not auto-close, so the panel survives slider dragging).
 */

/** Common text colors: one grayscale row for body/secondary text, one color row for emphasis, warning, and links */
const TEXT_COLORS = [
  '#000000',
  '#404040',
  '#737373',
  '#A3A3A3',
  '#D4D4D4',
  '#FFFFFF',
  '#C00000',
  '#E11D48',
  '#EA580C',
  '#D97706',
  '#16A34A',
  '#0D9488',
  '#0284C7',
  '#2563EB',
  '#4F46E5',
  '#7C3AED',
];

const SWATCH =
  'h-5 w-5 rounded border border-black/10 transition-transform hover:scale-110 dark:border-white/20';

interface TextColorPickerProps {
  /** Current text color (already a selectable #rrggbb) */
  value: string;
  onPick: (color: string) => void;
  /** "Default color": clears the explicit text color and returns to the body default */
  onReset: () => void;
}

export function TextColorPicker({ value, onPick, onReset }: TextColorPickerProps) {
  const { t } = useTranslation();
  const [open, setOpen] = useState(false);
  const rootRef = useRef<HTMLSpanElement>(null);
  const selected = value.toLowerCase();

  // Listen only while open: outside press or Esc closes it, consistent with the canvas / slides color popovers
  useEffect(() => {
    if (!open) return;
    const onPointerDown = (event: MouseEvent) => {
      if (rootRef.current && !rootRef.current.contains(event.target as Node)) setOpen(false);
    };
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') setOpen(false);
    };
    document.addEventListener('mousedown', onPointerDown);
    document.addEventListener('keydown', onKeyDown);
    return () => {
      document.removeEventListener('mousedown', onPointerDown);
      document.removeEventListener('keydown', onKeyDown);
    };
  }, [open]);

  const pick = (color: string) => {
    onPick(color);
    setOpen(false);
  };

  return (
    <span ref={rootRef} className="relative flex items-center">
      <button
        type="button"
        title={t('tools.richText.color')}
        aria-label={t('tools.richText.color')}
        aria-haspopup="dialog"
        aria-expanded={open}
        onClick={() => setOpen((prev) => !prev)}
        className={`flex h-8 w-8 items-center justify-center rounded-md border text-xs transition-colors ${
          open
            ? 'border-blue-600 bg-blue-600 text-white'
            : 'border-transparent text-gray-600 hover:bg-gray-100 dark:text-gray-300 dark:hover:bg-gray-800'
        }`}
      >
        <span aria-hidden="true" className="flex w-4 flex-col items-center">
          <span className="text-sm font-semibold leading-none">A</span>
          <span
            className="mt-[2px] h-[3px] w-4 rounded-full border border-black/10"
            style={{ backgroundColor: value }}
          />
        </span>
      </button>

      {open ? (
        <div
          role="dialog"
          aria-label={t('tools.richText.color')}
          data-testid="rich-text-color-panel"
          className="absolute left-0 top-full z-20 mt-1 w-max rounded-lg border border-gray-200 bg-white p-2 shadow-lg dark:border-gray-700 dark:bg-gray-900"
        >
          <div className="grid grid-cols-8 gap-1">
            {TEXT_COLORS.map((color) => {
              const active = selected === color.toLowerCase();
              return (
                <button
                  key={color}
                  type="button"
                  title={color}
                  aria-label={color}
                  aria-pressed={active}
                  onClick={() => pick(color)}
                  style={{ backgroundColor: color }}
                  className={`${SWATCH} ${active ? 'ring-2 ring-blue-500' : ''}`}
                />
              );
            })}
          </div>

          <div className="mt-2 flex items-center gap-2 border-t border-gray-100 pt-2 dark:border-gray-800">
            <button
              type="button"
              onClick={() => {
                onReset();
                setOpen(false);
              }}
              className="h-6 rounded border border-gray-300 px-2 text-[11px] text-gray-600 transition-colors hover:bg-gray-100 dark:border-gray-600 dark:text-gray-300 dark:hover:bg-gray-800"
            >
              {t('tools.richText.colorDefault')}
            </button>
            <label className="ml-auto flex cursor-pointer items-center gap-1.5 text-[11px] text-gray-500 dark:text-gray-400">
              <input
                type="color"
                aria-label={t('tools.richText.customColor')}
                value={value}
                onChange={(event) => onPick(event.target.value)}
                className="h-6 w-8 cursor-pointer rounded border border-gray-300 bg-transparent p-0 dark:border-gray-600"
              />
              {t('tools.richText.customColor')}
            </label>
          </div>
        </div>
      ) : null}
    </span>
  );
}
