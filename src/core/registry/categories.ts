import type { CategoryId } from '@/core/types';

export interface Category {
  id: CategoryId;
  name: string;
  /** 侧边栏展示顺序，升序 */
  order: number;
}

export const categories: Category[] = [
  { id: 'encoding', name: '编码转换', order: 1 },
  { id: 'text', name: '文本处理', order: 2 },
  { id: 'formatting', name: '格式化', order: 3 },
  { id: 'crypto', name: '加密哈希', order: 4 },
  { id: 'datetime', name: '时间日期', order: 5 },
  { id: 'generator', name: '生成器', order: 6 },
  { id: 'network', name: '网络', order: 7 },
  { id: 'image', name: '图片处理', order: 8 },
  { id: 'pdf', name: 'PDF 工具', order: 9 },
  { id: 'other', name: '其他', order: 10 },
];
