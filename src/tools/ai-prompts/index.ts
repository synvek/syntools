import type { ToolMeta } from '@/core/types';

export const aiPromptsTool: ToolMeta = {
  id: 'ai-prompts',
  name: 'AI 提示词库',
  description: '分类常用提示词，支持搜索与一键复制',
  category: 'text',
  keywords: ['ai', 'prompt', '提示词', 'chatgpt', 'llm', '模板'],
  icon: 'ai-prompts',
  component: () => import('./AiPromptsTool'),
  weight: 22,
};
