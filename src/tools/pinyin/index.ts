import type { ToolMeta } from '@/core/types';

export const pinyinTool: ToolMeta = {
  id: 'pinyin',
  name: '汉字转拼音',
  description: '将汉字转换为拼音，支持声调、分隔符与大小写',
  category: 'text',
  keywords: ['pinyin', '拼音', '汉字', 'chinese', 'hanzi', '转换', '声调', 'tone'],
  icon: 'pinyin',
  component: () => import('./PinyinTool'),
  weight: 6,
};
