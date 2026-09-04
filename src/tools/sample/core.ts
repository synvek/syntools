import type { ToolResult } from '@/core/types';

export type SampleOp = 'reverse' | 'upper' | 'lower';

export const sampleOps: { value: SampleOp; label: string }[] = [
  { value: 'reverse', label: '反转' },
  { value: 'upper', label: '转大写' },
  { value: 'lower', label: '转小写' },
];

/** 纯函数核心：统一返回 ToolResult，不向调用方抛异常（技术设计 §8.2） */
export function sampleTransform(input: string, op: SampleOp): ToolResult<string> {
  if (input.length === 0) {
    return { ok: false, error: '请先输入文本' };
  }
  switch (op) {
    case 'reverse':
      // 按码点反转，正确处理 emoji 等增补平面字符
      return { ok: true, value: [...input].reverse().join('') };
    case 'upper':
      return { ok: true, value: input.toUpperCase() };
    case 'lower':
      return { ok: true, value: input.toLowerCase() };
  }
}
