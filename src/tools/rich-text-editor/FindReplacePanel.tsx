import { useCallback, useEffect, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import type { Editor } from '@tiptap/react';
import { Icon } from '@/core/components/Icon';
import { findMatches, findReplaceKey } from './find-replace';

interface FindReplacePanelProps {
  editor: Editor;
  onClose: () => void;
}

/**
 * Shared control tokens with the other editor panels / ribbon popovers (ReviewPanel, ShapePanel,
 * RibbonMenu): neutral surfaces, 28px controls, gray borders, accent only on the active toggle.
 */
const FIELD_CLASS =
  'h-7 w-44 min-w-0 rounded-md border border-gray-300 bg-white px-2 text-xs text-gray-800 outline-none transition-colors placeholder:text-gray-400 focus:border-blue-500 dark:border-gray-600 dark:bg-gray-900 dark:text-gray-100 dark:placeholder:text-gray-500';
const BUTTON_CLASS =
  'inline-flex h-7 shrink-0 items-center justify-center rounded-md border border-gray-300 bg-white px-2 text-xs text-gray-700 transition-colors hover:bg-gray-100 disabled:cursor-not-allowed disabled:opacity-40 dark:border-gray-600 dark:bg-gray-900 dark:text-gray-200 dark:hover:bg-gray-800';
const ICON_BUTTON_CLASS =
  'inline-flex h-7 w-7 shrink-0 items-center justify-center rounded-md border border-gray-300 bg-white text-gray-600 transition-colors hover:bg-gray-100 disabled:cursor-not-allowed disabled:opacity-40 dark:border-gray-600 dark:bg-gray-900 dark:text-gray-300 dark:hover:bg-gray-800';

/**
 * Find-and-replace panel: decoration highlights, match navigation, replace one / replace all.
 * The find-replace plugin owns match state; this component only handles input and display.
 */
export function FindReplacePanel({ editor, onClose }: FindReplacePanelProps) {
  const { t } = useTranslation();
  const [term, setTerm] = useState('');
  const [replacement, setReplacement] = useState('');
  const [matchCase, setMatchCase] = useState(false);
  const [total, setTotal] = useState(0);
  const [current, setCurrent] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);

  // Focus the search field as soon as the panel opens
  useEffect(() => {
    inputRef.current?.focus();
  }, []);

  // Search term or case option changed → update the plugin's highlight state
  useEffect(() => {
    editor.commands.setSearch(term.trim(), matchCase);
  }, [editor, term, matchCase]);

  // Sync the match count (refreshed on doc or search state changes)
  const refreshCount = useCallback(() => {
    const config = findReplaceKey.getState(editor.state);
    const matches = config?.term
      ? findMatches(editor.state.doc, config.term, config.matchCase)
      : [];
    setTotal(matches.length);
    setCurrent(config ? Math.min(config.index, Math.max(matches.length - 1, 0)) : 0);
  }, [editor]);

  useEffect(() => {
    refreshCount();
    editor.on('update', refreshCount);
    editor.on('transaction', refreshCount);
    return () => {
      editor.off('update', refreshCount);
      editor.off('transaction', refreshCount);
    };
  }, [editor, refreshCount]);

  const step = (delta: 1 | -1) => {
    editor.chain().focus().gotoMatch(delta).run();
  };

  const handleKeyDown = (event: React.KeyboardEvent) => {
    if (event.key === 'Escape') {
      event.preventDefault();
      onClose();
      return;
    }
    if (event.key === 'Enter' && term) {
      event.preventDefault();
      step(event.shiftKey ? -1 : 1);
    }
  };

  return (
    <div
      data-testid="rich-text-find-panel"
      className="flex max-w-full flex-col gap-2 rounded-lg border border-gray-200 bg-white p-2 text-sm shadow-xl dark:border-gray-700 dark:bg-gray-900"
      onKeyDown={handleKeyDown}
    >
      {/* Same header as the other editor panels: title on the left, close button on the right */}
      <div className="flex items-center justify-between gap-2">
        <span className="font-medium text-gray-700 dark:text-gray-200">
          {t('tools.richText.findReplace')}
        </span>
        <button
          type="button"
          title={t('tools.richText.closeFind')}
          aria-label={t('tools.richText.closeFind')}
          onClick={onClose}
          className="flex h-7 w-7 items-center justify-center rounded-md text-gray-500 transition-colors hover:bg-gray-100 dark:text-gray-400 dark:hover:bg-gray-800"
        >
          <Icon name="close" className="h-4 w-4" />
        </button>
      </div>

      <div className="flex flex-wrap items-center gap-1.5">
        <div className="relative flex items-center">
          <input
            ref={inputRef}
            value={term}
            onChange={(e) => setTerm(e.target.value)}
            placeholder={t('tools.richText.find')}
            aria-label={t('tools.richText.find')}
            className={`${FIELD_CLASS} pr-16`}
          />
          <span
            className="pointer-events-none absolute right-2 text-xs text-gray-400 dark:text-gray-500"
            aria-live="polite"
          >
            {total > 0 ? `${current + 1}/${total}` : term ? t('tools.richText.noMatch') : ''}
          </span>
        </div>

        <input
          value={replacement}
          onChange={(e) => setReplacement(e.target.value)}
          placeholder={t('tools.richText.replace')}
          aria-label={t('tools.richText.replace')}
          className={FIELD_CLASS}
        />

        <button
          type="button"
          title={t('tools.richText.matchCase')}
          aria-label={t('tools.richText.matchCase')}
          aria-pressed={matchCase}
          onClick={() => setMatchCase((v) => !v)}
          className={`inline-flex h-7 shrink-0 items-center justify-center rounded-md border px-2 text-xs font-semibold transition-colors ${
            matchCase
              ? 'border-blue-600 bg-blue-600 text-white dark:border-blue-500'
              : `${BUTTON_CLASS}`
          }`}
        >
          Aa
        </button>

        <button
          type="button"
          title={t('tools.richText.prevMatch')}
          aria-label={t('tools.richText.prevMatch')}
          disabled={total === 0}
          onClick={() => step(-1)}
          className={ICON_BUTTON_CLASS}
        >
          <Icon name="chevronLeft" className="h-4 w-4" />
        </button>
        <button
          type="button"
          title={t('tools.richText.nextMatch')}
          aria-label={t('tools.richText.nextMatch')}
          disabled={total === 0}
          onClick={() => step(1)}
          className={ICON_BUTTON_CLASS}
        >
          <Icon name="chevronRight" className="h-4 w-4" />
        </button>

        <button
          type="button"
          disabled={total === 0}
          onClick={() => editor.chain().focus().replaceMatch(replacement).run()}
          className={BUTTON_CLASS}
        >
          {t('tools.richText.replaceOne')}
        </button>
        <button
          type="button"
          disabled={total === 0}
          onClick={() => editor.chain().focus().replaceAllMatches(replacement).run()}
          className={BUTTON_CLASS}
        >
          {t('tools.richText.replaceAll')}
        </button>
      </div>
    </div>
  );
}
