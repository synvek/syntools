import { createBrowserRouter } from 'react-router-dom';
import { AppLayout } from '@/app/layout/AppLayout';
import { HomePage } from '@/app/HomePage';
import { NotFoundPage } from '@/app/NotFoundPage';
import { ToolPage } from '@/core/components/ToolPage';
import { tools } from '@/core/registry';

/**
 * 路由表由注册表派生（技术设计 §5.3 / §6.2）：
 * 每个工具组件经 React.lazy 懒加载，形成独立 chunk。
 */
export const router = createBrowserRouter([
  {
    element: <AppLayout />,
    children: [
      { index: true, element: <HomePage /> },
      ...tools.map((tool) => ({
        path: `tools/${tool.id}`,
        element: <ToolPage tool={tool} />,
      })),
      { path: '*', element: <NotFoundPage /> },
    ],
  },
]);
