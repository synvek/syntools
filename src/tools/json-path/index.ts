import type { ToolMeta } from '@/core/types';

export const jsonPathTool: ToolMeta = {
  id: 'json-path',
  name: 'JSONPath 查询',
  description: '简易路径查询 a.b[0].c，提取 JSON 字段',
  category: 'formatting',
  keywords: ["jsonpath","json","path","jq","查询"],
  icon: 'braces',
  component: () => import('./JsonPathTool'),
  weight: 6,
};
