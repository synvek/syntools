import { useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Icon } from '@/core/components/Icon';
import { countMatches, findInDoc } from '../model/search';
import { useSlideStore } from '../store';

/**
 * 查找替换浮层（底部居中）。
 *
 * 命中范围是**整个文档**（跨页），与 PowerPoint 一致：概览显示总命中数，
 * 「下一个」按顺序跨页跳转并选中目标元素，方便直接看到结果。
 */

const INPUT =
  'h-8 min-w-0 rounded-md border border-gray-300 bg-white px-2 text-[12px] text-gray-800 outline-none transition-colors focus:border-blue-500 dark:border-gray-600 dark:bg-gray-800 dark:text-gray-100';
const BTN =
  'flex h-8 items-center gap-1 rounded-md border border-gray-300 px-2 text-[12px] text-gray-600 transition-colors hover:bg-gray-100 disabled:cursor-not-allowed disabled:opacity-40 dark:border-gray-600 dark:text-gray-200 dark:hover:bg-gray-800';

export function FindReplaceBar({ onClose }: { onClose: () => void }) {
  const { t } = useTranslation();
  const doc = useSlideStore((s) => s.doc);
  const replaceAll = useSlideStore((s) => s.replaceAll);
  const goToHit = useSlideStore((s) => s.goToHit);

  const [query, setQuery] = useState('');
  const [replacement, setReplacement] = useState('');
  const [matchCase, setMatchCase] = useState(false);
  const [includeNotes, setIncludeNotes] = useState(true);
  const [cursor, setCursor] = useState(0);

  const options = useMemo(() => ({ matchCase, includeNotes }), [matchCase, includeNotes]);
  const hits = useMemo(() => findInDoc(doc, query, options), [doc, query, options]);
  const total = useMemo(() => countMatches(doc, query, options), [doc, query, options]);

  const step = (direction: 1 | -1) => {
    if (hits.length === 0) return;
    const next = (cursor + direction + hits.length) % hits.length;
    setCursor(next);
    const hit = hits[next];
    if (hit) goToHit(hit);
  };

  const handleReplaceAll = () => {
    replaceAll(query, replacement, options);
    setCursor(0);
  };

  return (
    <div className="slide-find-bar pointer-events-auto fixed bottom-4 left-1/2 z-40 flex -translate-x-1/2 items-center gap-2 rounded-xl border border-gray-200 bg-white/95 px-3 py-2 shadow-lg backdrop-blur dark:border-gray-700 dark:bg-gray-900/95">
      <Icon name="search" className="h-4 w-4 shrink-0 text-gray-400" />
      <input
        autoFocus
        value={query}
        aria-label={t('tools.slide.findLabel')}
        placeholder={t('tools.slide.findLabel')}
        onChange={(event) => {
          setQuery(event.target.value);
          setCursor(0);
        }}
        onKeyDown={(event) => {
          if (event.key === 'Enter') {
            event.preventDefault();
            step(event.shiftKey ? -1 : 1);
          }
        }}
        className={`${INPUT} w-44`}
      />
      <input
        value={replacement}
        aria-label={t('tools.slide.replaceLabel')}
        placeholder={t('tools.slide.replaceLabel')}
        onChange={(event) => setReplacement(event.target.value)}
        className={`${INPUT} w-44`}
      />

      <span className="shrink-0 text-[11px] tabular-nums text-gray-500 dark:text-gray-400">
        {hits.length > 0
          ? t('tools.slide.findProgress', {
              current: cursor + 1,
              total: hits.length,
              matches: total,
            })
          : t('tools.slide.findNone')}
      </span>

      <button type="button" className={BTN} onClick={() => step(-1)} disabled={hits.length === 0}>
        {t('tools.slide.findPrev')}
      </button>
      <button type="button" className={BTN} onClick={() => step(1)} disabled={hits.length === 0}>
        {t('tools.slide.findNext')}
      </button>
      <button type="button" className={BTN} onClick={handleReplaceAll} disabled={hits.length === 0}>
        {t('tools.slide.replaceAll')}
      </button>

      <label className="flex shrink-0 cursor-pointer items-center gap-1 text-[11px] text-gray-500 dark:text-gray-400">
        <input
          type="checkbox"
          checked={matchCase}
          onChange={(event) => setMatchCase(event.target.checked)}
          className="h-3.5 w-3.5 cursor-pointer"
        />
        {t('tools.slide.matchCase')}
      </label>
      <label className="flex shrink-0 cursor-pointer items-center gap-1 text-[11px] text-gray-500 dark:text-gray-400">
        <input
          type="checkbox"
          checked={includeNotes}
          onChange={(event) => setIncludeNotes(event.target.checked)}
          className="h-3.5 w-3.5 cursor-pointer"
        />
        {t('tools.slide.includeNotes')}
      </label>

      <button
        type="button"
        onClick={onClose}
        aria-label={t('tools.slide.findClose')}
        className="flex h-7 w-7 shrink-0 items-center justify-center rounded-md text-gray-400 transition-colors hover:bg-gray-100 hover:text-gray-600 dark:hover:bg-gray-800"
      >
        <Icon name="close" className="h-4 w-4" />
      </button>
    </div>
  );
}
