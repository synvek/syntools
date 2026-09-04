import type { ToolMeta } from '@/core/types';

export const sampleTool: ToolMeta = {
  id: 'sample',
  name: '示例工具',
  description: '演示 SynTools 工具接入契约的示例（M2 阶段可移除）',
  category: 'text',
  keywords: ['sample', 'demo', '示例', '演示'],
  icon: 'text',
  component: () => import('./SampleTool'),
  weight: 99,
};
