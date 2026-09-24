import type { ToolMeta } from '@/core/types';

export const escapeUnescapeTool: ToolMeta = {
  id: 'escape-unescape',
  name: '转义 / 反转义',
  description: 'JSON / JS / HTML / XML / URL 的转义与反转义',
  category: 'encoding',
  keywords: ['escape', '转义', 'html', 'xml', 'json', 'url', '实体'],
  icon: 'code',
  component: () => import('./EscapeUnescapeTool'),
  relatedIds: [],
};
