import type { ToolMeta } from '@/core/types';

export const cronGeneratorTool: ToolMeta = {
  id: 'cron-generator',
  name: '在线 Crontab 生成',
  description: '可视化配置分/时/日/月/周字段，生成标准 5 段 Cron 表达式',
  category: 'datetime',
  keywords: ['cron', 'crontab', '生成', '定时', 'schedule', 'generator'],
  icon: 'cronGen',
  component: () => import('./CronGeneratorTool'),
  weight: 3,
};
