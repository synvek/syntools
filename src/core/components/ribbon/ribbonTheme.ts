import type { RibbonAccent } from './types';

/**
 * Size / color tokens for the ribbon shell.
 *
 * Tailwind needs literal class strings, so the tokens are written out instead of composed at runtime.
 * The accents replicate the Office application colors (Word blue / Excel green / PowerPoint orange);
 * they only paint *selected* states so no large colored areas appear.
 */

export const RIBBON_SHELL =
  'rounded-lg border border-gray-200 bg-white shadow-sm dark:border-[#3a3a3a] dark:bg-[#1f1f1f]';

export const RIBBON_TABSTRIP =
  'flex h-8 items-center gap-1 border-b border-gray-200 bg-[#f3f2f1] px-1 dark:border-[#3a3a3a] dark:bg-[#2b2b2b]';

/**
 * 56px command row + 2px gap + caption + padding — anything shorter clips the group caption.
 *
 * `overflow-visible` on purpose: dropdown menus and the group overlay gallery are absolutely
 * positioned below the group and would otherwise be clipped by the panel.
 */
export const RIBBON_PANEL = 'flex h-20 items-stretch gap-0 bg-white px-1 py-1 dark:bg-[#1f1f1f]';

export const RIBBON_FLYOUT =
  'absolute left-0 top-full z-40 mt-0.5 flex max-h-[70vh] max-w-[calc(100vw-2rem)] flex-wrap items-stretch rounded-lg border border-gray-200 bg-white p-1 shadow-xl dark:border-[#3a3a3a] dark:bg-[#1f1f1f]';

/** Vertical divider between groups (inset so it does not touch the panel edges) */
export const RIBBON_GROUP_DIVIDER =
  'my-1.5 w-px shrink-0 self-stretch bg-gray-300/70 dark:bg-[#3a3a3a]';

export const RIBBON_GROUP_LABEL =
  'pointer-events-none max-w-full truncate text-center text-[10px] leading-none text-gray-500 dark:text-[#a0a0a0]';

export const RIBBON_BTN_BASE =
  'inline-flex items-center justify-center rounded border border-transparent transition-colors disabled:cursor-not-allowed disabled:opacity-40';

export const RIBBON_BTN_LARGE = 'h-14 w-[3.25rem] flex-col gap-1 px-0.5 text-[11px] leading-[1.1]';

export const RIBBON_BTN_SMALL = 'h-6 min-w-6 gap-1 px-1 text-[11px]';

export const RIBBON_BTN_IDLE =
  'text-gray-700 hover:border-gray-300 hover:bg-black/[0.04] dark:text-[#e8e8e8] dark:hover:border-[#4a4a4a] dark:hover:bg-white/10';

export const RIBBON_TAB_IDLE =
  'text-gray-600 hover:bg-black/[0.05] dark:text-[#d0d0d0] dark:hover:bg-white/10';

export const RIBBON_ICON_BUTTON =
  'inline-flex h-6 w-6 shrink-0 items-center justify-center rounded text-gray-600 transition-colors hover:bg-black/[0.06] dark:text-[#c8c8c8] dark:hover:bg-white/10';

interface AccentClasses {
  /** Selected tab text + 2px underline */
  tab: string;
  /** Toggle / active command fill */
  toggle: string;
  /** Dialog launcher hover */
  launcher: string;
  /** Focus ring */
  ring: string;
}

export const RIBBON_ACCENT: Record<RibbonAccent, AccentClasses> = {
  blue: {
    tab: 'text-[#2b579a] border-[#2b579a] dark:text-[#8ab4f8] dark:border-[#8ab4f8]',
    toggle:
      'border-[#2b579a] bg-[#2b579a] text-white hover:bg-[#24497f] dark:border-[#8ab4f8] dark:bg-[#8ab4f8] dark:text-[#121212] dark:hover:bg-[#9dc0f9]',
    launcher: 'text-gray-400 hover:text-[#2b579a] dark:text-[#8a8a8a] dark:hover:text-[#8ab4f8]',
    ring: 'focus-visible:ring-[#2b579a] dark:focus-visible:ring-[#8ab4f8]',
  },
  green: {
    tab: 'text-[#217346] border-[#217346] dark:text-[#6cc196] dark:border-[#6cc196]',
    toggle:
      'border-[#217346] bg-[#217346] text-white hover:bg-[#1b5e39] dark:border-[#6cc196] dark:bg-[#6cc196] dark:text-[#121212] dark:hover:bg-[#7fd0a8]',
    launcher: 'text-gray-400 hover:text-[#217346] dark:text-[#8a8a8a] dark:hover:text-[#6cc196]',
    ring: 'focus-visible:ring-[#217346] dark:focus-visible:ring-[#6cc196]',
  },
  orange: {
    tab: 'text-[#c43e1c] border-[#c43e1c] dark:text-[#f0906f] dark:border-[#f0906f]',
    toggle:
      'border-[#c43e1c] bg-[#c43e1c] text-white hover:bg-[#a93417] dark:border-[#f0906f] dark:bg-[#f0906f] dark:text-[#121212] dark:hover:bg-[#f4a488]',
    launcher: 'text-gray-400 hover:text-[#c43e1c] dark:text-[#8a8a8a] dark:hover:text-[#f0906f]',
    ring: 'focus-visible:ring-[#c43e1c] dark:focus-visible:ring-[#f0906f]',
  },
};

/** Swatches shared by every ribbon color picker (kept in sync with the word processor palette) */
export const RIBBON_COLOR_SWATCHES = [
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
