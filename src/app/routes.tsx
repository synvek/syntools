import { Suspense, lazy } from 'react';
import { createBrowserRouter } from 'react-router-dom';
import { AppLayout } from '@/app/layout/AppLayout';
import { HomePage } from '@/app/HomePage';
import { NotFoundPage } from '@/app/NotFoundPage';
import { ToolPage } from '@/core/components/ToolPage';
import { tools } from '@/core/registry';

/**
 * 下载页很少被访问，走懒加载，不进首屏包（首屏有 195KB 预算门禁，见
 * scripts/check-bundle-size.mjs）。
 */
const DownloadPage = lazy(() =>
  import('@/app/download/DownloadPage').then((mod) => ({ default: mod.DownloadPage })),
);

/** Vite BASE_URL 恒以 / 结尾；React Router basename 需要有前导 /、无尾部 / */
function routerBasename(): string | undefined {
  const base = import.meta.env.BASE_URL;
  if (!base || base === '/') return undefined;
  return base.replace(/\/+$/, '') || undefined;
}

/**
 * 路由表由注册表派生（技术设计 §5.3 / §6.2）：
 * 每个工具组件经 React.lazy 懒加载，形成独立 chunk。
 */
export const router = createBrowserRouter(
  [
    {
      element: <AppLayout />,
      children: [
        { index: true, element: <HomePage /> },
        {
          path: 'download',
          element: (
            <Suspense fallback={null}>
              <DownloadPage />
            </Suspense>
          ),
        },
        ...tools.map((tool) => ({
          path: `tools/${tool.id}`,
          element: <ToolPage tool={tool} />,
        })),
        { path: '*', element: <NotFoundPage /> },
      ],
    },
  ],
  { basename: routerBasename() },
);
