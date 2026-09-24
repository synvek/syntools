import type { ToolMeta } from '@/core/types';

export const uaGeneratorTool: ToolMeta = {
  id: 'ua-generator',
  name: 'User-Agent 生成器',
  description: '按浏览器 / 系统组合生成 User-Agent，附常见 UA 库',
  category: 'network',
  keywords: ['user-agent', 'ua', '生成', 'browser', '请求头', '摸鱼'],
  icon: 'ua',
  component: () => import('./UaGeneratorTool'),
  weight: 5,
  relatedIds: ['ua-parser'],
};
