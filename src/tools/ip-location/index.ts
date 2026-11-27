import type { ToolMeta } from '@/core/types';

export const ipLocationTool: ToolMeta = {
  id: 'ip-location',
  name: 'IP 归属地',
  description: '查看当前访客的 IP、国家/省份/城市与运营商（联通 / 电信 / 移动）',
  category: 'network',
  keywords: [
    'ip',
    'ip 归属地',
    'ip location',
    'geo',
    'country',
    'province',
    'city',
    '运营商',
    'isp',
    'asn',
  ],
  icon: 'globe',
  // 需要同源的 /api/ip-info：仅在 PLUS_MODE 构建里注册（见 src/core/config/plusMode.ts）
  mode: 'server',
  weight: 12,
  relatedIds: ['ip-calc', 'ua-parser'],
  component: () => import('./IpLocationTool'),
};
