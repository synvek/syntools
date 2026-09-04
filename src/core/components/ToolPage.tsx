import { Suspense, lazy, useEffect, useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import type { ToolMeta } from '@/core/types';
import { useHistoryStore } from '@/stores/history';
import { ErrorBoundary } from '@/core/components/ErrorBoundary';
import { Icon } from '@/core/components/Icon';
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
 * 标题渲染、Suspense 加载态、ErrorBoundary 兜底、document.title 与最近使用记录。
 */
export function ToolPage({ tool }: { tool: ToolMeta }) {
  const LazyTool = useMemo(() => lazy(tool.component), [tool]);
  const recordUse = useHistoryStore((s) => s.recordUse);
  const { name, description } = useToolMeta(tool);

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
        <div>
          <h1 className="text-xl font-bold">{name}</h1>
          <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">{description}</p>
        </div>
      </header>
      <ErrorBoundary key={tool.id}>
        <Suspense fallback={<ToolSkeleton />}>
          <LazyTool />
        </Suspense>
      </ErrorBoundary>
    </div>
  );
}
