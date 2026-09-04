import { pinyin } from 'pinyin-pro';
import type { ToolResult } from '@/core/types';

/**
 * 汉字转拼音（pinyin-pro）：支持声调开关；多音字取常用读音。
 */

export type PinyinCase = 'lower' | 'upper';
export type PinyinSeparator = 'space' | 'none' | 'dash';
export type PinyinError = 'EMPTY';

const SEP_MAP: Record<PinyinSeparator, string> = {
  space: ' ',
  none: '',
  dash: '-',
};

export function convertPinyin(
  input: string,
  options: {
    separator?: PinyinSeparator;
    letterCase?: PinyinCase;
    /** 启用声调（符号标调，如 zhōng） */
    tone?: boolean;
  } = {},
): ToolResult<string> {
  if (!input) return { ok: false, error: 'EMPTY' };

  const separator = SEP_MAP[options.separator ?? 'space'];
  const letterCase = options.letterCase ?? 'lower';
  const tone = options.tone === true;

  const parts = pinyin(input, {
    type: 'array',
    toneType: tone ? 'symbol' : 'none',
    // 非汉字原样保留
    nonZh: 'consecutive',
  });

  let value = parts.join(separator);
  if (letterCase === 'upper') value = value.toUpperCase();
  // toneType none 已是小写；symbol 声调字母保持小写音节 + 调号
  else if (!tone) value = value.toLowerCase();

  return { ok: true, value };
}
