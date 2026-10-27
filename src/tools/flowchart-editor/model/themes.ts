/**
 * Theme / style presets: apply a complete set of node + edge styles to the whole diagram or the selection in one go.
 * Only the fields a preset declares explicitly are overridden; other styles (font size, family, opacity, etc.) stay as they are.
 */

import type { FlowEdgeStyle, FlowNodeStyle } from './types';

export type ThemeId =
  | 'default'
  | 'business'
  | 'minimal'
  | 'dark'
  /* The following are the 16 extended color presets */
  | 'ocean'
  | 'mint'
  | 'forest'
  | 'sunset'
  | 'amber'
  | 'rose'
  | 'candy'
  | 'violet'
  | 'indigo'
  | 'slate'
  | 'ink'
  | 'sketch'
  | 'blueprint'
  | 'terminal'
  | 'neon'
  | 'kraft';

export interface ThemeDef {
  id: ThemeId;
  /** i18n key suffix of the theme name (`tools.flowchart.theme<Key>`) */
  labelKey: string;
  /** Preview palette (shown in the panel) */
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
  /* ------------------------- Extended color schemes (16) ------------------------- */
  {
    id: 'ocean',
    labelKey: 'Ocean',
    swatch: { fill: '#E0F2FE', stroke: '#0284C7', text: '#0C4A6E' },
    node: {
      fill: '#E0F2FE',
      stroke: '#0284C7',
      strokeWidth: 2,
      textColor: '#0C4A6E',
      fontFamily: 'system-ui, sans-serif',
      opacity: 1,
      shadow: false,
      lineDash: 'solid',
    },
    edge: { stroke: '#0284C7', strokeWidth: 2, dash: 'solid', endArrow: 'arrowclosed' },
  },
  {
    id: 'mint',
    labelKey: 'Mint',
    swatch: { fill: '#ECFDF5', stroke: '#10B981', text: '#065F46' },
    node: {
      fill: '#ECFDF5',
      stroke: '#10B981',
      strokeWidth: 2,
      textColor: '#065F46',
      fontFamily: 'system-ui, sans-serif',
      opacity: 1,
      shadow: false,
      lineDash: 'solid',
    },
    edge: { stroke: '#059669', strokeWidth: 2, dash: 'solid', endArrow: 'arrowclosed' },
  },
  {
    id: 'forest',
    labelKey: 'Forest',
    swatch: { fill: '#DCFCE7', stroke: '#15803D', text: '#14532D' },
    node: {
      fill: '#DCFCE7',
      stroke: '#15803D',
      strokeWidth: 2,
      textColor: '#14532D',
      fontFamily: 'system-ui, sans-serif',
      opacity: 1,
      shadow: false,
      lineDash: 'solid',
    },
    edge: { stroke: '#166534', strokeWidth: 2, dash: 'solid', endArrow: 'arrowclosed' },
  },
  {
    id: 'sunset',
    labelKey: 'Sunset',
    swatch: { fill: '#FFEDD5', stroke: '#EA580C', text: '#7C2D12' },
    node: {
      fill: '#FFEDD5',
      stroke: '#EA580C',
      strokeWidth: 2,
      textColor: '#7C2D12',
      fontFamily: 'system-ui, sans-serif',
      opacity: 1,
      shadow: false,
      lineDash: 'solid',
    },
    edge: { stroke: '#C2410C', strokeWidth: 2, dash: 'solid', endArrow: 'arrowclosed' },
  },
  {
    id: 'amber',
    labelKey: 'Amber',
    swatch: { fill: '#FEF3C7', stroke: '#D97706', text: '#78350F' },
    node: {
      fill: '#FEF3C7',
      stroke: '#D97706',
      strokeWidth: 2,
      textColor: '#78350F',
      fontFamily: 'system-ui, sans-serif',
      opacity: 1,
      shadow: false,
      lineDash: 'solid',
    },
    edge: { stroke: '#B45309', strokeWidth: 2, dash: 'solid', endArrow: 'arrowclosed' },
  },
  {
    id: 'rose',
    labelKey: 'Rose',
    swatch: { fill: '#FFE4E6', stroke: '#E11D48', text: '#881337' },
    node: {
      fill: '#FFE4E6',
      stroke: '#E11D48',
      strokeWidth: 2,
      textColor: '#881337',
      fontFamily: 'system-ui, sans-serif',
      opacity: 1,
      shadow: true,
      lineDash: 'solid',
    },
    edge: { stroke: '#BE123C', strokeWidth: 2, dash: 'solid', endArrow: 'arrowclosed' },
  },
  {
    id: 'candy',
    labelKey: 'Candy',
    swatch: { fill: '#FCE7F3', stroke: '#EC4899', text: '#9D174D' },
    node: {
      fill: '#FCE7F3',
      stroke: '#EC4899',
      strokeWidth: 2,
      textColor: '#9D174D',
      fontFamily: 'system-ui, sans-serif',
      opacity: 1,
      shadow: true,
      lineDash: 'solid',
    },
    edge: { stroke: '#DB2777', strokeWidth: 2, dash: 'solid', endArrow: 'arrowclosed' },
  },
  {
    id: 'violet',
    labelKey: 'Violet',
    swatch: { fill: '#EDE9FE', stroke: '#7C3AED', text: '#4C1D95' },
    node: {
      fill: '#EDE9FE',
      stroke: '#7C3AED',
      strokeWidth: 2,
      textColor: '#4C1D95',
      fontFamily: 'system-ui, sans-serif',
      opacity: 1,
      shadow: false,
      lineDash: 'solid',
    },
    edge: { stroke: '#6D28D9', strokeWidth: 2, dash: 'solid', endArrow: 'arrowclosed' },
  },
  {
    id: 'indigo',
    labelKey: 'Indigo',
    swatch: { fill: '#E0E7FF', stroke: '#4F46E5', text: '#312E81' },
    node: {
      fill: '#E0E7FF',
      stroke: '#4F46E5',
      strokeWidth: 2,
      textColor: '#312E81',
      fontFamily: 'PingFang SC, Microsoft YaHei, sans-serif',
      opacity: 1,
      shadow: false,
      lineDash: 'solid',
    },
    edge: { stroke: '#4338CA', strokeWidth: 2, dash: 'solid', endArrow: 'arrowclosed' },
  },
  {
    id: 'slate',
    labelKey: 'Slate',
    swatch: { fill: '#F1F5F9', stroke: '#64748B', text: '#1E293B' },
    node: {
      fill: '#F1F5F9',
      stroke: '#64748B',
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
    id: 'ink',
    labelKey: 'Ink',
    swatch: { fill: '#FFFFFF', stroke: '#111827', text: '#111827' },
    node: {
      fill: '#FFFFFF',
      stroke: '#111827',
      strokeWidth: 1.5,
      textColor: '#111827',
      fontFamily: 'Georgia, "Songti SC", serif',
      opacity: 1,
      shadow: false,
      lineDash: 'solid',
    },
    edge: { stroke: '#111827', strokeWidth: 1.5, dash: 'solid', endArrow: 'arrow' },
  },
  {
    id: 'sketch',
    labelKey: 'Sketch',
    swatch: { fill: '#FFFFFF', stroke: '#334155', text: '#0F172A' },
    node: {
      fill: '#FFFFFF',
      stroke: '#334155',
      strokeWidth: 2,
      textColor: '#0F172A',
      fontFamily: 'ui-monospace, SFMono-Regular, Menlo, Consolas, monospace',
      opacity: 1,
      shadow: false,
      lineDash: 'dashed',
    },
    // Edges use the hand-drawn sketch line type, giving a sketch-book look together with the dashed outlines
    edge: { stroke: '#334155', strokeWidth: 2, dash: 'sketch', endArrow: 'arrow' },
  },
  {
    id: 'blueprint',
    labelKey: 'Blueprint',
    swatch: { fill: '#1E3A8A', stroke: '#93C5FD', text: '#DBEAFE' },
    node: {
      fill: '#1E3A8A',
      stroke: '#93C5FD',
      strokeWidth: 2,
      textColor: '#DBEAFE',
      fontFamily: 'ui-monospace, SFMono-Regular, Menlo, Consolas, monospace',
      opacity: 1,
      shadow: false,
      lineDash: 'solid',
    },
    edge: { stroke: '#60A5FA', strokeWidth: 2, dash: 'solid', endArrow: 'arrowclosed' },
  },
  {
    id: 'terminal',
    labelKey: 'Terminal',
    swatch: { fill: '#022C22', stroke: '#34D399', text: '#A7F3D0' },
    node: {
      fill: '#022C22',
      stroke: '#34D399',
      strokeWidth: 2,
      textColor: '#A7F3D0',
      fontFamily: 'ui-monospace, SFMono-Regular, Menlo, Consolas, monospace',
      opacity: 1,
      shadow: false,
      lineDash: 'solid',
    },
    edge: { stroke: '#34D399', strokeWidth: 2, dash: 'solid', endArrow: 'arrowclosed' },
  },
  {
    id: 'neon',
    labelKey: 'Neon',
    swatch: { fill: '#111827', stroke: '#22D3EE', text: '#E0F7FA' },
    node: {
      fill: '#111827',
      stroke: '#22D3EE',
      strokeWidth: 2.5,
      textColor: '#E0F7FA',
      fontFamily: 'ui-monospace, SFMono-Regular, Menlo, Consolas, monospace',
      opacity: 1,
      shadow: true,
      lineDash: 'solid',
    },
    edge: { stroke: '#F472B6', strokeWidth: 2.5, dash: 'solid', endArrow: 'arrowclosed' },
  },
  {
    id: 'kraft',
    labelKey: 'Kraft',
    swatch: { fill: '#FDF6E3', stroke: '#B45309', text: '#78350F' },
    node: {
      fill: '#FDF6E3',
      stroke: '#B45309',
      strokeWidth: 2,
      textColor: '#78350F',
      fontFamily: 'Georgia, "Songti SC", serif',
      opacity: 1,
      shadow: false,
      lineDash: 'solid',
    },
    edge: { stroke: '#92400E', strokeWidth: 2, dash: 'solid', endArrow: 'arrowclosed' },
  },
];

export function themeOf(id: ThemeId): ThemeDef | undefined {
  return THEMES.find((theme) => theme.id === id);
}
