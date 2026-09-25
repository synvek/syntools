import type { ToolMeta } from '@/core/types';

export const baseEncodingTool: ToolMeta = {
  id: 'base-encoding',
  name: 'Base 系列编码',
  description: 'Base16/32/32Hex/58/64/64URL 编码与解码（纯前端，零依赖）',
  category: 'encoding',
  keywords: ['base64', 'base32', 'base58', 'base16', '编码', '解码', 'hex'],
  icon: 'binary',
  component: () => import('./BaseEncodingTool'),
  relatedIds: ['base64', 'url-codec'],
};
