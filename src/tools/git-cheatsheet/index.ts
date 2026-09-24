import type { ToolMeta } from '@/core/types';

export const gitCheatsheetTool: ToolMeta = {
  id: 'git-cheatsheet',
  name: 'Git 命令速查',
  description: '按分类整理的常用 Git 命令速查表，支持搜索',
  category: 'cheatsheet',
  keywords: ['git', '命令', '速查', 'cheatsheet', '版本控制', 'commit', 'branch'],
  icon: 'code',
  component: () => import('./GitCheatsheetTool'),
  relatedIds: ['cron-parser', 'http-status'],
};
