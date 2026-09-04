import type { ToolMeta } from '@/core/types';

export const jsonFormatTool: ToolMeta = {
  id: 'json-format',
  name: 'JSON 格式化',
  description: '格式化 / 压缩 / 校验，2/4 缩进可选，解析错误行列定位',
  category: 'formatting',
  keywords: ['json', '格式化', '压缩', '校验', 'validate', 'pretty'],
  icon: 'braces',
  component: () => import('./JsonFormatTool'),
  weight: 1,
};
