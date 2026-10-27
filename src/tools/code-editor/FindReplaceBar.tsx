import { useEffect, useRef, type KeyboardEvent } from 'react';
import { useTranslation } from 'react-i18next';
import { Icon } from '@/core/components/Icon';

/** Find option toggles */
export interface FindOptionState {
  matchCase: boolean;
  wholeWord: boolean;
  regex: boolean;
}

/** Focus target when opening / re-invoking the bar (`seq` changes refocus, so repeated ⌘F works) */
export interface FindFocusRequest {
  target: 'query' | 'replacement';
  seq: number;
}

interface FindReplaceBarProps {
  query: string;
  replacement: string;
  options: FindOptionState;
  /** Total number of matches */
  total: number;
  /** Index of the current match (-1 means not positioned yet) */
  current: number;
  /** The match count hit the cap and was truncated */
  truncated: boolean;
  /** Invalid regular expression */
  invalid: boolean;
  focus: FindFocusRequest;
  onQueryChange: (value: string) => void;
  onReplacementChange: (value: string) => void;
  onToggleOption: (key: keyof FindOptionState) => void;
  onStep: (delta: 1 | -1) => void;
  onReplaceOne: () => void;
  onReplaceAll: () => void;
  onClose: () => void;
}

const INPUT_CLASS =
  'h-7 min-w-0 rounded-md border border-gray-300 bg-white px-2 text-xs text-gray-800 outline-none transition-colors focus:border-blue-500 dark:border-gray-600 dark:bg-gray-900 dark:text-gray-100';
const BUTTON_CLASS =
  'flex h-7 shrink-0 items-center gap-1 rounded-md border border-gray-300 px-2 text-xs text-gray-600 transition-colors hover:bg-gray-100 disabled:cursor-not-allowed disabled:opacity-40 dark:border-gray-600 dark:text-gray-200 dark:hover:bg-gray-800';
const TOGGLE_CLASS = `${BUTTON_CLASS} font-mono`;
const TOGGLE_ON_CLASS =
  'border-blue-500 bg-blue-50 text-blue-600 dark:bg-blue-950/60 dark:text-blue-300';

/**
 * Find and replace bar (above the editor): match counter, case / whole-word / regex toggles, and
 * navigation plus replacement. It only handles input and display; matching lives in
 * `findReplace.ts` and the highlights are drawn by the `CodeSurface` overlay.
 */
export function FindReplaceBar({
  query,
  replacement,
  options,
  total,
  current,
  truncated,
  invalid,
  focus,
  onQueryChange,
  onReplacementChange,
  onToggleOption,
  onStep,
  onReplaceOne,
  onReplaceAll,
  onClose,
}: FindReplaceBarProps) {
  const { t } = useTranslation();
  const queryRef = useRef<HTMLInputElement>(null);
  const replaceRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    const target = focus.target === 'replacement' ? replaceRef.current : queryRef.current;
    target?.focus();
    target?.select();
  }, [focus]);

  const handleKeyDown = (event: KeyboardEvent<HTMLInputElement>) => {
    if (event.key === 'Escape') {
      event.preventDefault();
      onClose();
      return;
    }
    if (event.key === 'Enter') {
      event.preventDefault();
      onStep(event.shiftKey ? -1 : 1);
    }
  };

  const counter = invalid
    ? t('tools.codeEditor.find.invalid')
    : total === 0
      ? t('tools.codeEditor.find.noMatch')
      : `${current >= 0 ? current + 1 : '–'}/${total}${truncated ? '+' : ''}`;

  const toggles: Array<{ key: keyof FindOptionState; glyph: string; label: string }> = [
    { key: 'matchCase', glyph: 'Aa', label: t('tools.codeEditor.find.caseSensitive') },
    { key: 'wholeWord', glyph: 'ab|', label: t('tools.codeEditor.find.wholeWord') },
    { key: 'regex', glyph: '.*', label: t('tools.codeEditor.find.regex') },
  ];

  return (
    <div className="flex flex-wrap items-center gap-1.5 rounded-lg border border-gray-200 bg-gray-50 px-2 py-1.5 dark:border-gray-700 dark:bg-gray-800/60">
      <Icon name="search" className="h-4 w-4 shrink-0 text-gray-400" />
      <input
        ref={queryRef}
        value={query}
        aria-label={t('tools.codeEditor.find.label')}
        placeholder={t('tools.codeEditor.find.label')}
        onChange={(event) => onQueryChange(event.target.value)}
        onKeyDown={handleKeyDown}
        className={`${INPUT_CLASS} w-40`}
      />
      <input
        ref={replaceRef}
        value={replacement}
        aria-label={t('tools.codeEditor.find.replaceLabel')}
        placeholder={t('tools.codeEditor.find.replaceLabel')}
        onChange={(event) => onReplacementChange(event.target.value)}
        onKeyDown={handleKeyDown}
        className={`${INPUT_CLASS} w-40`}
      />
      {toggles.map((toggle) => (
        <button
          key={toggle.key}
          type="button"
          title={toggle.label}
          aria-label={toggle.label}
          aria-pressed={options[toggle.key]}
          onClick={() => onToggleOption(toggle.key)}
          className={`${TOGGLE_CLASS} ${options[toggle.key] ? TOGGLE_ON_CLASS : ''}`}
        >
          {toggle.glyph}
        </button>
      ))}
      <span
        role="status"
        title={truncated ? t('tools.codeEditor.find.truncated') : counter}
        className="ce-find-counter min-w-14 text-center text-xs text-gray-500 tabular-nums dark:text-gray-400"
      >
        {counter}
      </span>
      <button
        type="button"
        className={BUTTON_CLASS}
        aria-label={t('tools.codeEditor.find.prev')}
        onClick={() => onStep(-1)}
        disabled={total === 0}
      >
        <Icon name="chevronLeft" className="h-3.5 w-3.5" />
      </button>
      <button
        type="button"
        className={BUTTON_CLASS}
        aria-label={t('tools.codeEditor.find.next')}
        onClick={() => onStep(1)}
        disabled={total === 0}
      >
        <Icon name="chevronRight" className="h-3.5 w-3.5" />
      </button>
      <button type="button" className={BUTTON_CLASS} onClick={onReplaceOne} disabled={total === 0}>
        {t('tools.codeEditor.find.replaceOne')}
      </button>
      <button type="button" className={BUTTON_CLASS} onClick={onReplaceAll} disabled={total === 0}>
        {t('tools.codeEditor.find.replaceAll')}
      </button>
      <button
        type="button"
        className={`${BUTTON_CLASS} ml-auto`}
        aria-label={t('tools.codeEditor.find.close')}
        title={t('tools.codeEditor.find.close')}
        onClick={onClose}
      >
        <Icon name="close" className="h-3.5 w-3.5" />
      </button>
    </div>
  );
}
