import type { RibbonAccent, RibbonItemSize } from './types';
import {
  RIBBON_ACCENT,
  RIBBON_BTN_BASE,
  RIBBON_BTN_IDLE,
  RIBBON_BTN_LARGE,
  RIBBON_BTN_SMALL,
} from './ribbonTheme';
import { RibbonIcon } from './ribbonIcons';

interface RibbonButtonProps {
  label: string;
  icon?: string;
  size?: RibbonItemSize;
  active?: boolean;
  disabled?: boolean;
  /** Tooltip override, e.g. the reason a command is unavailable */
  hint?: string;
  accent: RibbonAccent;
  /**
   * Set for toggle-style commands: renders `aria-pressed`. Leave undefined for plain commands so
   * screen readers do not announce them as toggles.
   */
  pressed?: boolean;
  onClick: () => void;
  testId?: string;
}

/**
 * Ribbon command button.
 *
 * Large: icon above a two-line label (primary commands). Small: icon only with the label as tooltip
 * (secondary commands) — this two-level hierarchy is what makes a ribbon read as an Office ribbon
 * instead of a flat toolbar.
 */
export function RibbonButton({
  label,
  icon,
  size = 'large',
  active = false,
  disabled = false,
  hint,
  accent,
  pressed,
  onClick,
  testId,
}: RibbonButtonProps) {
  const large = size === 'large';
  return (
    <button
      type="button"
      data-testid={testId}
      title={hint ?? label}
      aria-label={label}
      aria-pressed={pressed}
      disabled={disabled}
      onClick={onClick}
      className={`${RIBBON_BTN_BASE} ${large ? RIBBON_BTN_LARGE : RIBBON_BTN_SMALL} ${
        active ? RIBBON_ACCENT[accent].toggle : RIBBON_BTN_IDLE
      }`}
    >
      {icon ? <RibbonIcon name={icon} className={large ? 'h-5 w-5' : 'h-4 w-4'} /> : null}
      {large ? (
        <span className="max-h-[1.9rem] overflow-hidden text-center leading-[1.15]">{label}</span>
      ) : null}
    </button>
  );
}
