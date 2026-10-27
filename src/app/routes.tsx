import { Suspense, lazy } from 'react';
import { createBrowserRouter } from 'react-router-dom';
import { AppLayout } from '@/app/layout/AppLayout';
import { HomePage } from '@/app/HomePage';
import { NotFoundPage } from '@/app/NotFoundPage';
import { ToolPage } from '@/core/components/ToolPage';
import { tools } from '@/core/registry';

/**
 * The download page is rarely visited, so it is lazy-loaded out of the first-load bundle (195KB gate, see
 * scripts/check-bundle-size.mjs）。
 */
const DownloadPage = lazy(() =>
  import('@/app/download/DownloadPage').then((mod) => ({ default: mod.DownloadPage })),
);

/**
 * Marketing and trust pages (pricing / security / privacy / about) are lazy-loaded too:
 * they are the least visited and copy-heaviest pages, with no reason to hold first-load budget.
 * All four are also emitted as static HTML by scripts/prerender.ts, so crawlers and no-JS visits get the full text.
 */
const PricingPage = lazy(() =>
  import('@/app/marketing/PricingPage').then((mod) => ({ default: mod.PricingPage })),
);
const SecurityPage = lazy(() =>
  import('@/app/marketing/SecurityPage').then((mod) => ({ default: mod.SecurityPage })),
);
const PrivacyPage = lazy(() =>
  import('@/app/marketing/PrivacyPage').then((mod) => ({ default: mod.PrivacyPage })),
);
const AboutPage = lazy(() =>
  import('@/app/marketing/AboutPage').then((mod) => ({ default: mod.AboutPage })),
);

/** Vite BASE_URL always ends with /; React Router's basename needs a leading / and no trailing / */
function routerBasename(): string | undefined {
  const base = import.meta.env.BASE_URL;
  if (!base || base === '/') return undefined;
  return base.replace(/\/+$/, '') || undefined;
}

/**
 * Routes derive from the registry (tech design §5.3 / §6.2):
 * each tool component is lazy-loaded via React.lazy into its own chunk.
 *
 * The same children mount twice: the unprefixed tree (English, `/`, `/tools/<id>/`) and the `/zh` tree
 * (Chinese, `/zh/`, `/zh/tools/<id>/`). Language thus becomes part of the URL, so search engines
 * can index both versions; components never know which tree they are in — the language comes from
 * `core/i18n` parsing the path, with link prefixes from `useLocalizedPath()`.
 */
const appRoutes = [
  { index: true, element: <HomePage /> },
  {
    path: 'download',
    element: (
      <Suspense fallback={null}>
        <DownloadPage />
      </Suspense>
    ),
  },
  {
    path: 'pricing',
    element: (
      <Suspense fallback={null}>
        <PricingPage />
      </Suspense>
    ),
  },
  {
    path: 'security',
    element: (
      <Suspense fallback={null}>
        <SecurityPage />
      </Suspense>
    ),
  },
  {
    path: 'privacy',
    element: (
      <Suspense fallback={null}>
        <PrivacyPage />
      </Suspense>
    ),
  },
  {
    path: 'about',
    element: (
      <Suspense fallback={null}>
        <AboutPage />
      </Suspense>
    ),
  },
  ...tools.map((tool) => ({
    path: `tools/${tool.id}`,
    element: <ToolPage tool={tool} />,
  })),
  { path: '*', element: <NotFoundPage /> },
];

export const router = createBrowserRouter(
  [
    { element: <AppLayout />, children: appRoutes },
    { path: 'zh', element: <AppLayout />, children: appRoutes },
  ],
  { basename: routerBasename() },
);
