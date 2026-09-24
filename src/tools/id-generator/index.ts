import type { ToolMeta } from '@/core/types';

export const idGeneratorTool: ToolMeta = {
  id: 'id-generator',
  name: 'ID 生成器',
  description: '生成 ULID / NanoID / Snowflake / MongoDB ObjectId，支持批量与解析',
  category: 'generator',
  keywords: ['ulid', 'nanoid', 'snowflake', 'objectid', 'id', '唯一标识', '生成', '分布式'],
  icon: 'dice',
  component: () => import('./IdGeneratorTool'),
  relatedIds: ['uuid', 'fake-data'],
};
