import type { ToolMeta } from '@/core/types';

export const caesarCipherTool: ToolMeta = {
  id: 'caesar-cipher',
  name: '凯撒 / ROT13 / 栅栏',
  description: '凯撒密码、ROT13、Atbash 与栅栏密码的加密与解密',
  category: 'encoding',
  keywords: ['caesar', '凯撒', 'rot13', 'atbash', '栅栏', '密码', 'cipher'],
  icon: 'key',
  component: () => import('./CaesarCipherTool'),
  relatedIds: [],
};
