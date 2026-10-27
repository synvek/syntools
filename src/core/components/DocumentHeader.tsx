import type { ReactNode } from 'react';
import { Icon } from '@/core/components/Icon';
import { ClearButton, OptionBar } from '@/core/components/ActionButtons';

/**
 * Shared document header for document editors (word processor, spreadsheet, slides, flowchart, mind map).
 *
 * Row layout, top to bottom:
 * 1. Title (input fixed at 200px) + new-document button + import / export buttons (io slot, at the row end);
 * 2. Document stats on the left (stats slot), status on the right (status slot) + clear button;
 * 3. Each tool then renders its own toolbar row (wrapping to the next row when needed).
 *
 * The title is the export filename, persisted to the document model via onTitleChange.
 * No long explanatory text inline; use a `HintTip` bubble to save space.
 */

/** Title input: fixed 200px wide so tools stay consistent */
export const DOC_TITLE_INPUT_CLASS =
  'w-[200px] shrink-0 rounded-md border border-gray-300 bg-white px-2 py-1 text-sm text-gray-800 outline-none transition-colors focus:border-blue-500 dark:border-gray-700 dark:bg-gray-900 dark:text-gray-100';

/** Help bubble: shows only an ⓘ icon, expanding to the full text on hover / focus */
export function HintTip({ text, label }: { text: string; label?: string }) {
  return (
    <span
      role="img"
      tabIndex={0}
      title={text}
      aria-label={label ?? text}
      className="inline-flex h-8 w-8 shrink-0 cursor-help items-center justify-center rounded-md text-gray-400 transition-colors hover:bg-gray-100 hover:text-gray-600 focus:outline-none focus:ring-1 focus:ring-blue-400 dark:text-gray-500 dark:hover:bg-gray-800 dark:hover:text-gray-300"
    >
      <Icon name="info" className="h-4 w-4" />
    </span>
  );
}

interface DocumentHeaderProps {
  titleLabel: string;
  titlePlaceholder: string;
  title: string;
  onTitleChange: (value: string) => void;
  /** Label for the new-document button */
  newLabel: string;
  /** New-button icon (Icon name) */
  newIcon: string;
  onNew: () => void;
  /** Buttons inserted after the new button and before io (e.g. present) */
  afterNew?: ReactNode;
  /** End of row one: import / export buttons */
  io?: ReactNode;
  /** Left of row two: document stats */
  stats?: ReactNode;
  /** Right of row two: document status, e.g. "saved to local draft" */
  status?: ReactNode;
  /** Clear content */
  onClear?: () => void;
  clearDisabled?: boolean;
}

export function DocumentHeader({
  titleLabel,
  titlePlaceholder,
  title,
  onTitleChange,
  newLabel,
  newIcon,
  onNew,
  afterNew,
  io,
  stats,
  status,
  onClear,
  clearDisabled,
}: DocumentHeaderProps) {
  return (
    <>
      <OptionBar>
        <label className="flex items-center gap-2 text-sm text-gray-600 dark:text-gray-300">
          <span className="shrink-0">{titleLabel}</span>
          <input
            type="text"
            value={title}
            aria-label={titleLabel}
            placeholder={titlePlaceholder}
            onChange={(event) => onTitleChange(event.target.value)}
            className={DOC_TITLE_INPUT_CLASS}
          />
        </label>
        <button
          type="button"
          onClick={onNew}
          className="inline-flex items-center gap-1.5 rounded-md border border-gray-300 px-3 py-1.5 text-sm text-gray-700 transition-colors hover:bg-gray-100 dark:border-gray-600 dark:text-gray-200 dark:hover:bg-gray-800"
        >
          <Icon name={newIcon} className="h-4 w-4" />
          {newLabel}
        </button>

        {afterNew}

        {io ? (
          <div className="ml-auto flex flex-wrap items-center justify-end gap-2">{io}</div>
        ) : null}
      </OptionBar>

      <div className="flex flex-wrap items-center justify-between gap-2 text-xs text-gray-500 dark:text-gray-400">
        <div className="flex flex-wrap items-center gap-3">{stats}</div>
        <div className="flex items-center gap-2">
          {status}
          {onClear ? <ClearButton onClick={onClear} disabled={clearDisabled} /> : null}
        </div>
      </div>
    </>
  );
}
