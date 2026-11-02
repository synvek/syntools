import { useState } from 'react';
import type { RibbonAccent, RibbonItemSize, RibbonMenuItem } from './types';
import {
  RIBBON_ACCENT,
  RIBBON_BTN_BASE,
  RIBBON_BTN_IDLE,
  RIBBON_BTN_LARGE,
  RIBBON_BTN_SMALL,
} from './ribbonTheme';
import { RibbonIcon } from './ribbonIcons';
import { RibbonMenu } from './RibbonMenu';

interface CommonProps {
  label: string;
  icon?: string;
  size?: RibbonItemSize;
  active?: boolean;
  disabled?: boolean;
  hint?: string;
  menu: RibbonMenuItem[];
  testId?: string;
}

const ARROW_LARGE = 'h-14 w-3';
const ARROW_SMALL = 'h-6 w-3';

function ArrowButton({
  label,
  open,
  disabled,
  size = 'large',
  onToggle,
}: {
  label: string;
  open: boolean;
  disabled: boolean;
  size?: RibbonItemSize;
  onToggle: () => void;
}) {
  return (
    <button
      type="button"
      aria-haspopup="menu"
      aria-expanded={open}
      aria-label={`${label} ▾`}
      disabled={disabled}
      onClick={onToggle}
      className={`${RIBBON_BTN_BASE} ${size === 'large' ? ARROW_LARGE : ARROW_SMALL} rounded-l-none border-l border-gray-300/70 ${RIBBON_BTN_IDLE} dark:border-[#4a4a4a]`}
    >
      <RibbonIcon name="chevron" className="h-3 w-3" />
    </button>
  );
}

/**
 * Split button: the icon runs the primary command, the arrow opens the menu (Office's
 * "边框 ▾ / 合并后居中 ▾" shape). One open panel at a time, closed on outside click / Esc.
 */
export function RibbonSplitButton({
  label,
  icon,
  size = 'large',
  active = false,
  disabled = false,
  hint,
  accent,
  menu,
  onSelect,
  testId,
}: CommonProps & { accent: RibbonAccent; onSelect: () => void }) {
  const [open, setOpen] = useState(false);
  const large = size === 'large';
  return (
    <div className="relative flex shrink-0 items-stretch">
      <button
        type="button"
        data-testid={testId}
        title={hint ?? label}
        aria-label={label}
        aria-pressed={active}
        disabled={disabled}
        onClick={onSelect}
        className={`${RIBBON_BTN_BASE} ${large ? RIBBON_BTN_LARGE : RIBBON_BTN_SMALL} rounded-r-none ${
          active ? RIBBON_ACCENT[accent].toggle : RIBBON_BTN_IDLE
        }`}
      >
        {icon ? <RibbonIcon name={icon} className={large ? 'h-5 w-5' : 'h-4 w-4'} /> : null}
        {large ? (
          <span className="max-h-[1.9rem] overflow-hidden text-center leading-[1.15]">{label}</span>
        ) : null}
      </button>
      <ArrowButton
        label={label}
        open={open}
        disabled={disabled}
        size={size}
        onToggle={() => setOpen((value) => !value)}
      />
      {open ? <RibbonMenu items={menu} ariaLabel={label} onClose={() => setOpen(false)} /> : null}
    </div>
  );
}

/** Dropdown-only entry ("形状 ▾"): the whole button opens the menu */
export function RibbonMenuButton({
  label,
  icon,
  size = 'large',
  disabled = false,
  hint,
  menu,
  testId,
}: CommonProps) {
  const [open, setOpen] = useState(false);
  const large = size === 'large';
  return (
    <div className="relative flex shrink-0 items-stretch">
      <button
        type="button"
        data-testid={testId}
        title={hint ?? label}
        aria-label={label}
        aria-haspopup="menu"
        aria-expanded={open}
        disabled={disabled}
        onClick={() => setOpen((value) => !value)}
        className={`${RIBBON_BTN_BASE} ${large ? RIBBON_BTN_LARGE : RIBBON_BTN_SMALL} ${RIBBON_BTN_IDLE} ${
          large ? 'gap-0.5' : ''
        }`}
      >
        {icon ? <RibbonIcon name={icon} className={large ? 'h-5 w-5' : 'h-4 w-4'} /> : null}
        {large ? (
          <>
            <span className="max-h-[1.9rem] overflow-hidden text-center leading-[1.15]">
              {label}
            </span>
            <RibbonIcon name="chevron" className="h-2.5 w-2.5 shrink-0 opacity-70" />
          </>
        ) : (
          <RibbonIcon name="chevron" className="h-2.5 w-2.5 shrink-0 opacity-70" />
        )}
      </button>
      {open ? <RibbonMenu items={menu} ariaLabel={label} onClose={() => setOpen(false)} /> : null}
    </div>
  );
}
