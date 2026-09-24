import type { ToolMeta } from '@/core/types';

export const websocketTesterTool: ToolMeta = {
  id: 'websocket-tester',
  name: 'WebSocket 测试器',
  description: '连接 WebSocket 服务，收发文本 / 二进制消息并查看实时日志',
  category: 'network',
  keywords: ['websocket', 'ws', 'wss', '实时', '调试', '消息', '通信'],
  icon: 'plug',
  component: () => import('./WebsocketTesterTool'),
  weight: 8,
  relatedIds: ['http-request'],
};
