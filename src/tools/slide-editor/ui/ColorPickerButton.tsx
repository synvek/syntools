import { useId, type ReactNode } from 'react';
import { useTranslation } from 'react-i18next';
import { MenuButton } from './MenuButton';

/**
 * Toolbar color palette (counterpart of PowerPoint's "font color / shape fill / shape outline" dropdowns).
 *
 * Why it's needed: `input[type=color]` in the property panel only opens the system picker, so landing on a
 * common color takes three clicks; the "theme + standard colors" grid is the handiest entry point for frequent use.
 *
 * The panel content is a fixed structure (theme row / standard row / optional clear action / custom picker),
 * so it reuses MenuButton's `panel` mode directly, keeping positioning and closing behavior consistent.
 */

/** Standard colors (Office's compact 10 × 2 palette) */
const STANDARD_COLORS = [
  '#000000',
  '#404040',
  '#808080',
  '#BFBFBF',
  '#FFFFFF',
  '#C00000',
  '#FF0000',
  '#FFC000',
  '#FFFF00',
  '#92D050',
  '#00B050',
  '#00B0F0',
  '#0070C0',
  '#002060',
  '#7030A0',
];

const SWATCH =
  'h-5 w-5 rounded border border-black/10 transition-transform hover:scale-110 dark:border-white/20';

function SwatchGrid({
  colors,
  value,
  onPick,
}: {
  colors: string[];
  value?: string;
  onPick: (color: string) => void;
}) {
  return (
    <div className="grid grid-cols-5 gap-1">
      {colors.map((color) => {
        const active = value?.toLowerCase() === color.toLowerCase();
        return (
          <button
            key={color}
            type="button"
            title={color}
            aria-label={color}
            aria-pressed={active}
            onClick={() => onPick(color)}
            style={{ backgroundColor: color }}
            className={`${SWATCH} ${active ? 'ring-2 ring-blue-500' : ''}`}
          />
        );
      })}
    </div>
  );
}

export function ColorPickerButton({
  label,
  value,
  onChange,
  onClear,
  clearLabel,
  /** Theme palette (usually the document theme's 12 colors) */
  themeColors,
  disabled,
  /** Leading icon in the trigger (font color / fill / outline each use their own glyph) */
  glyph,
  extra,
}: {
  label: string;
  value?: string;
  onChange: (color: string) => void;
  /** When provided, adds a "no fill / no color" button at the bottom of the panel */
  onClear?: () => void;
  clearLabel?: string;
  themeColors?: string[];
  disabled?: boolean;
  glyph?: ReactNode;
  /** Extra parameter row at the bottom of the panel (e.g. outline "weight", like PowerPoint's shape outline dropdown) */
  extra?: ReactNode;
}) {
  const { t } = useTranslation();
  const customInputId = useId();
  const current = value ?? '#000000';
  /**
   * The trigger follows PowerPoint's compact form: icon plus a color bar underneath, rather than
   * "icon + separate swatch + arrow" — the latter costs ~12px more per control, and four color controls
   * would push the "format" row onto a second line. When there is no color (e.g. no highlight set),
   * the bar is drawn as a hatch to signal "none".
   */
  const triggerContent = (
    <span className="flex flex-col items-center leading-none">
      {glyph}
      <span
        aria-hidden="true"
        style={value ? { backgroundColor: value } : undefined}
        className={`mt-[2px] h-[3px] w-4 rounded-sm ${
          value ? '' : 'bg-[repeating-linear-gradient(90deg,#d1d5db_0_2px,transparent_2px_4px)]'
        }`}
      />
    </span>
  );

  const panel = (close: () => void) => (
    <div className="flex flex-col gap-2 p-2">
      {themeColors && themeColors.length > 0 ? (
        <div className="flex flex-col gap-1">
          <span className="text-[10px] uppercase tracking-wide text-gray-400">
            {t('tools.slide.themeColors')}
          </span>
          {/* Close right after picking, matching PowerPoint's font color / shape fill */}
          <SwatchGrid
            colors={themeColors}
            value={value}
            onPick={(color) => {
              onChange(color);
              close();
            }}
          />
        </div>
      ) : null}

      <div className="flex flex-col gap-1">
        <span className="text-[10px] uppercase tracking-wide text-gray-400">
          {t('tools.slide.standardColors')}
        </span>
        <SwatchGrid
          colors={STANDARD_COLORS}
          value={value}
          onPick={(color) => {
            onChange(color);
            close();
          }}
        />
      </div>

      <div className="flex items-center gap-2 border-t border-gray-200 pt-2 dark:border-gray-700">
        {/*
          自定义取色沿用原生 input[type=color]。原生取色器本身是一个弹窗，
          这里保持面板不关闭，否则用户刚在系统取色器里拖完滑块面板就消失了。
        */}
        <input
          id={customInputId}
          type="color"
          aria-label={t('tools.slide.customColor')}
          value={/^#[0-9a-fA-F]{6}$/.test(current) ? current : '#000000'}
          onChange={(event) => onChange(event.target.value)}
          className="h-6 w-8 cursor-pointer rounded border border-gray-300 bg-transparent dark:border-gray-600"
        />
        <label
          htmlFor={customInputId}
          className="cursor-pointer text-[11px] text-gray-500 dark:text-gray-400"
        >
          {t('tools.slide.customColor')}
        </label>
        {onClear ? (
          <button
            type="button"
            onClick={() => {
              onClear();
              close();
            }}
            className="ml-auto h-6 rounded border border-gray-300 px-2 text-[11px] text-gray-600 transition-colors hover:bg-gray-100 dark:border-gray-600 dark:text-gray-300 dark:hover:bg-gray-800"
          >
            {clearLabel ?? t('tools.slide.noFill')}
          </button>
        ) : null}
      </div>

      {extra ? (
        <div className="border-t border-gray-200 pt-2 dark:border-gray-700">{extra}</div>
      ) : null}
    </div>
  );

  return (
    <MenuButton
      label={label}
      panel={panel}
      panelClassName="w-[168px]"
      triggerContent={triggerContent}
      size="md"
      disabled={disabled}
    />
  );
}
