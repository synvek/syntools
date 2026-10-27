import { pinyin } from 'pinyin-pro';
import type { ToolResult } from '@/core/types';

/**
 * Chinese characters to pinyin (pinyin-pro): optional tone marks; polyphonic characters use the common reading.
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
    /** Enable tone marks (diacritics, e.g. zhōng) */
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
    // Non-Chinese characters are kept as-is
    nonZh: 'consecutive',
  });

  let value = parts.join(separator);
  if (letterCase === 'upper') value = value.toUpperCase();
  // toneType none is already lowercase; symbol tones keep a lowercase syllable plus the tone mark
  else if (!tone) value = value.toLowerCase();

  return { ok: true, value };
}
