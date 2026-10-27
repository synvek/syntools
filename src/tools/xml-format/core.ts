import beautify from 'js-beautify';
import type { ToolResult } from '@/core/types';

/**
 * XML formatting / minification: beautify reuses js-beautify.html, minify is a lightweight local implementation.
 */

export type XmlFormatError = 'EMPTY' | 'INVALID';
export type IndentSize = 2 | 4;
export type XmlAction = 'format' | 'compress';

export function minifyXml(input: string): string {
  const blocks: string[] = [];
  const preserved = input.replace(/<!\[CDATA\[[\s\S]*?\]\]>/g, (match) => {
    const i = blocks.length;
    blocks.push(match);
    return `\u0000CDATA${i}\u0000`;
  });
  let result = preserved
    .replace(/<!--[\s\S]*?-->/g, '')
    .replace(/>\s+</g, '><')
    .replace(/^\s+|\s+$/g, '')
    .replace(/\s{2,}/g, ' ');
  result = result.replace(/>\s+/g, '>').replace(/\s+</g, '<');
  // eslint-disable-next-line no-control-regex -- sentinel placeholders use NUL delimiters
  result = result.replace(/\u0000CDATA(\d+)\u0000/g, (_, i) => blocks[Number(i)]);
  return result;
}

export function processXml(
  input: string,
  action: XmlAction,
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
          // Self-closing tags read better in XML
          unformatted: [],
        }),
      };
    }
    return { ok: true, value: minifyXml(input) };
  } catch {
    return { ok: false, error: 'INVALID' };
  }
}
