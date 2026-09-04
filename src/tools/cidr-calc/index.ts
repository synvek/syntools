import type { ToolMeta } from '@/core/types';

export const cidrCalcTool: ToolMeta = {
  id: 'cidr-calc',
  name: 'CIDR 计算器',
  description: 'IPv4 CIDR：网络 / 广播 / 主机范围 / 掩码 / 主机数',
  category: 'network',
  keywords: ["cidr","subnet","ipv4","子网","掩码","network"],
  icon: 'globe',
  component: () => import('./CidrCalcTool'),
  weight: 2,
};
