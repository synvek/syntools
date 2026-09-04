import type { ToolMeta } from '@/core/types';

export const radixConverterTool: ToolMeta = {
  id: 'radix-converter',
  name: '进制转换',
  description: '2/8/10/16 进制互转与位运算可视化，支持 64 位有符号整数',
  category: 'other',
  keywords: [
    '进制',
    '转换',
    '二进制',
    '十六进制',
    '位运算',
    'radix',
    'binary',
    'hex',
    'bitwise',
    '补码',
  ],
  icon: 'bits',
  component: () => import('./RadixConverterTool'),
  weight: 2,
};
