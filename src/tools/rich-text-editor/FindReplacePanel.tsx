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

  const controlClass =
    'h-8 rounded-md border border-gray-300 bg-white px-2 text-sm text-gray-900 outline-none focus:border-blue-500 dark:border-gray-600 dark:bg-gray-800 dark:text-gray-100';

  return (
    <div
      data-testid="rich-text-find-panel"
      className="flex flex-wrap items-center gap-1.5 rounded-lg border border-blue-300 bg-blue-50/70 p-1.5 dark:border-blue-800 dark:bg-blue-950/40"
      onKeyDown={handleKeyDown}
    >
      <div className="relative flex items-center">
        <input
          ref={inputRef}
          value={term}
          onChange={(e) => setTerm(e.target.value)}
          placeholder={t('tools.richText.find')}
          aria-label={t('tools.richText.find')}
          className={`${controlClass} w-44 pr-16`}
        />
        <span
          className="pointer-events-none absolute right-2 text-xs text-gray-500 dark:text-gray-400"
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
        className={`${controlClass} w-44`}
      />

      <button
        type="button"
        title={t('tools.richText.matchCase')}
        aria-label={t('tools.richText.matchCase')}
        aria-pressed={matchCase}
        onClick={() => setMatchCase((v) => !v)}
        className={`flex h-8 items-center rounded-md border px-2 text-xs font-semibold transition-colors ${
          matchCase
            ? 'border-blue-600 bg-blue-600 text-white'
            : 'border-transparent text-gray-600 hover:bg-gray-100 dark:text-gray-300 dark:hover:bg-gray-800'
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
        className="flex h-8 w-8 items-center justify-center rounded-md text-gray-600 transition-colors hover:bg-gray-100 disabled:cursor-not-allowed disabled:opacity-40 dark:text-gray-300 dark:hover:bg-gray-800"
      >
        <Icon name="chevronLeft" className="h-4 w-4" />
      </button>
      <button
        type="button"
        title={t('tools.richText.nextMatch')}
        aria-label={t('tools.richText.nextMatch')}
        disabled={total === 0}
        onClick={() => step(1)}
        className="flex h-8 w-8 items-center justify-center rounded-md text-gray-600 transition-colors hover:bg-gray-100 disabled:cursor-not-allowed disabled:opacity-40 dark:text-gray-300 dark:hover:bg-gray-800"
      >
        <Icon name="chevronRight" className="h-4 w-4" />
      </button>

      <button
        type="button"
        disabled={total === 0}
        onClick={() => editor.chain().focus().replaceMatch(replacement).run()}
        className="h-8 rounded-md border border-gray-300 px-2 text-xs text-gray-700 transition-colors hover:bg-gray-100 disabled:cursor-not-allowed disabled:opacity-40 dark:border-gray-600 dark:text-gray-200 dark:hover:bg-gray-800"
      >
        {t('tools.richText.replaceOne')}
      </button>
      <button
        type="button"
        disabled={total === 0}
        onClick={() => editor.chain().focus().replaceAllMatches(replacement).run()}
        className="h-8 rounded-md border border-gray-300 px-2 text-xs text-gray-700 transition-colors hover:bg-gray-100 disabled:cursor-not-allowed disabled:opacity-40 dark:border-gray-600 dark:text-gray-200 dark:hover:bg-gray-800"
      >
        {t('tools.richText.replaceAll')}
      </button>

      <button
        type="button"
        title={t('tools.richText.closeFind')}
        aria-label={t('tools.richText.closeFind')}
        onClick={onClose}
        className="flex h-8 w-8 items-center justify-center rounded-md text-gray-500 transition-colors hover:bg-gray-100 dark:text-gray-400 dark:hover:bg-gray-800"
      >
        <Icon name="close" className="h-4 w-4" />
      </button>
    </div>
  );
}
