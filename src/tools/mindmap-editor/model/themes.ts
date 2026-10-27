/**
 * Mind map themes (XMind style): one theme defines the shape, fill, stroke and typography of the
 * central topic / top-level branches / deeper nodes, plus the branch colour cycle and line width.
 * Display names come from the i18n key `tools.mindmap.theme_<id>`; only style data lives here.
 */

import type { MindNodeShape, MindNodeStyle } from './types';

/** Colour placeholder: 'branch' means use the colour of the owning branch */
export const BRANCH = 'branch';

export interface MindLevelStyle {
  shape: MindNodeShape;
  /** 'transparent' means no fill */
  fill: string;
  stroke: string;
  textColor: string;
  fontSize: number;
  bold: boolean;
}

export interface MindTheme {
  id: string;
  /** Central topic */
  root: MindLevelStyle;
  /** Top-level branch */
  main: MindLevelStyle;
  /** Second level and deeper */
  sub: MindLevelStyle;
  /** Top-level branches cycle through these colours (also the colour of their edges) */
  branches: string[];
  /** Trunk line width */
  lineWidth: number;
  /** Canvas base colour (export background) */
  background: string;
}

export const DEFAULT_THEME_ID = 'classic';

export const MIND_THEMES: MindTheme[] = [
  {
    // Classic blue: solid pill root, white top-level branches with coloured borders, underlined leaves
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
    // Forest green: solid rounded root, pale green top-level branches
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
    // Sunset orange: solid top-level branches in the branch colour with white text
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
    // Grape purple: elliptical root, rounded outlined top-level branches
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
    // Graphite grey: neutral business look, rectangular pale grey top-level branches
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
    // Candy pink: soft and light
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
    // Minimal black and white: hierarchy told by shape alone, no colour
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
    // Neon: dark root with saturated branches; top-level branches are solid colour
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

/** Branch colour: cycles by index under one parent so neighbouring branches differ */
export function branchColorOf(theme: MindTheme, index: number): string {
  return theme.branches[index % theme.branches.length];
}

function levelOf(theme: MindTheme, depth: number): MindLevelStyle {
  return depth === 0 ? theme.root : depth === 1 ? theme.main : theme.sub;
}

/** Default appearance when no style is set, derived from the theme and depth */
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

/** Default shape when none is set (varies with theme and depth) */
export function defaultShapeOf(theme: MindTheme, depth: number): MindNodeShape {
  return levelOf(theme, depth).shape;
}
