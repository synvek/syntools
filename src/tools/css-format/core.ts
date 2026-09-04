import beautify from 'js-beautify';
import { minify as cssMinify } from 'csso';
import type { ToolResult } from '@/core/types';

/**
 * CSS 压缩 / 格式化：格式化走 js-beautify，压缩走 csso。
 * 错误码与文案解耦：core 返回语言无关错误码，UI 层经 i18n 翻译。
 */

export type CssErrorCode = 'EMPTY' | 'INVALID';
export type IndentSize = 2 | 4;
export type CssAction = 'format' | 'compress';

export function processCss(
  input: string,
  action: CssAction,
  indent: IndentSize = 2,
): ToolResult<string> {
  if (!input.trim()) return { ok: false, error: 'EMPTY' };
  try {
    if (action === 'format') {
      return {
        ok: true,
        value: beautify.css(input, {
          indent_size: indent,
          end_with_newline: false,
        }),
      };
    }
    return { ok: true, value: cssMinify(input).css };
  } catch {
    return { ok: false, error: 'INVALID' };
  }
}
