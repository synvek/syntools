import type { ToolMeta } from '@/core/types';

export const regexTesterTool: ToolMeta = {
  id: 'regex-tester',
  name: '正则表达式工具',
  description: '正则匹配高亮、替换、捕获组表格、预设与语法速查',
  category: 'text',
  keywords: ['regex', '正则', '匹配', '替换', '表达式', '验证', 'replace'],
  icon: 'regex',
  component: () => import('./RegexTesterTool'),
  weight: 1,
};
