import beautify from 'js-beautify';
import type { ToolResult } from '@/core/types';

/**
 * HTML 压缩 / 格式化：格式化走 js-beautify，压缩为轻量本地实现（避免引入 html-minifier-terser/terser）。
 * 错误码与文案解耦：core 返回语言无关错误码，UI 层经 i18n 翻译。
 */

export type HtmlErrorCode = 'EMPTY' | 'INVALID';
export type IndentSize = 2 | 4;
export type HtmlAction = 'format' | 'compress';

/** 压缩：去掉注释、折叠标签间空白；保留 pre/textarea/script/style 内容 */
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
  // 再次折叠因占位符两侧残留的空白
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
