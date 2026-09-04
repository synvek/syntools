import type { ToolMeta } from '@/core/types';

export const calendarTool: ToolMeta = {
  id: 'calendar',
  name: '在线日历',
  description: '月视图：农历/节日/休班/宜忌，英文本地假日',
  category: 'datetime',
  keywords: ['calendar', '日历', '日期', 'date', 'month', '星期', '农历', '阴历', '宜忌', '节假日'],
  icon: 'calendar',
  component: () => import('./CalendarTool'),
  weight: 4,
};
