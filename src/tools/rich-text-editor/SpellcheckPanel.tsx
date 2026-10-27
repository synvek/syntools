import { useTranslation } from 'react-i18next';
import { Icon } from '@/core/components/Icon';
import type { DocSpellIssue } from './spellcheck';

interface SpellcheckPanelProps {
  /** Whether spellcheck is currently enabled */
  enabled: boolean;
  onToggle: () => void;
  /** Whether the word list is loaded (without it only the custom dictionary is used, so expect more false positives) */
  dictionaryLoaded: boolean;
  loading: boolean;
  /** The word list failed to load */
  loadFailed: boolean;
  onLoadDictionary: () => void;
  /** Issue list (sorted by document position; the count is capped by the tool layer) */
  issues: DocSpellIssue[];
  /** Suggestions for one issue (computed lazily, the index is cached) */
  suggestionsFor: (word: string) => string[];
  onReplace: (issue: DocSpellIssue, replacement: string) => void;
  onAddToDictionary: (word: string) => void;
  onIgnore: (word: string) => void;
  userWords: readonly string[];
  onRemoveUserWord: (word: string) => void;
  onClose: () => void;
}

/** Max suggestions per issue: too many would drown out the primary "add to dictionary / ignore" actions */
const MAX_SUGGESTIONS = 3;
/** Suggestions are expensive, so only the first N issues show them */
const SUGGESTION_LIMIT = 20;

/**
 * Spellcheck panel:
 * The word list is fully local (downloaded on first use) and the custom dictionary is saved with the draft.
 * Suggestions are computed only for the first few issues: with 200k+ words, computing them all would stutter.
 */
export function SpellcheckPanel({
  enabled,
  onToggle,
  dictionaryLoaded,
  loading,
  loadFailed,
  onLoadDictionary,
  issues,
  suggestionsFor,
  onReplace,
  onAddToDictionary,
  onIgnore,
  userWords,
  onRemoveUserWord,
  onClose,
}: SpellcheckPanelProps) {
  const { t } = useTranslation();

  return (
    <div
      data-testid="rich-text-spellcheck"
      className="rounded-lg border border-gray-200 bg-white p-2 text-sm dark:border-gray-700 dark:bg-gray-900"
    >
      <div className="mb-2 flex items-center justify-between gap-2">
        <span className="font-medium text-gray-700 dark:text-gray-200">
          {t('tools.richText.spellcheck')}
          {enabled && issues.length > 0 ? (
            <span className="ml-1.5 rounded-full bg-amber-100 px-1.5 text-xs text-amber-700 dark:bg-amber-900/40 dark:text-amber-300">
              {issues.length}
            </span>
          ) : null}
        </span>
        <div className="flex items-center gap-1">
          <button
            type="button"
            aria-pressed={enabled}
            onClick={onToggle}
            className={`h-7 rounded-md border px-2 text-xs transition-colors ${
              enabled
                ? 'border-blue-600 bg-blue-50 text-blue-700 dark:border-blue-500 dark:bg-blue-950/40 dark:text-blue-300'
                : 'border-gray-300 text-gray-600 hover:bg-gray-100 dark:border-gray-600 dark:text-gray-300 dark:hover:bg-gray-800'
            }`}
          >
            {enabled ? t('tools.richText.spellcheckOn') : t('tools.richText.spellcheckOff')}
          </button>
          <button
            type="button"
            aria-label={t('tools.richText.spellcheckClose')}
            onClick={onClose}
            className="flex h-7 w-7 items-center justify-center rounded-md text-gray-500 transition-colors hover:bg-gray-100 dark:text-gray-400 dark:hover:bg-gray-800"
          >
            <Icon name="close" className="h-4 w-4" />
          </button>
        </div>
      </div>

      <p className="mb-2 text-xs text-gray-500 dark:text-gray-400">
        {t('tools.richText.spellcheckPrivacy')}
      </p>

      {!dictionaryLoaded ? (
        <div className="mb-2 rounded-md border border-gray-200 bg-gray-50 px-2 py-1.5 dark:border-gray-700 dark:bg-gray-800/40">
          <p className="text-xs text-gray-500 dark:text-gray-400">
            {t('tools.richText.spellcheckDictHint')}
          </p>
          <button
            type="button"
            disabled={loading}
            onClick={onLoadDictionary}
            className="mt-1 h-7 rounded-md bg-blue-600 px-2 text-xs text-white transition-colors hover:bg-blue-700 disabled:cursor-not-allowed disabled:opacity-50"
          >
            {loading ? t('tools.richText.spellcheckLoading') : t('tools.richText.spellcheckLoad')}
          </button>
          {loadFailed ? (
            <p role="alert" className="mt-1 text-xs text-red-600 dark:text-red-400">
              {t('tools.richText.err.DICT_LOAD_FAILED')}
            </p>
          ) : null}
        </div>
      ) : null}

      {enabled ? (
        issues.length === 0 ? (
          <p className="px-1 py-2 text-xs text-gray-400 dark:text-gray-500">
            {t('tools.richText.spellcheckClean')}
          </p>
        ) : (
          <ul className="max-h-64 overflow-auto" data-testid="rich-text-spellcheck-issues">
            {issues.map((issue, index) => {
              const suggestions = index < SUGGESTION_LIMIT ? suggestionsFor(issue.word) : [];
              return (
                <li
                  key={`${issue.from}-${issue.word}`}
                  className="rounded-md px-2 py-1.5 hover:bg-gray-50 dark:hover:bg-gray-800/60"
                >
                  <div className="flex items-center gap-2">
                    <span className="min-w-0 flex-1 truncate font-medium text-gray-800 dark:text-gray-100">
                      {issue.word}
                    </span>
                    <button
                      type="button"
                      onClick={() => onAddToDictionary(issue.word)}
                      className="h-6 shrink-0 rounded-md border border-gray-300 px-1.5 text-xs text-gray-600 transition-colors hover:bg-gray-100 dark:border-gray-600 dark:text-gray-300 dark:hover:bg-gray-800"
                    >
                      {t('tools.richText.spellcheckAdd')}
                    </button>
                    <button
                      type="button"
                      onClick={() => onIgnore(issue.word)}
                      className="h-6 shrink-0 rounded-md border border-gray-300 px-1.5 text-xs text-gray-600 transition-colors hover:bg-gray-100 dark:border-gray-600 dark:text-gray-300 dark:hover:bg-gray-800"
                    >
                      {t('tools.richText.spellcheckIgnore')}
                    </button>
                  </div>
                  {suggestions.length > 0 ? (
                    <div className="mt-1 flex flex-wrap gap-1">
                      {suggestions.slice(0, MAX_SUGGESTIONS).map((suggestion) => (
                        <button
                          key={suggestion}
                          type="button"
                          onClick={() => onReplace(issue, suggestion)}
                          className="rounded-md border border-blue-200 bg-blue-50 px-1.5 py-0.5 text-xs text-blue-700 transition-colors hover:bg-blue-100 dark:border-blue-800 dark:bg-blue-950/40 dark:text-blue-300 dark:hover:bg-blue-950"
                        >
                          {suggestion}
                        </button>
                      ))}
                    </div>
                  ) : dictionaryLoaded ? (
                    <p className="mt-1 text-xs text-gray-400 dark:text-gray-500">
                      {t('tools.richText.spellcheckNoSuggestion')}
                    </p>
                  ) : null}
                </li>
              );
            })}
          </ul>
        )
      ) : null}

      {userWords.length > 0 ? (
        <div className="mt-3 border-t border-gray-200 pt-2 dark:border-gray-700">
          <span className="text-xs text-gray-500 dark:text-gray-400">
            {t('tools.richText.spellcheckUserWords')} ({userWords.length})
          </span>
          <div className="mt-1 flex flex-wrap gap-1">
            {userWords.map((word) => (
              <span
                key={word}
                className="inline-flex items-center gap-1 rounded-md bg-gray-100 px-1.5 py-0.5 text-xs text-gray-600 dark:bg-gray-800 dark:text-gray-300"
              >
                {word}
                <button
                  type="button"
                  aria-label={t('tools.richText.spellcheckRemoveWord')}
                  onClick={() => onRemoveUserWord(word)}
                  className="text-gray-400 transition-colors hover:text-red-500"
                >
                  <Icon name="close" className="h-3 w-3" />
                </button>
              </span>
            ))}
          </div>
        </div>
      ) : null}
    </div>
  );
}
