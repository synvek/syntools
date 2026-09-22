/**
 * 脑图主题（XMind 风格）：一套主题同时定义「中心主题 / 一级分支 / 二级及以下」
 * 的形状、填充、描边与文字样式，以及分支配色循环与连线粗细。
 * 展示名走 i18n 键 `tools.mindmap.theme_<id>`，此处只存样式数据。
 */

import type { MindNodeShape, MindNodeStyle } from './types';

/** 取色占位：'branch' 表示使用所属分支的颜色 */
export const BRANCH = 'branch';

export interface MindLevelStyle {
  shape: MindNodeShape;
  /** 'transparent' 表示不填充 */
  fill: string;
  stroke: string;
  textColor: string;
  fontSize: number;
  bold: boolean;
}

export interface MindTheme {
  id: string;
  /** 中心主题 */
  root: MindLevelStyle;
  /** 一级分支 */
  main: MindLevelStyle;
  /** 二级及以下 */
  sub: MindLevelStyle;
  /** 一级分支按顺序循环取色（同时作为该分支连线的颜色） */
  branches: string[];
  /** 主干连线粗细 */
  lineWidth: number;
  /** 画布底色（导出时的背景） */
  background: string;
}

export const DEFAULT_THEME_ID = 'classic';

export const MIND_THEMES: MindTheme[] = [
  {
    // 经典蓝：中心实心胶囊 + 白底彩边一级分支 + 下划线叶子
    id: 'classic',
    root: {
      shape: 'pill',
      fill: '#1D4ED8',
      stroke: '#1E3A8A',
      textColor: '#FFFFFF',
      fontSize: 16,
      bold: true,
    },
    main: {
      shape: 'rounded',
      fill: '#FFFFFF',
      stroke: BRANCH,
      textColor: BRANCH,
      fontSize: 14,
      bold: true,
    },
    sub: {
      shape: 'underline',
      fill: 'transparent',
      stroke: BRANCH,
      textColor: '#374151',
      fontSize: 13,
      bold: false,
    },
    branches: ['#2563EB', '#0EA5E9', '#7C3AED', '#16A34A', '#F59E0B', '#DC2626'],
    lineWidth: 3,
    background: '#FFFFFF',
  },
  {
    // 森林绿：中心圆角实心，一级分支浅绿填充
    id: 'forest',
    root: {
      shape: 'rounded',
      fill: '#15803D',
      stroke: '#14532D',
      textColor: '#FFFFFF',
      fontSize: 16,
      bold: true,
    },
    main: {
      shape: 'pill',
      fill: '#ECFDF5',
      stroke: BRANCH,
      textColor: '#065F46',
      fontSize: 14,
      bold: true,
    },
    sub: {
      shape: 'underline',
      fill: 'transparent',
      stroke: BRANCH,
      textColor: '#374151',
      fontSize: 13,
      bold: false,
    },
    branches: ['#16A34A', '#0D9488', '#65A30D', '#059669', '#0891B2', '#CA8A04'],
    lineWidth: 3,
    background: '#FFFFFF',
  },
  {
    // 暖阳橙：一级分支用分支色实心 + 白字
    id: 'sunset',
    root: {
      shape: 'pill',
      fill: '#C2410C',
      stroke: '#7C2D12',
      textColor: '#FFFFFF',
      fontSize: 16,
      bold: true,
    },
    main: {
      shape: 'rounded',
      fill: BRANCH,
      stroke: BRANCH,
      textColor: '#FFFFFF',
      fontSize: 14,
      bold: true,
    },
    sub: {
      shape: 'underline',
      fill: 'transparent',
      stroke: BRANCH,
      textColor: '#374151',
      fontSize: 13,
      bold: false,
    },
    branches: ['#F97316', '#F59E0B', '#EF4444', '#DB2777', '#E11D48', '#D97706'],
    lineWidth: 3,
    background: '#FFFFFF',
  },
  {
    // 葡萄紫：中心椭圆，一级分支圆角描边
    id: 'grape',
    root: {
      shape: 'ellipse',
      fill: '#6D28D9',
      stroke: '#4C1D95',
      textColor: '#FFFFFF',
      fontSize: 16,
      bold: true,
    },
    main: {
      shape: 'rounded',
      fill: '#F5F3FF',
      stroke: BRANCH,
      textColor: '#5B21B6',
      fontSize: 14,
      bold: true,
    },
    sub: {
      shape: 'underline',
      fill: 'transparent',
      stroke: BRANCH,
      textColor: '#374151',
      fontSize: 13,
      bold: false,
    },
    branches: ['#7C3AED', '#8B5CF6', '#6366F1', '#D946EF', '#2563EB', '#A855F7'],
    lineWidth: 3,
    background: '#FFFFFF',
  },
  {
    // 石墨灰：中性商务风，一级分支矩形浅灰填充
    id: 'slate',
    root: {
      shape: 'rect',
      fill: '#111827',
      stroke: '#030712',
      textColor: '#FFFFFF',
      fontSize: 16,
      bold: true,
    },
    main: {
      shape: 'rect',
      fill: '#F3F4F6',
      stroke: BRANCH,
      textColor: '#111827',
      fontSize: 14,
      bold: true,
    },
    sub: {
      shape: 'underline',
      fill: 'transparent',
      stroke: BRANCH,
      textColor: '#374151',
      fontSize: 13,
      bold: false,
    },
    branches: ['#334155', '#475569', '#0F766E', '#57534E', '#3F3F46', '#1E40AF'],
    lineWidth: 2.5,
    background: '#FFFFFF',
  },
  {
    // 糖果粉：圆润轻盈
    id: 'candy',
    root: {
      shape: 'pill',
      fill: '#DB2777',
      stroke: '#9D174D',
      textColor: '#FFFFFF',
      fontSize: 16,
      bold: true,
    },
    main: {
      shape: 'pill',
      fill: '#FDF2F8',
      stroke: BRANCH,
      textColor: '#9D174D',
      fontSize: 14,
      bold: true,
    },
    sub: {
      shape: 'underline',
      fill: 'transparent',
      stroke: BRANCH,
      textColor: '#374151',
      fontSize: 13,
      bold: false,
    },
    branches: ['#EC4899', '#F472B6', '#A855F7', '#38BDF8', '#FB7185', '#818CF8'],
    lineWidth: 3,
    background: '#FFFFFF',
  },
  {
    // 极简黑白：仅靠形状与层级区分，无彩色
    id: 'mono',
    root: {
      shape: 'rect',
      fill: '#111827',
      stroke: '#111827',
      textColor: '#FFFFFF',
      fontSize: 16,
      bold: true,
    },
    main: {
      shape: 'underline',
      fill: 'transparent',
      stroke: '#111827',
      textColor: '#111827',
      fontSize: 14,
      bold: true,
    },
    sub: {
      shape: 'underline',
      fill: 'transparent',
      stroke: '#6B7280',
      textColor: '#4B5563',
      fontSize: 13,
      bold: false,
    },
    branches: ['#111827', '#374151', '#4B5563', '#1F2937', '#6B7280', '#0F172A'],
    lineWidth: 2,
    background: '#FFFFFF',
  },
  {
    // 霓虹：深色中心 + 高饱和分支，一级分支实心彩色
    id: 'neon',
    root: {
      shape: 'rounded',
      fill: '#0F172A',
      stroke: '#020617',
      textColor: '#F8FAFC',
      fontSize: 16,
      bold: true,
    },
    main: {
      shape: 'pill',
      fill: BRANCH,
      stroke: BRANCH,
      textColor: '#0F172A',
      fontSize: 14,
      bold: true,
    },
    sub: {
      shape: 'underline',
      fill: 'transparent',
      stroke: BRANCH,
      textColor: '#374151',
      fontSize: 13,
      bold: false,
    },
    branches: ['#22D3EE', '#A3E635', '#F472B6', '#FBBF24', '#818CF8', '#34D399'],
    lineWidth: 3.5,
    background: '#FFFFFF',
  },
];

export const MIND_THEME_IDS: string[] = MIND_THEMES.map((t) => t.id);

export function themeOf(id: string): MindTheme {
  return MIND_THEMES.find((t) => t.id === id) ?? MIND_THEMES[0];
}

/** 一级分支取色：同一父级下按序号循环，保证相邻分支不同色 */
export function branchColorOf(theme: MindTheme, index: number): string {
  return theme.branches[index % theme.branches.length];
}

function levelOf(theme: MindTheme, depth: number): MindLevelStyle {
  return depth === 0 ? theme.root : depth === 1 ? theme.main : theme.sub;
}

/** 未显式指定样式时的默认外观：按主题与层级推导 */
export function defaultStyleOf(
  theme: MindTheme,
  depth: number,
  branchColor: string,
): MindNodeStyle {
  const level = levelOf(theme, depth);
  const pick = (value: string) => (value === BRANCH ? branchColor : value);
  return {
    fill: pick(level.fill),
    stroke: pick(level.stroke),
    textColor: pick(level.textColor),
    fontSize: level.fontSize,
    bold: level.bold,
    italic: false,
    align: 'center',
  };
}

/** 节点未显式指定形状时的默认形状（随主题与层级变化） */
export function defaultShapeOf(theme: MindTheme, depth: number): MindNodeShape {
  return levelOf(theme, depth).shape;
}
