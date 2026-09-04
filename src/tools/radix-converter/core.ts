import type { ToolResult } from '@/core/types';

/**
 * 进制转换与位运算（Tasks T40）：BigInt 实现，支持 64 位有符号整数。
 * 错误码与文案解耦：core 返回语言无关错误码，UI 层经 i18n 翻译（T29 约定）。
 */

export type RadixErrorCode = 'EMPTY' | 'INVALID' | 'RANGE';

export const RADIXES = [2, 8, 10, 16] as const;
export type Radix = (typeof RADIXES)[number];

/** 有符号 64 位整数范围 */
const MIN_I64 = -(2n ** 63n);
const MAX_I64 = 2n ** 63n - 1n;

export const BIT_OPERATORS = ['and', 'or', 'xor', 'shl', 'shr', 'not'] as const;
export type BitOperator = (typeof BIT_OPERATORS)[number];

export interface RadixFormats {
  bin: string;
  oct: string;
  dec: string;
  hex: string;
}

/** 前缀自动识别进制：0b→2 / 0o→8 / 0x→16 / 其余→10；带分隔符（_、空格、逗号）容忍 */
export function detectRadix(input: string): Radix {
  const text = input.trim().toLowerCase();
  if (text.startsWith('0b')) return 2;
  if (text.startsWith('0o')) return 8;
  if (text.startsWith('0x')) return 16;
  return 10;
}

/** 解析整数字符串为 BigInt；语法非法返回 INVALID，超出 i64 返回 RANGE */
export function parseInteger(input: string, radix: Radix): ToolResult<bigint> {
  let text = input.trim();
  if (!text) return { ok: false, error: 'EMPTY' };
  let sign = 1n;
  if (text.startsWith('-')) {
    sign = -1n;
    text = text.slice(1);
  } else if (text.startsWith('+')) {
    text = text.slice(1);
  }
  const lower = text.toLowerCase();
  const prefixMap: Record<number, string> = { 2: '0b', 8: '0o', 16: '0x' };
  if (radix !== 10 && lower.startsWith(prefixMap[radix])) {
    text = text.slice(2);
  } else if (/^0[box]/.test(lower)) {
    // 前缀与所选进制不一致
    return { ok: false, error: 'INVALID' };
  }
  text = text.replace(/[_\s,]/g, '');
  if (!text) return { ok: false, error: 'INVALID' };

  const digitRe: Record<number, RegExp> = {
    2: /^[01]+$/,
    8: /^[0-7]+$/,
    10: /^[0-9]+$/,
    16: /^[0-9a-f]+$/i,
  };
  if (!digitRe[radix].test(text)) return { ok: false, error: 'INVALID' };

  let value = 0n;
  const base = BigInt(radix);
  for (const ch of text.toLowerCase()) {
    const digit = BigInt(parseInt(ch, radix));
    value = value * base + digit;
  }
  value *= sign;
  if (value < MIN_I64 || value > MAX_I64) return { ok: false, error: 'RANGE' };
  return { ok: true, value };
}

/** 64 位补码表示（用于二进制可视化，固定 64 位字符串） */
function toTwosComplement64(value: bigint): bigint {
  return value < 0n ? value + 2n ** 64n : value;
}

/** BigInt → 四种进制字符串（负数带符号，hex/bin/oct 为大写无分隔） */
export function formatRadix(value: bigint): RadixFormats {
  const sign = value < 0n ? '-' : '';
  const abs = value < 0n ? -value : value;
  return {
    bin: sign + abs.toString(2),
    oct: sign + abs.toString(8),
    dec: value.toString(10),
    hex: sign + abs.toString(16).toUpperCase(),
  };
}

/** 64 位补码的二进制串（固定 64 字符，便于位模式展示） */
export function toBitPattern(value: bigint): string {
  return toTwosComplement64(value).toString(2).padStart(64, '0');
}

/** 按 4 位分组展示二进制（可读性），如 1111 0000 … */
export function groupBits(bits: string, groupSize = 4): string {
  const groups: string[] = [];
  for (let i = bits.length; i > 0; i -= groupSize) {
    groups.unshift(bits.slice(Math.max(0, i - groupSize), i));
  }
  return groups.join(' ');
}

const SHIFT_MASK = 63n; // 移位量对 64 取模（与常见语言 64 位行为一致）

/** 位运算：i64 范围内的与/或/异或/左移/右移/取反；结果超范围返回 RANGE */
export function applyBitOperator(op: BitOperator, a: bigint, b?: bigint): ToolResult<bigint> {
  let result: bigint;
  switch (op) {
    case 'and':
      if (b === undefined) return { ok: false, error: 'INVALID' };
      result = a & b;
      break;
    case 'or':
      if (b === undefined) return { ok: false, error: 'INVALID' };
      result = a | b;
      break;
    case 'xor':
      if (b === undefined) return { ok: false, error: 'INVALID' };
      result = a ^ b;
      break;
    case 'shl': {
      if (b === undefined) return { ok: false, error: 'INVALID' };
      const n = b & SHIFT_MASK;
      // 以补码移位再解释回有符号，模拟 64 位溢出回绕
      result = toTwosComplement64Signed((toTwosComplement64(a) << n) % 2n ** 64n);
      break;
    }
    case 'shr': {
      if (b === undefined) return { ok: false, error: 'INVALID' };
      // 算术右移（保留符号）
      result = a >> (b & SHIFT_MASK);
      break;
    }
    case 'not':
      result = ~a;
      break;
  }
  if (result < MIN_I64 || result > MAX_I64) return { ok: false, error: 'RANGE' };
  return { ok: true, value: result };
}

/** 补码（0 ~ 2^64）→ 有符号 i64 解释 */
function toTwosComplement64Signed(unsigned: bigint): bigint {
  return unsigned >= 2n ** 63n ? unsigned - 2n ** 64n : unsigned;
}
