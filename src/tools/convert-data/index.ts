import type { ToolMeta } from '@/core/types';

export const convertDataTool: ToolMeta = {
  id: 'convert-data',
  name: '配置数据格式互转',
  description: 'YAML ⇄ JSON ⇄ TOML 任意互转，以 JS 值为中间态无损转换',
  category: 'formatting',
  keywords: ['yaml', 'json', 'toml', '转换', '互转', 'convert'],
  icon: 'swap',
  component: () => import('./ConvertDataTool'),
  weight: 2,
};
