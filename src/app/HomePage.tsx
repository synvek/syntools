import { useEffect } from 'react';
import { Link } from 'react-router-dom';
import { Trans, useTranslation } from 'react-i18next';
import type { ToolMeta } from '@/core/types';
import { tools, toolMap } from '@/core/registry';
import { categories } from '@/core/registry/categories';
import { useHistoryStore } from '@/stores/history';
import { Icon } from '@/core/components/Icon';
import { useToolMeta } from '@/core/i18n/helpers';

function ToolCard({ tool }: { tool: ToolMeta }) {
  const { t } = useTranslation();
  const { name, description } = useToolMeta(tool);
  const favorites = useHistoryStore((s) => s.favorites);
  const toggleFavorite = useHistoryStore((s) => s.toggleFavorite);
  const isFavorite = favorites.includes(tool.id);

  return (
    <Link
      to={`/tools/${tool.id}`}
      className="group relative flex items-start gap-3 rounded-lg border border-gray-200 bg-white p-4 hover:border-blue-300 hover:shadow-sm dark:border-gray-800 dark:bg-gray-900 dark:hover:border-blue-700"
    >
      <Icon
        name={tool.icon}
        className="mt-0.5 h-6 w-6 shrink-0 text-gray-400 group-hover:text-blue-600 dark:group-hover:text-blue-400"
      />
      <div className="min-w-0">
        <p className="font-medium">{name}</p>
        <p className="mt-0.5 line-clamp-2 text-xs text-gray-500 dark:text-gray-400">
          {description}
        </p>
      </div>
      <button
        type="button"
        aria-label={t(isFavorite ? 'home.unfavoriteAria' : 'home.favoriteAria')}
        onClick={(e) => {
          e.preventDefault();
          toggleFavorite(tool.id);
        }}
        className={`absolute right-2 top-2 rounded p-1 ${
          isFavorite
            ? 'text-amber-500'
            : 'text-gray-300 opacity-0 hover:text-amber-500 group-hover:opacity-100 dark:text-gray-600'
        }`}
      >
        <Icon name="star" className="h-4 w-4" />
      </button>
    </Link>
  );
}

function ToolGrid({ items }: { items: ToolMeta[] }) {
  return (
    <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-3">
      {items.map((tool) => (
        <ToolCard key={tool.id} tool={tool} />
      ))}
    </div>
  );
}

export function HomePage() {
  const { t } = useTranslation();
  const recentIds = useHistoryStore((s) => s.recent);
  const favoriteIds = useHistoryStore((s) => s.favorites);

  useEffect(() => {
    document.title = t('app.docTitle');
  }, [t]);

  const recent = recentIds.map((id) => toolMap.get(id)).filter((t): t is ToolMeta => Boolean(t));
  const favorites = favoriteIds
    .map((id) => toolMap.get(id))
    .filter((t): t is ToolMeta => Boolean(t));

  return (
    <div className="mx-auto w-full max-w-5xl px-4 py-8">
      <h1 className="text-2xl font-bold">{t('home.title')}</h1>
      <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">
        <Trans
          i18nKey="home.tagline"
          components={{
            1: <kbd className="rounded border border-gray-300 px-1 text-xs dark:border-gray-600" />,
            3: <kbd className="rounded border border-gray-300 px-1 text-xs dark:border-gray-600" />,
          }}
        />
      </p>

      {favorites.length > 0 && (
        <section className="mt-8">
          <h2 className="mb-3 text-sm font-semibold text-gray-500 dark:text-gray-400">
            {t('home.favorites')}
          </h2>
          <ToolGrid items={favorites} />
        </section>
      )}

      {recent.length > 0 && (
        <section className="mt-8">
          <h2 className="mb-3 text-sm font-semibold text-gray-500 dark:text-gray-400">
            {t('home.recent')}
          </h2>
          <ToolGrid items={recent} />
        </section>
      )}

      {categories.map((category) => {
        const items = tools
          .filter((t) => t.category === category.id)
          .sort((a, b) => (a.weight ?? 0) - (b.weight ?? 0));
        if (items.length === 0) return null;
        return (
          <section key={category.id} className="mt-8">
            <h2 className="mb-3 text-sm font-semibold text-gray-500 dark:text-gray-400">
              {t(`categories.${category.id}`)}
            </h2>
            <ToolGrid items={items} />
          </section>
        );
      })}
    </div>
  );
}
