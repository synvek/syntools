import beautify from 'js-beautify';
import type { ToolResult } from '@/core/types';

/**
 * HTML minify / format: formatting uses js-beautify, minification is a lightweight local implementation (avoiding html-minifier-terser/terser).
 * Error codes are decoupled from copy: core returns language-neutral codes that the UI translates via i18n.
 */

export type HtmlErrorCode = 'EMPTY' | 'INVALID';
export type IndentSize = 2 | 4;
export type HtmlAction = 'format' | 'compress';

/** Minify: drop comments and collapse whitespace between tags, leaving pre/textarea/script/style content intact */
export function minifyHtml(input: string): string {
  const blocks: string[] = [];
  const preserved = input.replace(
    /<(pre|textarea|script|style)\b[^>]*>[\s\S]*?<\/\1>/gi,
    (match) => {
      const i = blocks.length;
      blocks.push(match);
      return `\u0000BLOCK${i}\u0000`;
    },
  );
  let result = preserved
    .replace(/<!--[\s\S]*?-->/g, '')
    .replace(/>\s+</g, '><')
    .replace(/^\s+|\s+$/g, '')
    .replace(/\s{2,}/g, ' ');
  // Collapse the whitespace left on either side of the placeholders
  result = result.replace(/>\s+/g, '>').replace(/\s+</g, '<');
  // eslint-disable-next-line no-control-regex -- sentinel placeholders use NUL delimiters
  result = result.replace(/\u0000BLOCK(\d+)\u0000/g, (_, i) => blocks[Number(i)]);
  return result;
}

export function processHtml(
  input: string,
  action: HtmlAction,
  indent: IndentSize = 2,
): ToolResult<string> {
  if (!input.trim()) return { ok: false, error: 'EMPTY' };
  try {
    if (action === 'format') {
      return {
        ok: true,
        value: beautify.html(input, {
          indent_size: indent,
          indent_inner_html: true,
          wrap_line_length: 0,
          end_with_newline: false,
        }),
      };
    }
    return { ok: true, value: minifyHtml(input) };
  } catch {
    return { ok: false, error: 'INVALID' };
  }
}
