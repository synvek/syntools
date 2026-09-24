import type { ToolMeta } from '@/core/types';

export const macAddressTool: ToolMeta = {
  id: 'mac-address',
  name: 'MAC 地址工具',
  description: 'MAC 地址格式化、厂商（OUI）查询、EUI-64 与随机批量生成',
  category: 'network',
  keywords: ['mac', 'mac地址', 'oui', '厂商', 'eui64', '物理地址', 'bssid'],
  icon: 'binary',
  component: () => import('./MacAddressTool'),
  weight: 3,
  relatedIds: ['ip-calc'],
};
