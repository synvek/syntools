import type { ToolMeta } from '@/core/types';

export const textCardTool: ToolMeta = {
  id: 'text-card',
  name: '文字转卡片',
  description: '将标题与正文排版成精美卡片并导出 PNG',
  category: 'generator',
  keywords: ['card', '文字卡片', '海报', 'quote', '分享图', 'text card'],
  icon: 'textCard',
  component: () => import('./TextCardTool'),
  weight: 16,
};
