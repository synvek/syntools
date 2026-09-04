import { useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { searchTools } from '@/core/lib/search';
import { Icon } from '@/core/components/Icon';
import { getToolMeta } from '@/core/i18n/helpers';

interface SearchPaletteProps {
  open: boolean;
  onClose: () => void;
}

/** 全局搜索面板（⌘K / /，技术设计 §7.3），ARIA combobox 模式 */
export function SearchPalette({ open, onClose }: SearchPaletteProps) {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const [query, setQuery] = useState('');
  const [active, setActive] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);
  const results = useMemo(() => searchTools(query).slice(0, 12), [query]);

  useEffect(() => {
    if (open) {
      setQuery('');
      setActive(0);
      // 等待面板渲染后聚焦
      requestAnimationFrame(() => inputRef.current?.focus());
    }
  }, [open]);

  useEffect(() => setActive(0), [query]);

  if (!open) return null;

  const goTo = (id: string) => {
    onClose();
    navigate(`/tools/${id}`);
  };

  const onKeyDown = (e: React.KeyboardEvent) => {
    switch (e.key) {
      case 'ArrowDown':
        e.preventDefault();
        setActive((i) => Math.min(i + 1, results.length - 1));
        break;
      case 'ArrowUp':
        e.preventDefault();
        setActive((i) => Math.max(i - 1, 0));
        break;
      case 'Enter':
        e.preventDefault();
        if (results[active]) goTo(results[active].id);
        break;
      case 'Escape':
        onClose();
        break;
    }
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-start justify-center bg-black/40 p-4 pt-[12vh]"
      onClick={onClose}
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-label={t('search.aria')}
        onClick={(e) => e.stopPropagation()}
        className="w-full max-w-lg overflow-hidden rounded-xl border border-gray-200 bg-white shadow-2xl dark:border-gray-700 dark:bg-gray-900"
      >
        <div className="flex items-center gap-2 border-b border-gray-200 px-4 dark:border-gray-700">
          <Icon name="search" className="h-4 w-4 shrink-0 text-gray-400" />
          <input
            ref={inputRef}
            role="combobox"
            aria-expanded="true"
            aria-controls="search-listbox"
            aria-activedescendant={
              results[active] ? `search-option-${results[active].id}` : undefined
            }
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            onKeyDown={onKeyDown}
            placeholder={t('search.placeholder')}
            className="h-12 w-full bg-transparent text-sm focus:outline-none"
          />
          <kbd className="rounded border border-gray-300 px-1.5 py-0.5 text-xs text-gray-400 dark:border-gray-600">
            Esc
          </kbd>
        </div>
        <ul id="search-listbox" role="listbox" className="max-h-80 overflow-y-auto p-2">
          {results.length === 0 && (
            <li className="px-3 py-6 text-center text-sm text-gray-400">{t('search.empty')}</li>
          )}
          {results.map((tool, i) => {
            const { name, description } = getToolMeta(tool);
            return (
              <li
                key={tool.id}
                id={`search-option-${tool.id}`}
                role="option"
                aria-selected={i === active}
                onMouseEnter={() => setActive(i)}
                onClick={() => goTo(tool.id)}
                className={`flex cursor-pointer items-center gap-3 rounded-lg px-3 py-2.5 ${
                  i === active ? 'bg-blue-50 dark:bg-blue-950' : ''
                }`}
              >
                <Icon name={tool.icon} className="h-5 w-5 shrink-0 text-gray-400" />
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-medium">{name}</p>
                  <p className="truncate text-xs text-gray-400">{description}</p>
                </div>
                <span className="shrink-0 text-xs text-gray-400">
                  {t(`categories.${tool.category}`)}
                </span>
              </li>
            );
          })}
        </ul>
      </div>
    </div>
  );
}
