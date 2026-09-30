import { Suspense, lazy, useEffect, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import type { ToolMeta } from '@/core/types';
import { useHistoryStore } from '@/stores/history';
import { ErrorBoundary } from '@/core/components/ErrorBoundary';
import { Icon } from '@/core/components/Icon';
import { RelatedTools } from '@/core/components/RelatedTools';
import { hasToolStrings, loadToolStrings, normalizeLang, type Lang } from '@/core/i18n';
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
  const { t, i18n } = useTranslation();
  const recordUse = useHistoryStore((s) => s.recordUse);
  const favorites = useHistoryStore((s) => s.favorites);
  const toggleFavorite = useHistoryStore((s) => s.toggleFavorite);
  const { name, description } = useToolMeta(tool);
  const isFavorite = favorites.includes(tool.id);
  const mode = tool.mode ?? 'client';
  const lang: Lang = normalizeLang(i18n.resolvedLanguage ?? 'en') ?? 'en';

  /**
   * 工具 UI 文案（`tools.*`）不在首屏包里，它占语言包约 82%，只有工具页需要。
   *
   * 这里与工具 chunk **并行**预取：`tool.component()` 提前触发动态 import
   * （后续 React.lazy 复用同一模块缓存，不会重复下载），文案与工具代码同时在路上，
   * 因此相比改造前只是多了一个可缓存的小 chunk，而不是多一次串行往返。
   *
   * 一旦就绪就永久为 true：语言切换时不再回落到骨架屏，
   * 否则会把工具组件的 state（例如正在编辑的幻灯片）连带卸载掉。
   */
  const [stringsReady, setStringsReady] = useState(() => hasToolStrings(lang));

  useEffect(() => {
    if (stringsReady && hasToolStrings(lang)) return;
    let alive = true;
    void (async () => {
      try {
        await Promise.all([loadToolStrings(lang), tool.component()]);
      } catch (error) {
        // 文案失败可退回已加载语言；工具 chunk 失败留给 ErrorBoundary 呈现
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
    document.title = `${name} · SynTools`;
    recordUse(tool.id);
  }, [tool, recordUse, name]);

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
          {/* 文案就绪前先占位：否则会先闪一屏未翻译的 key */}
          {stringsReady ? <LazyTool /> : <ToolSkeleton />}
        </Suspense>
      </ErrorBoundary>
      <RelatedTools tool={tool} />
    </div>
  );
}
