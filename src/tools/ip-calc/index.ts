import type { ToolMeta } from '@/core/types';

export const ipCalcTool: ToolMeta = {
  id: 'ip-calc',
  name: 'IP 计算器',
  description: 'IPv4/IPv6 地址、子网划分（VLSM）、超网与通配符掩码计算',
  category: 'network',
  keywords: ['ip', 'ipv4', 'ipv6', 'subnet', '子网', '网段', '掩码', 'cidr', 'vlsm'],
  icon: 'globe',
  component: () => import('./IpCalcTool'),
  weight: 1,
  relatedIds: ['cidr-calc', 'mac-address'],
};
