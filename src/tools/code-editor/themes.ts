/**
 * 代码编辑器配色主题：10 套风格（深色 / 浅色各半）。
 *
 * 调色板以 CSS 自定义属性（`--ce-*`）注入容器，由 `editor.css` 消费，
 * 因此编辑区、导出预览卡片、导出的独立 HTML 三处可复用同一份配色，
 * 保证「所见即所得」。
 */

export interface CodeTheme {
  id: string;
  /** 展示名（多为专有名词，各语言保持一致） */
  name: string;
  mode: 'dark' | 'light';
  bg: string;
  fg: string;
  gutter: string;
  border: string;
  keyword: string;
  string: string;
  number: string;
  function: string;
  comment: string;
  operator: string;
  punctuation: string;
  variable: string;
}

/** Prism token → 调色板字段，供 CSS 与导出 HTML 共用 */
export const TOKEN_FIELDS = [
  'keyword',
  'string',
  'number',
  'function',
  'comment',
  'operator',
  'punctuation',
  'variable',
] as const;

export type TokenField = (typeof TOKEN_FIELDS)[number];

export const CODE_THEMES: CodeTheme[] = [
  {
    id: 'vscode-dark',
    name: 'VS Code Dark',
    mode: 'dark',
    bg: '#1e1e1e',
    fg: '#d4d4d4',
    gutter: '#858585',
    border: '#333333',
    keyword: '#569cd6',
    string: '#ce9178',
    number: '#b5cea8',
    function: '#dcdcaa',
    comment: '#6a9955',
    operator: '#d4d4d4',
    punctuation: '#d4d4d4',
    variable: '#9cdcfe',
  },
  {
    id: 'dracula',
    name: 'Dracula',
    mode: 'dark',
    bg: '#282a36',
    fg: '#f8f8f2',
    gutter: '#6272a4',
    border: '#44475a',
    keyword: '#ff79c6',
    string: '#f1fa8c',
    number: '#bd93f9',
    function: '#50fa7b',
    comment: '#6272a4',
    operator: '#ff79c6',
    punctuation: '#f8f8f2',
    variable: '#8be9fd',
  },
  {
    id: 'monokai',
    name: 'Monokai',
    mode: 'dark',
    bg: '#272822',
    fg: '#f8f8f2',
    gutter: '#90908a',
    border: '#49483e',
    keyword: '#f92672',
    string: '#e6db74',
    number: '#ae81ff',
    function: '#a6e22e',
    comment: '#75715e',
    operator: '#f92672',
    punctuation: '#f8f8f2',
    variable: '#66d9ef',
  },
  {
    id: 'one-dark',
    name: 'One Dark',
    mode: 'dark',
    bg: '#282c34',
    fg: '#abb2bf',
    gutter: '#5c6370',
    border: '#3b4048',
    keyword: '#c678dd',
    string: '#98c379',
    number: '#d19a66',
    function: '#61afef',
    comment: '#5c6370',
    operator: '#56b6c2',
    punctuation: '#abb2bf',
    variable: '#e06c75',
  },
  {
    id: 'nord',
    name: 'Nord',
    mode: 'dark',
    bg: '#2e3440',
    fg: '#d8dee9',
    gutter: '#4c566a',
    border: '#3b4252',
    keyword: '#81a1c1',
    string: '#a3be8c',
    number: '#b48ead',
    function: '#88c0d0',
    comment: '#616e88',
    operator: '#81a1c1',
    punctuation: '#d8dee9',
    variable: '#d8dee9',
  },
  {
    id: 'github-light',
    name: 'GitHub Light',
    mode: 'light',
    bg: '#ffffff',
    fg: '#24292e',
    gutter: '#b0b7c3',
    border: '#e1e4e8',
    keyword: '#d73a49',
    string: '#032f62',
    number: '#005cc5',
    function: '#6f42c1',
    comment: '#6a737d',
    operator: '#d73a49',
    punctuation: '#24292e',
    variable: '#e36209',
  },
  {
    id: 'solarized-light',
    name: 'Solarized Light',
    mode: 'light',
    bg: '#fdf6e3',
    fg: '#657b83',
    gutter: '#c3b9a5',
    border: '#eee8d5',
    keyword: '#859900',
    string: '#2aa198',
    number: '#d33682',
    function: '#268bd2',
    comment: '#93a1a1',
    operator: '#859900',
    punctuation: '#657b83',
    variable: '#cb4b16',
  },
  {
    id: 'vscode-light',
    name: 'VS Code Light',
    mode: 'light',
    bg: '#ffffff',
    fg: '#1f1f1f',
    gutter: '#a0a0a0',
    border: '#e5e5e5',
    keyword: '#0000ff',
    string: '#a31515',
    number: '#098658',
    function: '#795e26',
    comment: '#008000',
    operator: '#1f1f1f',
    punctuation: '#1f1f1f',
    variable: '#001080',
  },
  {
    id: 'one-light',
    name: 'One Light',
    mode: 'light',
    bg: '#fafafa',
    fg: '#383a42',
    gutter: '#b0b0b0',
    border: '#e5e5e5',
    keyword: '#a626a4',
    string: '#50a14f',
    number: '#986801',
    function: '#4078f2',
    comment: '#a0a1a7',
    operator: '#0184bc',
    punctuation: '#383a42',
    variable: '#e45649',
  },
  {
    id: 'xcode-light',
    name: 'Xcode Light',
    mode: 'light',
    bg: '#ffffff',
    fg: '#262626',
    gutter: '#ababab',
    border: '#eaeaea',
    keyword: '#ad3da4',
    string: '#d12f1b',
    number: '#272ad8',
    function: '#4b21b0',
    comment: '#007400',
    operator: '#262626',
    punctuation: '#262626',
    variable: '#4b21b0',
  },
];

export const DEFAULT_THEME_ID = 'vscode-dark';

export function isThemeId(value: string): boolean {
  return CODE_THEMES.some((t) => t.id === value);
}

export function getTheme(id: string): CodeTheme {
  return CODE_THEMES.find((t) => t.id === id) ?? CODE_THEMES[0];
}

/** 主题 → `--ce-*` 自定义属性，供 React 内联 style 使用 */
export function themeCssVars(theme: CodeTheme): Record<string, string> {
  const vars: Record<string, string> = {
    '--ce-bg': theme.bg,
    '--ce-fg': theme.fg,
    '--ce-gutter': theme.gutter,
    '--ce-border': theme.border,
  };
  for (const field of TOKEN_FIELDS) {
    vars[`--ce-${field}`] = theme[field];
  }
  return vars;
}

/** 主题 → 独立 CSS 片段（导出 HTML 时内嵌，脱离本站仍可用） */
export function themeStyleBlock(theme: CodeTheme): string {
  const tokens = TOKEN_FIELDS.map((field) => `  .token.${field} { color: ${theme[field]}; }`).join(
    '\n',
  );
  return [
    `:root {`,
    `  --ce-bg: ${theme.bg};`,
    `  --ce-fg: ${theme.fg};`,
    `  --ce-gutter: ${theme.gutter};`,
    `  --ce-border: ${theme.border};`,
    ...TOKEN_FIELDS.map((f) => `  --ce-${f}: ${theme[f]};`),
    `}`,
    `body { margin: 0; padding: 24px; background: ${theme.mode === 'dark' ? '#0b0b0d' : '#f4f5f7'}; }`,
    `.code-card {`,
    `  max-width: 960px; margin: 0 auto; padding: 18px 20px; border-radius: 12px;`,
    `  background: ${theme.bg}; color: ${theme.fg}; border: 1px solid ${theme.border};`,
    `  font-family: ui-monospace, SFMono-Regular, Menlo, Consolas, 'Liberation Mono', monospace;`,
    `  font-size: 13px; line-height: 1.6; overflow-x: auto;`,
    `}`,
    `.code-lang { margin-bottom: 8px; font-size: 12px; opacity: 0.6; }`,
    `.code-card pre { margin: 0; white-space: pre; }`,
    `.token.comment { font-style: italic; }`,
    tokens,
  ].join('\n');
}
