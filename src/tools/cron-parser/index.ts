import type { ToolMeta } from '@/core/types';

export const cronParserTool: ToolMeta = {
  id: 'cron-parser',
  name: 'Cron 表达式解析',
  description: '校验 Cron 表达式，字段含义解读与未来执行时间预览',
  category: 'datetime',
  keywords: ['cron', 'crontab', '定时', '调度', '表达式', 'schedule'],
  icon: 'clock',
  component: () => import('./CronParserTool'),
  weight: 2,
};
