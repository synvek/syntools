import type { ToolResult } from '@/core/types';

export type SampleOp = 'reverse' | 'upper' | 'lower';

export const sampleOps: { value: SampleOp; label: string }[] = [
  { value: 'reverse', label: '反转' },
  { value: 'upper', label: '转大写' },
  { value: 'lower', label: '转小写' },
];

/** Pure-function core: always returns ToolResult and never throws at callers (technical design §8.2) */
export function sampleTransform(input: string, op: SampleOp): ToolResult<string> {
  if (input.length === 0) {
    return { ok: false, error: '请先输入文本' };
  }
  switch (op) {
    case 'reverse':
      // Reverse by code point so supplementary-plane characters such as emoji are handled correctly
      return { ok: true, value: [...input].reverse().join('') };
    case 'upper':
      return { ok: true, value: input.toUpperCase() };
    case 'lower':
      return { ok: true, value: input.toLowerCase() };
  }
}
