import beautify from 'js-beautify';
import { minify as cssMinify } from 'csso';
import type { ToolResult } from '@/core/types';

/**
 * CSS minify / format: formatting uses js-beautify, minification uses csso.
 * Error codes are decoupled from copy: core returns language-neutral codes that the UI translates via i18n.
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
