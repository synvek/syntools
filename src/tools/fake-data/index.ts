import type { ToolMeta } from '@/core/types';

export const fakeDataTool: ToolMeta = {
  id: 'fake-data',
  name: '假数据生成',
  description: '生成姓名 / 邮箱 / UUID / 段落，中英模板，1–50 条',
  category: 'generator',
  keywords: ["fake","mock","lorem","假数据","测试数据","uuid"],
  icon: 'dice',
  component: () => import('./FakeDataTool'),
  weight: 8,
};
