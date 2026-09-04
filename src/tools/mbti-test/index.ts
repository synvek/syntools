import type { ToolMeta } from '@/core/types';

export const mbtiTestTool: ToolMeta = {
  id: 'mbti-test',
  name: 'MBTI 在线性格测试',
  description: '24 题简易 MBTI 测试，得出 16 型人格倾向（仅供娱乐参考）',
  category: 'other',
  keywords: ['mbti', '性格', '人格', '16型', 'personality', '测试'],
  icon: 'mbti',
  component: () => import('./MbtiTestTool'),
  weight: 25,
};
