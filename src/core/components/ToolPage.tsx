import { Suspense, lazy, useEffect, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import type { ToolMeta } from '@/core/types';
import { useHistoryStore } from '@/stores/history';
import { ErrorBoundary } from '@/core/components/ErrorBoundary';
import { Icon } from '@/core/components/Icon';
import { RelatedTools } from '@/core/components/RelatedTools';
import { hasToolStrings, loadToolStrings, normalizeLang, type Lang } from '@/core/i18n';
import { useToolMeta } from '@/core/i18n/helpers';
import { trackToolDuration, trackToolOpen } from '@/core/analytics';

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
 * Shared shell for every tool (tech design §6.1):
 * title, local badge, favorite, Suspense, ErrorBoundary, related tools.
 */
export function ToolPage({ tool }: { tool: ToolMeta }) {
  const LazyTool = useMemo(() => lazy(tool.component), [tool]);
  const { t, i18n } = useTranslation();
  const recordUse = useHistoryStore((s) => s.recordUse);
  const favorites = useHistoryStore((s) => s.favorites);
  const toggleFavorite = useHistoryStore((s) => s.toggleFavorite);
  const { name, description } = useToolMeta(tool);
  const isFavorite = favorites.includes(tool.id);
  const mode = tool.mode ?? 'client';
  const lang: Lang = normalizeLang(i18n.resolvedLanguage ?? 'en') ?? 'en';

  /**
   * Tool UI copy (`tools.*`) is not in the first-load bundle: it is ~82% of a locale and only tool pages need it.
   *
   * Prefetch it **in parallel** with the tool chunk: `tool.component()` kicks off the dynamic import
   * (React.lazy then reuses the same module cache, so nothing downloads twice), so copy and code travel together,
   * costing one extra cacheable chunk rather than an extra serial round trip.
   *
   * Once ready it stays true forever: switching language never falls back to the skeleton,
   * which would unmount the tool's state (an in-progress slide deck, for example).
   */
  const [stringsReady, setStringsReady] = useState(() => hasToolStrings(lang));

  useEffect(() => {
    if (stringsReady && hasToolStrings(lang)) return;
    let alive = true;
    void (async () => {
      try {
        await Promise.all([loadToolStrings(lang), tool.component()]);
      } catch (error) {
        // A copy failure falls back to a loaded language; tool chunk failures go to ErrorBoundary
        console.error('[ToolPage] 预取工具资源失败', error);
      } finally {
        if (alive) setStringsReady(true);
      }
    })();
    return () => {
      alive = false;
    };
  }, [lang, tool, stringsReady]);

  useEffect(() => {
    recordUse(tool.id);
  }, [tool, recordUse]);

  // Analytics: open and dwell time (a no-op with zero requests when no endpoint is set)
  useEffect(() => {
    trackToolOpen(tool.id);
    const startedAt = performance.now();
    return () => trackToolDuration(tool.id, Math.round(performance.now() - startedAt));
  }, [tool.id]);

  return (
    <div className="w-full px-6 py-6">
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
          {/* Placeholder until copy is ready; otherwise untranslated keys flash on screen */}
          {stringsReady ? <LazyTool /> : <ToolSkeleton />}
        </Suspense>
      </ErrorBoundary>
      <RelatedTools tool={tool} />
    </div>
  );
}
