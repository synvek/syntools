import { marked } from 'marked';
import DOMPurify from 'dompurify';
import type { ToolResult } from '@/core/types';

/**
 * Markdown editor core: marked parsing + DOMPurify sanitising + outline / stats / export helpers,
 * entirely client-side with no data leaving the browser. Security: all output HTML is sanitised
 * (stripping script tags, event attributes and `javascript:` links) before the UI layer may use
 * dangerouslySetInnerHTML. Error codes are decoupled from copy (T29 convention).
 */

export type MarkdownErrorCode = 'EMPTY' | 'PARSE';

/** Read limit for a single .md file (also the draft limit) */
export const MAX_MARKDOWN_BYTES = 2 * 1024 * 1024;

export const DEFAULT_DOCUMENT_NAME = 'untitled';

export interface MarkdownOptions {
  /** GitHub-flavoured Markdown (tables / strikethrough etc.), on by default */
  gfm: boolean;
  /** Convert newlines to <br>, off by default */
  breaks: boolean;
}

export const DEFAULT_MARKDOWN_OPTIONS: MarkdownOptions = { gfm: true, breaks: false };

/** Markdown → sanitised HTML string */
export function renderMarkdown(
  text: string,
  options: MarkdownOptions = DEFAULT_MARKDOWN_OPTIONS,
): ToolResult<string> {
  if (!text.trim()) return { ok: false, error: 'EMPTY' };
  try {
    const html = marked.parse(text, {
      async: false,
      gfm: options.gfm,
      breaks: options.breaks,
    });
    return { ok: true, value: DOMPurify.sanitize(html) };
  } catch {
    return { ok: false, error: 'PARSE' };
  }
}

/* ----------------------------- Document stats ----------------------------- */

export interface MarkdownStats {
  /** Character count (code points, whitespace and punctuation included) */
  characters: number;
  /** Word count: CJK counted per character, Latin per word */
  words: number;
  lines: number;
  /** Estimated reading time in minutes, at 300 words per minute */
  readingMinutes: number;
}

const CJK_RE = /[\u3400-\u4dbf\u4e00-\u9fff\uf900-\ufaff]/g;
const LATIN_WORD_RE = /[A-Za-z0-9][A-Za-z0-9'’-]*/g;

/** Document stats: words (mixed CJK and Latin) / characters / lines / reading time */
export function countMarkdownStats(text: string): MarkdownStats {
  const characters = Array.from(text).length;
  const lines = text.length === 0 ? 0 : text.split(/\r\n|\r|\n/).length;
  const cjk = text.match(CJK_RE)?.length ?? 0;
  const latin = text.match(LATIN_WORD_RE)?.length ?? 0;
  const words = cjk + latin;
  return {
    characters,
    words,
    lines,
    readingMinutes: words === 0 ? 0 : Math.max(1, Math.ceil(words / 300)),
  };
}

/* ----------------------------- Outline and anchors ----------------------------- */

/** Outline entry: `offset` locates it in the editor, `id` matches the preview anchor */
export interface MarkdownOutlineItem {
  level: number;
  text: string;
  offset: number;
  id: string;
}

const HEADING_TAG_RE = /<h([1-6])(\s[^>]*)?>([\s\S]*?)<\/h\1>/gi;

/** Preview anchor id rule: heading n (0-based) maps to md-h-(n+1) */
export function headingAnchorId(index: number): string {
  return `md-h-${index + 1}`;
}

/**
 * Inject anchor ids into the headings of already-sanitised preview HTML, in document order.
 *
 * Runs **after** sanitising: generating the ids here keeps them strictly in sync with the outline
 * (marked's own ids are affected by sanitising and behave differently across versions).
 */
export function applyHeadingIds(html: string): string {
  let index = 0;
  return html.replace(
    HEADING_TAG_RE,
    (_match, level: string, attrs: string | undefined, inner: string) => {
      const id = headingAnchorId(index);
      index += 1;
      return `<h${level}${attrs ?? ''} id="${id}">${inner}</h${level}>`;
    },
  );
}

const FENCE_RE = /^(?:```|~~~)/;
const ATX_HEADING_RE = /^(#{1,6})\s+(.*?)\s*#*\s*$/;

/** Extract ATX headings from Markdown source (skipping fenced code blocks) into a jumpable outline */
export function extractOutline(markdown: string): MarkdownOutlineItem[] {
  const outline: MarkdownOutlineItem[] = [];
  const lines = markdown.split('\n');
  let offset = 0;
  let fence: string | null = null;
  for (const line of lines) {
    if (FENCE_RE.test(line)) {
      const token = line.slice(0, 3);
      if (fence === null) fence = token;
      else if (fence === token) fence = null;
    } else if (fence === null) {
      const match = ATX_HEADING_RE.exec(line);
      if (match) {
        outline.push({
          level: match[1].length,
          text: match[2],
          offset,
          id: headingAnchorId(outline.length),
        });
      }
    }
    offset += line.length + 1;
  }
  return outline;
}

/* ----------------------------- Filename and export ----------------------------- */

/** Sanitise a filename: drop path separators and control characters; fall back to the default when empty */
export function sanitizeFilename(name: string): string {
  const cleaned = name
    // eslint-disable-next-line no-control-regex -- strip control characters and path separators
    .replace(/[\u0000-\u001f\u007f/\\:*?"<>|]/g, '')
    .replace(/^\.+/, '')
    .trim();
  return cleaned.slice(0, 64) || DEFAULT_DOCUMENT_NAME;
}

/** Append the extension (never duplicated when already present) */
export function withExtension(name: string, ext: string): string {
  const base = sanitizeFilename(name);
  return base.toLowerCase().endsWith(ext.toLowerCase()) ? base : `${base}${ext}`;
}

function escapeHtml(text: string): string {
  return text.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}

/** Inlined styles for exported HTML: self-contained single file, light / dark follows the system */
const EXPORT_STYLE = `:root { color-scheme: light dark; }
body { margin: 0; padding: 2.5rem 1.25rem; background: #ffffff; }
.markdown-body { max-width: 46rem; margin: 0 auto; font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", "PingFang SC", "Hiragino Sans GB", "Microsoft YaHei", sans-serif; font-size: 16px; line-height: 1.75; color: #1f2937; word-wrap: break-word; }
.markdown-body h1, .markdown-body h2, .markdown-body h3, .markdown-body h4, .markdown-body h5, .markdown-body h6 { margin: 1.6em 0 0.6em; font-weight: 600; line-height: 1.3; }
.markdown-body h1 { font-size: 2em; border-bottom: 1px solid #e5e7eb; padding-bottom: 0.3em; }
.markdown-body h2 { font-size: 1.5em; border-bottom: 1px solid #e5e7eb; padding-bottom: 0.3em; }
.markdown-body h3 { font-size: 1.25em; }
.markdown-body p, .markdown-body ul, .markdown-body ol, .markdown-body blockquote, .markdown-body pre, .markdown-body table { margin: 0.9em 0; }
.markdown-body ul, .markdown-body ol { padding-left: 1.6em; }
.markdown-body a { color: #2563eb; }
.markdown-body code { background: #f3f4f6; border-radius: 4px; padding: 0.15em 0.4em; font-family: ui-monospace, SFMono-Regular, Menlo, Consolas, monospace; font-size: 0.88em; }
.markdown-body pre { background: #f6f8fa; border-radius: 8px; padding: 1em; overflow-x: auto; }
.markdown-body pre code { background: none; padding: 0; }
.markdown-body blockquote { border-left: 4px solid #d1d5db; padding: 0.2em 0 0.2em 1em; color: #4b5563; }
.markdown-body table { border-collapse: collapse; width: 100%; }
.markdown-body th, .markdown-body td { border: 1px solid #d1d5db; padding: 0.4em 0.75em; text-align: left; }
.markdown-body th { background: #f9fafb; }
.markdown-body img { max-width: 100%; }
.markdown-body hr { border: none; border-top: 1px solid #e5e7eb; margin: 2em 0; }
.markdown-body del { color: #9ca3af; }
@media (prefers-color-scheme: dark) {
  body { background: #0b1220; }
  .markdown-body { color: #e5e7eb; }
  .markdown-body h1, .markdown-body h2 { border-bottom-color: #1f2937; }
  .markdown-body a { color: #60a5fa; }
  .markdown-body code { background: #1f2937; }
  .markdown-body pre { background: #111827; }
  .markdown-body blockquote { border-left-color: #374151; color: #d1d5db; }
  .markdown-body th, .markdown-body td { border-color: #374151; }
  .markdown-body th { background: #111827; }
  .markdown-body hr { border-top-color: #1f2937; }
}`;

/** Build a standalone HTML document (single self-contained file, no external dependencies) */
export function buildHtmlDocument(title: string, bodyHtml: string): string {
  return `<!doctype html>
<html lang="zh-CN">
<head>
<meta charset="utf-8" />
<meta name="viewport" content="width=device-width, initial-scale=1" />
<title>${escapeHtml(title)}</title>
<style>
${EXPORT_STYLE}
</style>
</head>
<body>
<article class="markdown-body">
${bodyHtml}
</article>
</body>
</html>
`;
}
