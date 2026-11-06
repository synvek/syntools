import { useEffect, useRef, useState } from 'react';
import type { RibbonAccent, RibbonItemSize } from './types';
import { RIBBON_ACCENT, RIBBON_BTN_IDLE, RIBBON_COLOR_SWATCHES, Z_PANEL } from './ribbonTheme';
import { RibbonIcon } from './ribbonIcons';

const SWATCH =
  'h-5 w-5 rounded border border-black/10 transition-transform hover:scale-110 dark:border-white/20';

type Size = NonNullable<RibbonItemSize>;

const TRIGGER: Record<Size, string> = {
  large: 'h-14 w-[3.25rem] flex-col gap-1 px-0.5 text-[11px] leading-[1.1]',
  small: 'h-6 min-w-6 px-1',
};

/**
 * Ribbon color button: preset swatches plus a native picker as fallback.
 *
 * Same reasoning as the word processor's `TextColorPicker`: in Tauri (WKWebView / WebView2) the native
 * palette does not close after picking, so the swatch panel closes itself on pick while the native
 * input stays available for exact colors.
 */
export function RibbonColorPicker({
  label,
  icon,
  size = 'large',
  value,
  accent,
  disabled = false,
  hint,
  onPick,
  onReset,
  resetLabel,
  testId,
}: {
  label: string;
  icon?: string;
  size?: RibbonItemSize;
  value: string | null;
  accent: RibbonAccent;
  disabled?: boolean;
  hint?: string;
  onPick: (color: string) => void;
  onReset?: () => void;
  resetLabel?: string;
  testId?: string;
}) {
  const [open, setOpen] = useState(false);
  const rootRef = useRef<HTMLDivElement | null>(null);
  const large = size === 'large';

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
    <div ref={rootRef} className="relative flex shrink-0 items-stretch">
      <button
        type="button"
        data-testid={testId}
        title={hint ?? label}
        aria-label={label}
        aria-haspopup="dialog"
        aria-expanded={open}
        disabled={disabled}
        onClick={() => setOpen((value_) => !value_)}
        className={`inline-flex items-center justify-center rounded border border-transparent transition-colors disabled:cursor-not-allowed disabled:opacity-40 ${TRIGGER[large ? 'large' : 'small']} ${RIBBON_BTN_IDLE}`}
      >
        <RibbonIcon name={icon ?? 'fontColor'} className={large ? 'h-5 w-5' : 'h-4 w-4'} />
        {large ? (
          <span className="max-h-[1.9rem] overflow-hidden text-center leading-[1.15]">{label}</span>
        ) : null}
        {/* Color bar: the "current color" preview every Office color button carries */}
        <span
          aria-hidden="true"
          className="block h-[3px] w-6 rounded-sm border border-black/10 dark:border-white/20"
          style={{ backgroundColor: value ?? 'transparent' }}
        />
      </button>
      {open ? (
        <div
          role="dialog"
          aria-label={label}
          data-testid={testId ? `${testId}-panel` : undefined}
          className={`absolute left-0 top-full ${Z_PANEL} mt-0.5 w-[11.5rem] rounded-md border border-gray-200 bg-white p-1.5 shadow-xl dark:border-[#3a3a3a] dark:bg-[#252525]`}
        >
          <div className="grid grid-cols-6 gap-1">
            {RIBBON_COLOR_SWATCHES.map((color) => (
              <button
                key={color}
                type="button"
                title={color}
                aria-label={color}
                onClick={() => {
                  setOpen(false);
                  onPick(color);
                }}
                className={`${SWATCH} ${value?.toLowerCase() === color.toLowerCase() ? RIBBON_ACCENT[accent].toggle : ''}`}
                style={{ backgroundColor: color }}
              />
            ))}
          </div>
          <div className="mt-1.5 flex items-center gap-1.5 border-t border-gray-200 pt-1.5 dark:border-[#3a3a3a]">
            <input
              type="color"
              aria-label={`${label} — ${resetLabel ?? ''}`.trim()}
              value={value ?? '#000000'}
              onChange={(event) => onPick(event.target.value)}
              className="h-6 w-8 cursor-pointer rounded border border-gray-300 bg-transparent dark:border-[#4a4a4a]"
            />
            {onReset ? (
              <button
                type="button"
                onClick={() => {
                  setOpen(false);
                  onReset();
                }}
                className="flex h-6 flex-1 items-center justify-center rounded px-2 text-[11px] text-gray-600 hover:bg-black/[0.05] dark:text-[#c8c8c8] dark:hover:bg-white/10"
              >
                {resetLabel ?? '×'}
              </button>
            ) : null}
          </div>
        </div>
      ) : null}
    </div>
  );
}
