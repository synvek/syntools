import type { ToolMeta } from '@/core/types';

export const stopwatchTool: ToolMeta = {
  id: 'stopwatch',
  name: '秒表',
  description: '在线秒表，支持开始、暂停、计圈与重置',
  category: 'datetime',
  keywords: ['stopwatch', '秒表', '计时', 'lap', '计圈'],
  icon: 'stopwatch',
  component: () => import('./StopwatchTool'),
  weight: 13,
};
