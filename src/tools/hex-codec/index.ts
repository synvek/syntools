import type { ToolMeta } from '@/core/types';

export const hexCodecTool: ToolMeta = {
  id: 'hex-codec',
  name: 'Hex 编解码',
  description: 'Hex ↔ UTF-8 文本，可选空格分隔',
  category: 'encoding',
  keywords: ["hex","十六进制","encode","decode","binary"],
  icon: 'binary',
  component: () => import('./HexCodecTool'),
  weight: 5,
};
