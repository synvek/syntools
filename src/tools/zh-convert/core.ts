import { sify, tify } from 'chinese-conv';
import type { ToolResult } from '@/core/types';

/**
 * 简繁体转换（chinese-conv，字符级映射）。
 */

export type ZhConvertDirection = 's2t' | 't2s';
export type ZhConvertError = 'EMPTY';

export function convertZh(
  input: string,
  direction: ZhConvertDirection,
): ToolResult<string> {
  if (!input) return { ok: false, error: 'EMPTY' };
  return {
    ok: true,
    value: direction === 's2t' ? tify(input) : sify(input),
  };
}
