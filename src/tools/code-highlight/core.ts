/**
 * 代码在线高亮：语言 / 主题配置（Prism 高亮在 UI）。
 */

export const HIGHLIGHT_LANGUAGES = [
  'javascript',
  'typescript',
  'python',
  'json',
  'css',
  'markup',
  'markdown',
  'sql',
  'bash',
  'java',
  'go',
  'rust',
  'c',
  'cpp',
] as const;

export type HighlightLanguage = (typeof HIGHLIGHT_LANGUAGES)[number];
export type HighlightTheme = 'dark' | 'light';

export interface HighlightOptions {
  language: HighlightLanguage;
  theme: HighlightTheme;
  showLineNumbers: boolean;
}

export const DEFAULT_HIGHLIGHT: HighlightOptions = {
  language: 'javascript',
  theme: 'dark',
  showLineNumbers: true,
};

export const THEME_COLORS: Record<
  HighlightTheme,
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

export function languageLabel(language: HighlightLanguage): string {
  return language === 'markup' ? 'html' : language;
}

/** 生成可复制的高亮 HTML 片段 */
export function buildHighlightSnippet(
  highlightedInnerHtml: string,
  language: HighlightLanguage,
): string {
  const lang = languageLabel(language);
  return `<pre class="language-${lang}"><code class="language-${lang}">${highlightedInnerHtml}</code></pre>`;
}

export function isHighlightLanguage(value: string): value is HighlightLanguage {
  return (HIGHLIGHT_LANGUAGES as readonly string[]).includes(value);
}
