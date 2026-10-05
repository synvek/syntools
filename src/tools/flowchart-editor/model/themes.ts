/**
 * 主题 / 样式预设：一次性把「节点 + 连线」的成套样式应用到整图或选中元素。
 * 只覆盖预设中显式声明的字段，其余样式（字号、字体、透明度等）保持原样。
 */

import type { FlowEdgeStyle, FlowNodeStyle } from './types';

export type ThemeId = 'default' | 'business' | 'minimal' | 'dark';

export interface ThemeDef {
  id: ThemeId;
  /** 主题名的 i18n 键后缀（`tools.flowchart.theme<Key>`） */
  labelKey: string;
  /** 预览色板（面板上展示） */
  swatch: { fill: string; stroke: string; text: string };
  node: Partial<FlowNodeStyle>;
  edge: Partial<FlowEdgeStyle>;
}

export const THEMES: ThemeDef[] = [
  {
    id: 'default',
    labelKey: 'Default',
    swatch: { fill: '#EFF6FF', stroke: '#2563EB', text: '#1E293B' },
    node: {
      fill: '#EFF6FF',
      stroke: '#2563EB',
      strokeWidth: 2,
      textColor: '#1E293B',
      fontFamily: 'system-ui, sans-serif',
      opacity: 1,
      shadow: false,
      lineDash: 'solid',
    },
    edge: { stroke: '#475569', strokeWidth: 2, dash: 'solid', endArrow: 'arrowclosed' },
  },
  {
    id: 'business',
    labelKey: 'Business',
    swatch: { fill: '#DBEAFE', stroke: '#1D4ED8', text: '#1E3A8A' },
    node: {
      fill: '#DBEAFE',
      stroke: '#1D4ED8',
      strokeWidth: 2,
      textColor: '#1E3A8A',
      fontFamily: 'PingFang SC, Microsoft YaHei, sans-serif',
      opacity: 1,
      shadow: true,
      lineDash: 'solid',
    },
    edge: { stroke: '#1D4ED8', strokeWidth: 2, dash: 'solid', endArrow: 'arrowclosed' },
  },
  {
    id: 'minimal',
    labelKey: 'Minimal',
    swatch: { fill: '#FFFFFF', stroke: '#94A3B8', text: '#334155' },
    node: {
      fill: '#FFFFFF',
      stroke: '#94A3B8',
      strokeWidth: 1,
      textColor: '#334155',
      fontFamily: 'system-ui, sans-serif',
      opacity: 1,
      shadow: false,
      lineDash: 'solid',
    },
    edge: { stroke: '#94A3B8', strokeWidth: 1, dash: 'solid', endArrow: 'arrow' },
  },
  {
    id: 'dark',
    labelKey: 'Dark',
    swatch: { fill: '#1E293B', stroke: '#94A3B8', text: '#E2E8F0' },
    node: {
      fill: '#1E293B',
      stroke: '#94A3B8',
      strokeWidth: 2,
      textColor: '#E2E8F0',
      fontFamily: 'system-ui, sans-serif',
      opacity: 1,
      shadow: false,
      lineDash: 'solid',
    },
    edge: { stroke: '#CBD5E1', strokeWidth: 2, dash: 'solid', endArrow: 'arrowclosed' },
  },
];

export function themeOf(id: ThemeId): ThemeDef | undefined {
  return THEMES.find((theme) => theme.id === id);
}
