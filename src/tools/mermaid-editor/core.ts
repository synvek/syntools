import type { ToolResult } from '@/core/types';

/**
 * Mermaid 文本校验与主题 / 缩放配置。
 */

export type MermaidError = 'EMPTY';

export type MermaidThemeId =
  | 'default'
  | 'neutral'
  | 'forest'
  | 'dark'
  | 'ocean'
  | 'sunset'
  | 'mono';

/** Mermaid initialize 可用的内置 theme；自定义主题用 base + themeVariables */
export type MermaidBuiltinTheme = 'default' | 'neutral' | 'forest' | 'dark' | 'base';

export interface MermaidTheme {
  id: MermaidThemeId;
  background: string;
  mermaidTheme: MermaidBuiltinTheme;
  themeVariables?: Record<string, string>;
}

export const MERMAID_THEMES: MermaidTheme[] = [
  {
    id: 'default',
    background: '#ffffff',
    mermaidTheme: 'default',
  },
  {
    id: 'neutral',
    background: '#f8fafc',
    mermaidTheme: 'neutral',
  },
  {
    id: 'forest',
    background: '#f0fdf4',
    mermaidTheme: 'forest',
  },
  {
    id: 'dark',
    background: '#0f172a',
    mermaidTheme: 'dark',
  },
  {
    id: 'ocean',
    background: '#ecfeff',
    mermaidTheme: 'base',
    themeVariables: {
      primaryColor: '#cffafe',
      primaryTextColor: '#164e63',
      primaryBorderColor: '#06b6d4',
      lineColor: '#0e7490',
      secondaryColor: '#a5f3fc',
      tertiaryColor: '#ecfeff',
      background: '#ecfeff',
      mainBkg: '#cffafe',
      nodeBorder: '#0891b2',
      clusterBkg: '#e0f2fe',
      titleColor: '#0e7490',
      edgeLabelBackground: '#ecfeff',
    },
  },
  {
    id: 'sunset',
    background: '#fff7ed',
    mermaidTheme: 'base',
    themeVariables: {
      primaryColor: '#ffedd5',
      primaryTextColor: '#9a3412',
      primaryBorderColor: '#f97316',
      lineColor: '#ea580c',
      secondaryColor: '#fed7aa',
      tertiaryColor: '#fff7ed',
      background: '#fff7ed',
      mainBkg: '#ffedd5',
      nodeBorder: '#fb923c',
      clusterBkg: '#ffedd5',
      titleColor: '#c2410c',
      edgeLabelBackground: '#fff7ed',
    },
  },
  {
    id: 'mono',
    background: '#fafafa',
    mermaidTheme: 'base',
    themeVariables: {
      primaryColor: '#f5f5f5',
      primaryTextColor: '#171717',
      primaryBorderColor: '#525252',
      lineColor: '#737373',
      secondaryColor: '#e5e5e5',
      tertiaryColor: '#fafafa',
      background: '#fafafa',
      mainBkg: '#f5f5f5',
      nodeBorder: '#404040',
      clusterBkg: '#eeeeee',
      titleColor: '#171717',
      edgeLabelBackground: '#fafafa',
    },
  },
];

export const DEFAULT_THEME_ID: MermaidThemeId = 'neutral';

export const DEFAULT_MERMAID = `flowchart TD
  A[开始] --> B{是否通过?}
  B -->|是| C[部署]
  B -->|否| D[修复]
  D --> B
  C --> E[结束]`;

export const MIN_ZOOM = 0.4;
export const MAX_ZOOM = 2.5;
export const ZOOM_STEP = 0.15;

export function isMermaidThemeId(v: string): v is MermaidThemeId {
  return MERMAID_THEMES.some((th) => th.id === v);
}

export function getMermaidTheme(id: MermaidThemeId | string): MermaidTheme {
  return MERMAID_THEMES.find((th) => th.id === id) ?? MERMAID_THEMES[1];
}

export function clampZoom(z: number): number {
  if (!Number.isFinite(z)) return 1;
  return Math.min(MAX_ZOOM, Math.max(MIN_ZOOM, Math.round(z * 100) / 100));
}

export function validateMermaidSource(source: string): ToolResult<string> {
  const text = source.trim();
  if (!text) return { ok: false, error: 'EMPTY' };
  return { ok: true, value: text };
}

export function parseSvgSize(svg: string): { width: number; height: number } {
  const vb = svg.match(/viewBox=["']([^"']+)["']/i);
  if (vb) {
    const parts = vb[1]
      .trim()
      .split(/[\s,]+/)
      .map(Number);
    if (parts.length === 4 && parts.every((n) => Number.isFinite(n))) {
      return { width: Math.max(1, parts[2]), height: Math.max(1, parts[3]) };
    }
  }
  const w = svg.match(/\bwidth=["']([\d.]+)/i);
  const h = svg.match(/\bheight=["']([\d.]+)/i);
  return {
    width: Math.max(1, w ? Number(w[1]) : 640),
    height: Math.max(1, h ? Number(h[1]) : 360),
  };
}

/** 在 SVG 根节点注入背景矩形，便于导出 PNG 不透明 */
export function injectSvgBackground(svg: string, background: string): string {
  if (!background || /<rect[^>]*width=["']100%["']/i.test(svg)) return svg;
  const rect = `<rect width="100%" height="100%" fill="${background}"/>`;
  return svg.replace(/<svg([^>]*)>/i, `<svg$1>${rect}`);
}

export function buildMermaidInitConfig(theme: MermaidTheme) {
  return {
    startOnLoad: false as const,
    securityLevel: 'strict' as const,
    theme: theme.mermaidTheme,
    ...(theme.themeVariables ? { themeVariables: theme.themeVariables } : {}),
  };
}
