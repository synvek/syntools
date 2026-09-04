import { Link } from 'react-router-dom';
import { useTranslation } from 'react-i18next';

export function NotFoundPage() {
  const { t } = useTranslation();
  return (
    <div className="flex min-h-[60vh] flex-col items-center justify-center gap-3 px-4 text-center">
      <p className="text-5xl font-bold text-gray-300 dark:text-gray-700">404</p>
      <p className="text-gray-600 dark:text-gray-400">{t('notFound.message')}</p>
      <Link
        to="/"
        className="rounded-lg border border-gray-300 px-4 py-2 text-sm hover:bg-gray-100 dark:border-gray-700 dark:hover:bg-gray-800"
      >
        {t('notFound.back')}
      </Link>
    </div>
  );
}
