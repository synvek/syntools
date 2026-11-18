import { useTranslation } from 'react-i18next';

export type SaveState = 'none' | 'saved' | 'dirty' | 'saving' | 'failed';

const LABEL_KEY: Record<SaveState, string> = {
  none: 'saveNever',
  saved: 'saveSaved',
  dirty: 'saveDirty',
  saving: 'saveSaving',
  failed: 'saveFailed',
};

const DOT_CLASS: Record<SaveState, string> = {
  none: 'bg-gray-400',
  saved: 'bg-green-500',
  dirty: 'bg-amber-500',
  saving: 'bg-blue-500',
  failed: 'bg-red-500',
};

interface SaveStatusProps {
  state: SaveState;
  /** File name shown next to the dot; truncated so long names cannot push the ribbon tabs */
  name?: string;
}

/** Ribbon header chip: file name + save state (M1 drives it; M0 only exports it) */
export function SaveStatus({ state, name }: SaveStatusProps) {
  const { t } = useTranslation();

  return (
    <div
      className="flex items-center gap-2 text-xs text-gray-500 dark:text-gray-400"
      data-testid="pdf-save-status"
      data-state={state}
    >
      <span
        className={`h-1.5 w-1.5 shrink-0 rounded-full ${DOT_CLASS[state]}`}
        aria-hidden="true"
      />
      {name ? (
        <span className="max-w-[16rem] truncate text-gray-700 dark:text-gray-200" title={name}>
          {name}
        </span>
      ) : null}
      <span aria-live="polite">{t(`tools.pdfEditor.${LABEL_KEY[state]}`)}</span>
    </div>
  );
}
