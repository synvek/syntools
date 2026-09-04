import type { ToolResult } from '@/core/types';

/**
 * 随机密码生成（Tasks T38）：crypto.getRandomValues + 拒绝采样（无模偏差）。
 * 错误码与文案解耦：core 返回语言无关错误码，UI 层经 i18n 翻译（T29 约定）。
 */

export type PasswordErrorCode = 'NO_SETS' | 'INVALID_LENGTH';

export interface PasswordOptions {
  length: number;
  lowercase: boolean;
  uppercase: boolean;
  digits: boolean;
  symbols: boolean;
  /** 排除易混淆字符（0 O 1 l I | ` ' "） */
  excludeAmbiguous: boolean;
  /** 保证每个已选字符集至少出现一个字符 */
  ensureEach: boolean;
}

export const MIN_LENGTH = 4;
export const MAX_LENGTH = 128;

export const DEFAULT_OPTIONS: PasswordOptions = {
  length: 16,
  lowercase: true,
  uppercase: true,
  digits: true,
  symbols: true,
  excludeAmbiguous: false,
  ensureEach: true,
};

const SETS = {
  lowercase: 'abcdefghijklmnopqrstuvwxyz',
  uppercase: 'ABCDEFGHIJKLMNOPQRSTUVWXYZ',
  digits: '0123456789',
  symbols: '!@#$%^&*()-_=+[]{};:,.<>?/~',
} as const;

const AMBIGUOUS = new Set('0O1lI|`\'"'.split(''));

/** 按选项取各字符集（排除易混淆字符后过滤空集） */
export function poolFor(options: PasswordOptions): string[] {
  const selected = [
    options.lowercase ? SETS.lowercase : '',
    options.uppercase ? SETS.uppercase : '',
    options.digits ? SETS.digits : '',
    options.symbols ? SETS.symbols : '',
  ].filter(Boolean);
  return selected
    .map((set) =>
      options.excludeAmbiguous ? [...set].filter((c) => !AMBIGUOUS.has(c)).join('') : set,
    )
    .filter((set) => set.length > 0);
}

/** 估算熵：length * log2(字符池大小) */
export function entropyBits(length: number, poolSize: number): number {
  if (poolSize <= 1) return 0;
  return length * Math.log2(poolSize);
}

export type Strength = 'weak' | 'medium' | 'strong';

/** 强度分级：< 50bit 弱，< 80bit 中，否则强（OWASP 建议 ≥ 80） */
export function strengthOf(bits: number): Strength {
  if (bits < 50) return 'weak';
  if (bits < 80) return 'medium';
  return 'strong';
}

/** [0, max) 均匀随机整数：拒绝采样消除模偏差 */
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

/** 生成随机密码；错误时 error 为 PasswordErrorCode */
export function generatePassword(options: PasswordOptions): ToolResult<string> {
  const length = Math.floor(options.length);
  if (!Number.isFinite(length) || length < MIN_LENGTH || length > MAX_LENGTH) {
    return { ok: false, error: 'INVALID_LENGTH' };
  }
  const sets = poolFor(options);
  if (sets.length === 0) return { ok: false, error: 'NO_SETS' };
  const all = sets.join('');

  const chars: string[] = [];
  if (options.ensureEach && length >= sets.length) {
    for (const set of sets) chars.push(set[randomInt(set.length)]);
  }
  while (chars.length < length) chars.push(all[randomInt(all.length)]);

  // Fisher-Yates 洗牌：避免「保证字符」固定在开头
  for (let i = chars.length - 1; i > 0; i -= 1) {
    const j = randomInt(i + 1);
    [chars[i], chars[j]] = [chars[j], chars[i]];
  }
  return { ok: true, value: chars.join('') };
}
