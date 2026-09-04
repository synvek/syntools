import type { ToolResult } from '@/core/types';

/**
 * 纯函数计算模板：
 * - 只做输入 → 输出，不触碰 DOM / 网络 / 存储；
 * - 统一返回 ToolResult，永不向调用方抛异常；
 * - 异步工具返回 Promise<ToolResult>，同样不得 reject。
 */

export interface TextStats {
  chars: number;
  words: number;
  lines: number;
}

/** 统计字符 / 单词 / 行数（替换为你自己工具的计算逻辑） */
export function countText(input: string): ToolResult<TextStats> {
  if (!input.trim()) {
    return { ok: false, error: '请输入要统计的内容' };
  }
  const chars = [...input].length;
  const words = input.trim().split(/\s+/).length;
  const lines = input.split('\n').length;
  return { ok: true, value: { chars, words, lines } };
}
