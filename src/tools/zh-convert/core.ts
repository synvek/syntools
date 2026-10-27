import { sify, tify } from 'chinese-conv';
import type { ToolResult } from '@/core/types';

/**
 * Traditional / Simplified Chinese conversion (chinese-conv, character-level mapping).
 */

export type ZhConvertDirection = 's2t' | 't2s';
export type ZhConvertError = 'EMPTY';

export function convertZh(input: string, direction: ZhConvertDirection): ToolResult<string> {
  if (!input) return { ok: false, error: 'EMPTY' };
  return {
    ok: true,
    value: direction === 's2t' ? tify(input) : sify(input),
  };
}
