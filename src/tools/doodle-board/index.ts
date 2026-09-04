import type { ToolMeta } from '@/core/types';

export const doodleBoardTool: ToolMeta = {
  id: 'doodle-board',
  name: '在线涂鸦画板',
  description: '浏览器画板涂鸦，支持画笔、橡皮与导出 PNG',
  category: 'image',
  keywords: ['doodle', 'draw', 'paint', '涂鸦', '画板', 'canvas', 'sketch'],
  icon: 'pen',
  component: () => import('./DoodleBoardTool'),
  weight: 9,
};
