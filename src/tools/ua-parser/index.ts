import type { ToolMeta } from '@/core/types';

export const uaParserTool: ToolMeta = {
  id: 'ua-parser',
  name: 'User-Agent 解析',
  description: '解析浏览器 User-Agent，识别浏览器、引擎、系统与设备',
  category: 'network',
  keywords: ['user-agent', 'ua', '浏览器', 'browser', '解析', 'navigator'],
  icon: 'ua',
  component: () => import('./UaParserTool'),
  weight: 10,
};
