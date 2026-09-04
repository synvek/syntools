import { Suspense, lazy, useEffect, useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import type { ToolMeta } from '@/core/types';
import { useHistoryStore } from '@/stores/history';
import { ErrorBoundary } from '@/core/components/ErrorBoundary';
import { Icon } from '@/core/components/Icon';
import { RelatedTools } from '@/core/components/RelatedTools';
import { useToolMeta } from '@/core/i18n/helpers';

function ToolSkeleton() {
  const { t } = useTranslation();
  return (
    <div className="animate-pulse space-y-3" aria-label={t('common.loading')}>
      <div className="h-32 rounded-lg bg-gray-200 dark:bg-gray-800" />
      <div className="h-32 rounded-lg bg-gray-200 dark:bg-gray-800" />
    </div>
  );
}

/**
 * 所有工具的统一外壳（技术设计 §6.1）：
 * 标题渲染、本地徽章、收藏、Suspense、ErrorBoundary、相关推荐。
 */
export function ToolPage({ tool }: { tool: ToolMeta }) {
  const LazyTool = useMemo(() => lazy(tool.component), [tool]);
  const { t } = useTranslation();
  const recordUse = useHistoryStore((s) => s.recordUse);
  const favorites = useHistoryStore((s) => s.favorites);
  const toggleFavorite = useHistoryStore((s) => s.toggleFavorite);
  const { name, description } = useToolMeta(tool);
  const isFavorite = favorites.includes(tool.id);
  const mode = tool.mode ?? 'client';

  useEffect(() => {
    document.title = `${name} · SynTools`;
    recordUse(tool.id);
  }, [tool, recordUse, name]);

  return (
    <div className="mx-auto w-full max-w-5xl px-4 py-6">
      <header className="mb-6 flex items-start gap-3">
        <Icon
          name={tool.icon}
          className="mt-0.5 h-8 w-8 shrink-0 text-blue-600 dark:text-blue-400"
        />
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <h1 className="text-xl font-bold">{name}</h1>
            {mode === 'client' ? (
              <span className="rounded-md bg-emerald-50 px-2 py-0.5 text-xs font-medium text-emerald-700 dark:bg-emerald-950 dark:text-emerald-300">
                {t('tool.localBadge')}
              </span>
            ) : (
              <span className="rounded-md bg-amber-50 px-2 py-0.5 text-xs font-medium text-amber-700 dark:bg-amber-950 dark:text-amber-300">
                {t('tool.serverBadge')}
              </span>
            )}
            <button
              type="button"
              aria-label={t(isFavorite ? 'home.unfavoriteAria' : 'home.favoriteAria')}
              onClick={() => toggleFavorite(tool.id)}
              className={`rounded p-1 ${
                isFavorite
                  ? 'text-amber-500'
                  : 'text-gray-300 hover:text-amber-500 dark:text-gray-600'
              }`}
            >
              <Icon name="star" className="h-5 w-5" />
            </button>
          </div>
          <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">{description}</p>
        </div>
      </header>
      <ErrorBoundary key={tool.id}>
        <Suspense fallback={<ToolSkeleton />}>
          <LazyTool />
        </Suspense>
      </ErrorBoundary>
      <RelatedTools tool={tool} />
    </div>
  );
}
