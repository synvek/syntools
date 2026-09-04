import type { ToolMeta } from '@/core/types';

export const jwtParserTool: ToolMeta = {
  id: 'jwt-parser',
  name: 'JWT 解析',
  description: '解析 header / payload / signature，读取 exp 等时间声明（只读不验签）',
  category: 'crypto',
  keywords: ['jwt', 'token', '解析', 'parse', 'json web token', '鉴权', 'auth'],
  icon: 'key',
  component: () => import('./JwtParserTool'),
  weight: 2,
};
