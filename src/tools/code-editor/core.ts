import type { ToolResult } from '@/core/types';
import { DEFAULT_THEME_ID } from './themes';

/**
 * Code editor pure-logic layer (technical design §8.2):
 * No heavy deps (Prism / prettier / html-to-image) are imported here — the component
 * layer loads them dynamically — and every function follows the ToolResult contract:
 * expected errors are returned as results instead of being thrown.
 */

export type CodeErrorCode =
  'EMPTY' | 'TOO_LARGE' | 'UNSUPPORTED' | 'READ_FAILED' | 'FORMAT_FAILED' | 'EXPORT_FAILED';

/** Max import file size (10MB), kept in sync with the FileDropZone default */
export const MAX_IMPORT_BYTES = 10 * 1024 * 1024;

/** Prettier plugin groups: imported on demand per language so no chunk exceeds the 500KB budget */
export type PrettierGroup = 'js' | 'ts' | 'doc' | 'java';
export type FormatStrategy = 'prettier' | 'sql' | 'fallback' | 'none';
/** Language groups shown in the dropdown */
export type LangGroup = 'web' | 'system' | 'data' | 'markup';

export interface LangSpec {
  id: string;
  /** Display name (a proper noun, identical in every language) */
  label: string;
  /** Prism grammar name; 'none' means no highlighting */
  prism: string;
  /** Extension used when exporting source (leading dot included) */
  ext: string;
  group: LangGroup;
  format: FormatStrategy;
  prettierGroup?: PrettierGroup;
  /** Prettier parser name */
  parser?: string;
  /** Built-in formatter mode: 'indent' for languages where indentation carries meaning */
  fallbackMode?: 'indent';
  /** Line comment marker (`//` / `#` / `--`); undefined when line comments are unsupported */
  lineComment?: string;
  /** Block comment delimiters `[open, close]`; undefined when block comments are unsupported */
  blockComment?: [string, string];
}

/** Base language config: comment markers are merged in from `COMMENT_SPECS`, see `LANG_SPECS` */
const LANG_BASE: LangSpec[] = [
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
  // Systems / compiled
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
  },
  {
    id: 'ruby',
    label: 'Ruby',
    prism: 'ruby',
    ext: '.rb',
    group: 'system',
    format: 'fallback',
    fallbackMode: 'indent',
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
  },
  {
    id: 'bash',
    label: 'Shell',
    prism: 'bash',
    ext: '.sh',
    group: 'system',
    format: 'fallback',
    fallbackMode: 'indent',
  },
  // Data
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
  // Markup
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

/** Comment markers per language: shared by comment toggling (phase 2) and by the built-in formatter */
interface CommentSpec {
  /** Line comment marker */
  line?: string;
  /** Block comment delimiters */
  block?: [string, string];
}

const COMMENT_SPECS: Partial<Record<string, CommentSpec>> = {
  javascript: { line: '//', block: ['/*', '*/'] },
  typescript: { line: '//', block: ['/*', '*/'] },
  jsx: { line: '//', block: ['/*', '*/'] },
  tsx: { line: '//', block: ['/*', '*/'] },
  css: { block: ['/*', '*/'] },
  scss: { line: '//', block: ['/*', '*/'] },
  php: { line: '//', block: ['/*', '*/'] },
  java: { line: '//', block: ['/*', '*/'] },
  rust: { line: '//', block: ['/*', '*/'] },
  go: { line: '//', block: ['/*', '*/'] },
  c: { line: '//', block: ['/*', '*/'] },
  cpp: { line: '//', block: ['/*', '*/'] },
  csharp: { line: '//', block: ['/*', '*/'] },
  kotlin: { line: '//', block: ['/*', '*/'] },
  swift: { line: '//', block: ['/*', '*/'] },
  dart: { line: '//', block: ['/*', '*/'] },
  scala: { line: '//', block: ['/*', '*/'] },
  python: { line: '#' },
  ruby: { line: '#', block: ['=begin', '=end'] },
  bash: { line: '#' },
  lua: { line: '--', block: ['--[[', ']]'] },
  yaml: { line: '#' },
  sql: { line: '--', block: ['/*', '*/'] },
  html: { block: ['<!--', '-->'] },
  xml: { block: ['<!--', '-->'] },
  markdown: { block: ['<!--', '-->'] },
  // json / plaintext have no comment syntax
};

/** Language table: base fields merged with comment markers (markers live in `COMMENT_SPECS`) */
export const LANG_SPECS: LangSpec[] = LANG_BASE.map((spec) => {
  const comment = COMMENT_SPECS[spec.id];
  return comment ? { ...spec, lineComment: comment.line, blockComment: comment.block } : spec;
});

export const DEFAULT_LANG_ID = 'java';
export const DEFAULT_FILENAME = 'snippet';
export const DEFAULT_THEME = DEFAULT_THEME_ID;

const SPEC_BY_ID = new Map(LANG_SPECS.map((s) => [s.id, s]));
/** Extension → language (aliases such as .h/.hpp are registered too) */
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

/** Extension (or filename) → language id; returns null when unrecognised */
export function detectLanguageByExt(filename: string): string | null {
  const lower = filename.trim().toLowerCase();
  const dot = lower.lastIndexOf('.');
  if (dot < 0) return null;
  return EXT_TO_ID.get(lower.slice(dot)) ?? null;
}

/** Importable extension list, used for the FileDropZone accept attribute */
export const IMPORT_ACCEPT = Array.from(EXT_TO_ID.keys()).join(',');

/** Shared pre-import validation: file size and whether it looks like a text file */
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

/** Sanitise a filename: drop path separators and control chars, keep the rest; fall back when empty */
export function sanitizeFilename(name: string): string {
  const cleaned = name
    // eslint-disable-next-line no-control-regex -- strip control characters and path separators
    .replace(/[\u0000-\u001f\u007f/\\:*?"<>|]/g, '')
    .replace(/^\.+/, '')
    .trim();
  return cleaned.slice(0, 64) || DEFAULT_FILENAME;
}

/** Build the export filename: basename + language extension (e.g. snippet.java) */
export function buildExportFilename(name: string, spec: LangSpec): string {
  const base = sanitizeFilename(name);
  const ext = spec.ext;
  return base.toLowerCase().endsWith(ext) ? base : `${base}${ext}`;
}

/** Stats: character count (code points), line count and UTF-8 byte count */
export function countStats(code: string): { chars: number; lines: number; bytes: number } {
  const chars = Array.from(code).length;
  const lines = code ? code.split(/\r\n|\r|\n/).length : 0;
  // TextEncoder is available in both jsdom and browsers
  const bytes = new TextEncoder().encode(code).length;
  return { chars, lines, bytes };
}

function escapeHtml(text: string): string {
  return text.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}

/**
 * Build a standalone HTML document: inlined theme styles + the Prism highlight markup.
 * The highlight markup comes from Prism with `<` already escaped, so it is not escaped again.
 *
 * `bodyHtml` renders a styled export card (line-by-line, watermark, etc.) and is produced by
 * `cardOptions.buildCardBodyHtml`; when omitted, the default single `<pre>` block is used.
 */
export function buildStandaloneHtml(
  highlightedHtml: string,
  spec: LangSpec,
  cssBlock: string,
  title: string,
  bodyHtml?: string,
): string {
  const langClass = spec.prism === 'none' ? 'text' : spec.prism;
  const body =
    bodyHtml ??
    `
  <div class="code-lang">${escapeHtml(spec.label)}</div>
  <pre class="language-${langClass}"><code class="language-${langClass}">${highlightedHtml}</code></pre>
`;
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
<div class="code-card">${body}</div>
</body>
</html>
`;
}

/** Build a copyable highlighted HTML snippet (for embedding in blogs / docs) */
export function buildSnippet(highlightedHtml: string, spec: LangSpec): string {
  const langClass = spec.prism === 'none' ? 'text' : spec.prism;
  return `<pre class="language-${langClass}"><code class="language-${langClass}">${highlightedHtml}</code></pre>`;
}
