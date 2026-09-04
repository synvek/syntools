import type { ToolMeta } from '@/core/types';

export const countdownTool: ToolMeta = {
  id: 'countdown',
  name: '在线倒计时器',
  description: '设置时分秒倒计时，支持暂停、继续与结束提示',
  category: 'datetime',
  keywords: ['countdown', '倒计时', 'timer', '计时', '闹钟'],
  icon: 'countdown',
  component: () => import('./CountdownTool'),
  weight: 12,
};
