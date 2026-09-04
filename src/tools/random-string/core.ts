import type { ToolResult } from '@/core/types';

/**
 * 随机字符串生成：crypto 拒绝采样，支持预设字符集与自定义。
 */

export type RandomStringPreset = 'alpha' | 'alnum' | 'hex' | 'base64' | 'custom';
export type RandomStringError = 'EMPTY_CHARSET' | 'INVALID_LENGTH' | 'INVALID_COUNT';

export const MIN_LENGTH = 1;
export const MAX_LENGTH = 256;
export const MIN_COUNT = 1;
export const MAX_COUNT = 100;

export const PRESETS: Record<Exclude<RandomStringPreset, 'custom'>, string> = {
  alpha: 'abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ',
  alnum: 'abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789',
  hex: '0123456789abcdef',
  base64: 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/',
};

function randomInt(max: number): number {
  const limit = Math.floor(0x1_0000_0000 / max) * max;
  const buf = new Uint32Array(1);
  let x: number;
  do {
    crypto.getRandomValues(buf);
    x = buf[0];
  } while (x >= limit);
  return x % max;
}

export function resolveCharset(preset: RandomStringPreset, custom: string): string {
  if (preset === 'custom') return [...new Set(custom)].join('');
  return PRESETS[preset];
}

export function generateRandomStrings(options: {
  length: number;
  count: number;
  preset: RandomStringPreset;
  custom: string;
}): ToolResult<string[]> {
  const { length, count, preset, custom } = options;
  if (!Number.isInteger(length) || length < MIN_LENGTH || length > MAX_LENGTH) {
    return { ok: false, error: 'INVALID_LENGTH' };
  }
  if (!Number.isInteger(count) || count < MIN_COUNT || count > MAX_COUNT) {
    return { ok: false, error: 'INVALID_COUNT' };
  }
  const charset = resolveCharset(preset, custom);
  if (!charset) return { ok: false, error: 'EMPTY_CHARSET' };

  const out: string[] = [];
  for (let i = 0; i < count; i++) {
    let s = '';
    for (let j = 0; j < length; j++) s += charset[randomInt(charset.length)];
    out.push(s);
  }
  return { ok: true, value: out };
}
