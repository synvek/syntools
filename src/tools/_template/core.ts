import type { ToolResult } from '@/core/types';

/**
 * Pure-function computation template:
 * - input -> output only; never touches the DOM, network or storage;
 * - always returns a ToolResult and never throws at the caller;
 * - async tools return Promise<ToolResult> and must not reject either.
 */

export interface TextStats {
  chars: number;
  words: number;
  lines: number;
}

/** Count characters / words / lines (replace with your own tool's logic) */
export function countText(input: string): ToolResult<TextStats> {
  if (!input.trim()) {
    return { ok: false, error: '请输入要统计的内容' };
  }
  const chars = [...input].length;
  const words = input.trim().split(/\s+/).length;
  const lines = input.split('\n').length;
  return { ok: true, value: { chars, words, lines } };
}
