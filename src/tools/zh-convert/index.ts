import type { ToolMeta } from '@/core/types';

export const zhConvertTool: ToolMeta = {
  id: 'zh-convert',
  name: '繁体字转换',
  description: '简体与繁体中文互相转换',
  category: 'text',
  keywords: ['繁体', '简体', 'traditional', 'simplified', 'chinese', 'opencc', '转换'],
  icon: 'zh',
  component: () => import('./ZhConvertTool'),
  weight: 7,
};
