import type { ToolMeta } from '@/core/types';

export const randomPortTool: ToolMeta = {
  id: 'random-port',
  name: '随机端口与地址生成',
  description: '生成随机端口、内网 IPv4、MAC 与 IPv6 地址（可选去重与避开常见端口）',
  category: 'network',
  keywords: ['port', '端口', 'random', '随机', 'ip', 'mac', '生成'],
  icon: 'dice',
  component: () => import('./RandomPortTool'),
  weight: 9,
};
