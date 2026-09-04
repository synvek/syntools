import type { ToolMeta } from '@/core/types';

export const timestampTool: ToolMeta = {
  id: 'timestamp',
  name: '时间戳转换',
  description: 'Unix ⇄ 可读时间，秒/毫秒自动识别，实时走秒与时区展示',
  category: 'datetime',
  keywords: ['timestamp', '时间戳', 'unix', 'epoch', '日期', '时间'],
  icon: 'clock',
  component: () => import('./TimestampTool'),
  weight: 1,
};
