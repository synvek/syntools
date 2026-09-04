/**
 * 代码生成图片：主题与语言配置（高亮在 UI 用 Prism，导出用 html-to-image）。
 */

export const CODE_LANGUAGES = [
  'javascript',
  'typescript',
  'python',
  'json',
  'css',
  'markup',
  'markdown',
  'sql',
  'bash',
] as const;

export type CodeLanguage = (typeof CODE_LANGUAGES)[number];
export type CodeTheme = 'dark' | 'light';

export interface CodeImageOptions {
  language: CodeLanguage;
  theme: CodeTheme;
  showLineNumbers: boolean;
  padding: number;
}

export const DEFAULT_CODE_IMAGE: CodeImageOptions = {
  language: 'javascript',
  theme: 'dark',
  showLineNumbers: true,
  padding: 24,
};

export const THEME_COLORS: Record<
  CodeTheme,
  { bg: string; fg: string; gutter: string; border: string }
> = {
  dark: {
    bg: '#0f172a',
    fg: '#e2e8f0',
    gutter: '#64748b',
    border: '#1e293b',
  },
  light: {
    bg: '#f8fafc',
    fg: '#0f172a',
    gutter: '#94a3b8',
    border: '#e2e8f0',
  },
};

export function lineCount(code: string): number {
  if (!code) return 1;
  return code.split(/\r\n|\r|\n/).length;
}
