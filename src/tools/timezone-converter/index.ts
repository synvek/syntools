import type { ToolMeta } from '@/core/types';

export const timezoneConverterTool: ToolMeta = {
  id: 'timezone-converter',
  name: '时区转换',
  description: '在多个 IANA 时区之间转换时间，显示本地时间与 UTC 偏移',
  category: 'datetime',
  keywords: ['timezone', '时区', 'utc', 'gmt', '时间', '转换', 'offset'],
  icon: 'globe',
  component: () => import('./TimezoneConverterTool'),
  relatedIds: ['timestamp', 'calendar'],
};
