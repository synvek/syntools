import type { ToolResult } from '@/core/types';
import { DEFAULT_THEME_ID } from './themes';

/**
 * 代码编辑器纯逻辑层（技术设计 §8.2）：
 * 不引入 Prism / prettier / html-to-image 等重依赖（全部由组件层动态导入），
 * 且所有函数遵循 ToolResult 契约——预期错误返回结果而非抛异常。
 */

export type CodeErrorCode =
  'EMPTY' | 'TOO_LARGE' | 'UNSUPPORTED' | 'READ_FAILED' | 'FORMAT_FAILED' | 'EXPORT_FAILED';

/** 导入文件大小上限（10MB），与 FileDropZone 默认保持一致 */
export const MAX_IMPORT_BYTES = 10 * 1024 * 1024;

/** prettier 插件分组：按语言按需动态 import，避免单个 chunk 超出 500KB 预算 */
export type PrettierGroup = 'js' | 'ts' | 'doc' | 'java';
export type FormatStrategy = 'prettier' | 'sql' | 'fallback' | 'none';
/** 下拉框中的语言分组 */
export type LangGroup = 'web' | 'system' | 'data' | 'markup';

export interface LangSpec {
  id: string;
  /** 展示名（专有名词，各语言一致） */
  label: string;
  /** Prism 语法名；'none' 表示不做高亮 */
  prism: string;
  /** 导出源码时使用的扩展名（含点） */
  ext: string;
  group: LangGroup;
  format: FormatStrategy;
  prettierGroup?: PrettierGroup;
  /** prettier parser 名 */
  parser?: string;
  /** 内置格式化器模式：缩进本身即语义的语言（Python / Ruby / Shell）用 indent */
  fallbackMode?: 'indent';
  /** `#` 为行注释（Python / Ruby / Shell） */
  hashComment?: boolean;
  /** `--` 为行注释（Lua / SQL） */
  dashComment?: boolean;
}

export const LANG_SPECS: LangSpec[] = [
  // Web
  {
    id: 'javascript',
    label: 'JavaScript',
    prism: 'javascript',
    ext: '.js',
    group: 'web',
    format: 'prettier',
    prettierGroup: 'js',
    parser: 'babel',
  },
  {
    id: 'typescript',
    label: 'TypeScript',
    prism: 'typescript',
    ext: '.ts',
    group: 'web',
    format: 'prettier',
    prettierGroup: 'ts',
    parser: 'typescript',
  },
  {
    id: 'jsx',
    label: 'JSX',
    prism: 'jsx',
    ext: '.jsx',
    group: 'web',
    format: 'prettier',
    prettierGroup: 'js',
    parser: 'babel',
  },
  {
    id: 'tsx',
    label: 'TSX',
    prism: 'tsx',
    ext: '.tsx',
    group: 'web',
    format: 'prettier',
    prettierGroup: 'ts',
    parser: 'typescript',
  },
  {
    id: 'css',
    label: 'CSS',
    prism: 'css',
    ext: '.css',
    group: 'web',
    format: 'prettier',
    prettierGroup: 'doc',
    parser: 'css',
  },
  {
    id: 'scss',
    label: 'SCSS',
    prism: 'scss',
    ext: '.scss',
    group: 'web',
    format: 'prettier',
    prettierGroup: 'doc',
    parser: 'scss',
  },
  { id: 'php', label: 'PHP', prism: 'php', ext: '.php', group: 'web', format: 'fallback' },
  // 系统 / 编译型
  {
    id: 'java',
    label: 'Java',
    prism: 'java',
    ext: '.java',
    group: 'system',
    format: 'prettier',
    prettierGroup: 'java',
    parser: 'java',
  },
  { id: 'rust', label: 'Rust', prism: 'rust', ext: '.rs', group: 'system', format: 'fallback' },
  { id: 'go', label: 'Go', prism: 'go', ext: '.go', group: 'system', format: 'fallback' },
  { id: 'c', label: 'C', prism: 'c', ext: '.c', group: 'system', format: 'fallback' },
  { id: 'cpp', label: 'C++', prism: 'cpp', ext: '.cpp', group: 'system', format: 'fallback' },
  { id: 'csharp', label: 'C#', prism: 'csharp', ext: '.cs', group: 'system', format: 'fallback' },
  {
    id: 'kotlin',
    label: 'Kotlin',
    prism: 'kotlin',
    ext: '.kt',
    group: 'system',
    format: 'fallback',
  },
  {
    id: 'swift',
    label: 'Swift',
    prism: 'swift',
    ext: '.swift',
    group: 'system',
    format: 'fallback',
  },
  {
    id: 'python',
    label: 'Python',
    prism: 'python',
    ext: '.py',
    group: 'system',
    format: 'fallback',
    fallbackMode: 'indent',
    hashComment: true,
  },
  {
    id: 'ruby',
    label: 'Ruby',
    prism: 'ruby',
    ext: '.rb',
    group: 'system',
    format: 'fallback',
    fallbackMode: 'indent',
    hashComment: true,
  },
  { id: 'dart', label: 'Dart', prism: 'dart', ext: '.dart', group: 'system', format: 'fallback' },
  {
    id: 'scala',
    label: 'Scala',
    prism: 'scala',
    ext: '.scala',
    group: 'system',
    format: 'fallback',
  },
  {
    id: 'lua',
    label: 'Lua',
    prism: 'lua',
    ext: '.lua',
    group: 'system',
    format: 'fallback',
    dashComment: true,
  },
  {
    id: 'bash',
    label: 'Shell',
    prism: 'bash',
    ext: '.sh',
    group: 'system',
    format: 'fallback',
    fallbackMode: 'indent',
    hashComment: true,
  },
  // 数据
  {
    id: 'json',
    label: 'JSON',
    prism: 'json',
    ext: '.json',
    group: 'data',
    format: 'prettier',
    prettierGroup: 'js',
    parser: 'json',
  },
  {
    id: 'yaml',
    label: 'YAML',
    prism: 'yaml',
    ext: '.yml',
    group: 'data',
    format: 'prettier',
    prettierGroup: 'doc',
    parser: 'yaml',
  },
  { id: 'sql', label: 'SQL', prism: 'sql', ext: '.sql', group: 'data', format: 'sql' },
  // 标记语言
  {
    id: 'html',
    label: 'HTML',
    prism: 'markup',
    ext: '.html',
    group: 'markup',
    format: 'prettier',
    prettierGroup: 'doc',
    parser: 'html',
  },
  { id: 'xml', label: 'XML', prism: 'markup', ext: '.xml', group: 'markup', format: 'fallback' },
  {
    id: 'markdown',
    label: 'Markdown',
    prism: 'markdown',
    ext: '.md',
    group: 'markup',
    format: 'prettier',
    prettierGroup: 'doc',
    parser: 'markdown',
  },
  {
    id: 'plaintext',
    label: 'Plain Text',
    prism: 'none',
    ext: '.txt',
    group: 'markup',
    format: 'none',
  },
];

export const DEFAULT_LANG_ID = 'java';
export const DEFAULT_FILENAME = 'snippet';
export const DEFAULT_THEME = DEFAULT_THEME_ID;

const SPEC_BY_ID = new Map(LANG_SPECS.map((s) => [s.id, s]));
/** 扩展名 → 语言（.h/.hpp 等别名一并收录） */
const EXT_TO_ID = new Map<string, string>();

for (const spec of LANG_SPECS) {
  EXT_TO_ID.set(spec.ext, spec.id);
}
for (const [ext, id] of [
  ['.mjs', 'javascript'],
  ['.cjs', 'javascript'],
  ['.mts', 'typescript'],
  ['.h', 'c'],
  ['.hpp', 'cpp'],
  ['.cc', 'cpp'],
  ['.cxx', 'cpp'],
  ['.pyw', 'python'],
  ['.yaml', 'yaml'],
  ['.htm', 'html'],
  ['.zsh', 'bash'],
  ['.rs.in', 'rust'],
  ['.text', 'plaintext'],
  ['.log', 'plaintext'],
] as const) {
  EXT_TO_ID.set(ext, id);
}

export function isLangId(value: string): boolean {
  return SPEC_BY_ID.has(value);
}

export function getLangSpec(id: string): LangSpec {
  return SPEC_BY_ID.get(id) ?? SPEC_BY_ID.get(DEFAULT_LANG_ID)!;
}

/** 扩展名（或文件名）→ 语言 id；无法识别时返回 null */
export function detectLanguageByExt(filename: string): string | null {
  const lower = filename.trim().toLowerCase();
  const dot = lower.lastIndexOf('.');
  if (dot < 0) return null;
  return EXT_TO_ID.get(lower.slice(dot)) ?? null;
}

/** 可导入的扩展名清单，用于 FileDropZone 的 accept */
export const IMPORT_ACCEPT = Array.from(EXT_TO_ID.keys()).join(',');

/** 导入前的统一校验：体积 + 是否像文本文件 */
export function checkImportFile(file: { name: string; size: number }): ToolResult<string> {
  if (file.size > MAX_IMPORT_BYTES) {
    return {
      ok: false,
      error: 'TOO_LARGE',
      params: { max: Math.round(MAX_IMPORT_BYTES / 1024 / 1024) },
    };
  }
  return { ok: true, value: file.name };
}

/** 清洗文件名：去掉路径分隔符与控制字符，保留安全字符；空则回落默认值 */
export function sanitizeFilename(name: string): string {
  const cleaned = name
    // eslint-disable-next-line no-control-regex -- 过滤控制字符与路径分隔符
    .replace(/[\u0000-\u001f\u007f/\\:*?"<>|]/g, '')
    .replace(/^\.+/, '')
    .trim();
  return cleaned.slice(0, 64) || DEFAULT_FILENAME;
}

/** 拼装导出文件名：basename + 语言扩展名（如 snippet.java） */
export function buildExportFilename(name: string, spec: LangSpec): string {
  const base = sanitizeFilename(name);
  const ext = spec.ext;
  return base.toLowerCase().endsWith(ext) ? base : `${base}${ext}`;
}

/** 统计：字符数（码点）、行数、UTF-8 字节数 */
export function countStats(code: string): { chars: number; lines: number; bytes: number } {
  const chars = Array.from(code).length;
  const lines = code ? code.split(/\r\n|\r|\n/).length : 0;
  // TextEncoder 在 jsdom / 浏览器均可用
  const bytes = new TextEncoder().encode(code).length;
  return { chars, lines, bytes };
}

function escapeHtml(text: string): string {
  return text.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}

/**
 * 生成可独立打开的 HTML 文档：内嵌主题样式 + Prism 高亮片段。
 * 高亮片段由 Prism 生成（`<` 已被转义），此处不再二次转义。
 */
export function buildStandaloneHtml(
  highlightedHtml: string,
  spec: LangSpec,
  cssBlock: string,
  title: string,
): string {
  const langClass = spec.prism === 'none' ? 'text' : spec.prism;
  return `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8" />
<meta name="viewport" content="width=device-width, initial-scale=1" />
<title>${escapeHtml(title)}</title>
<style>
${cssBlock}
</style>
</head>
<body>
<div class="code-card">
  <div class="code-lang">${escapeHtml(spec.label)}</div>
  <pre class="language-${langClass}"><code class="language-${langClass}">${highlightedHtml}</code></pre>
</div>
</body>
</html>
`;
}

/** 生成可复制的高亮 HTML 片段（嵌入博客 / 文档） */
export function buildSnippet(highlightedHtml: string, spec: LangSpec): string {
  const langClass = spec.prism === 'none' ? 'text' : spec.prism;
  return `<pre class="language-${langClass}"><code class="language-${langClass}">${highlightedHtml}</code></pre>`;
}
