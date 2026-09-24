import type { ToolMeta } from '@/core/types';

export const csvTool: ToolMeta = {
  id: 'csv-tool',
  name: 'CSV 工具',
  description: 'CSV ↔ JSON 互转，支持自定义分隔符、表头与引号转义（RFC 4180）',
  category: 'formatting',
  keywords: ['csv', 'json', '表格', '转换', 'convert', 'delimiter', '分隔符'],
  icon: 'table',
  component: () => import('./CsvTool'),
  relatedIds: ['json-convert', 'convert-data'],
};
