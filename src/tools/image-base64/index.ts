import type { ToolMeta } from '@/core/types';

export const imageBase64Tool: ToolMeta = {
  id: 'image-base64',
  name: '图片 ↔ Base64',
  description: '图片与 Base64 / Data URL 互转，本地完成',
  category: 'image',
  keywords: ['base64', '图片', 'image', 'dataurl', 'data url', '编码', '解码'],
  icon: 'image-base64',
  component: () => import('./ImageBase64Tool'),
  weight: 20,
};
