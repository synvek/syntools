import type { ToolResult } from '@/core/types';

/**
 * Radix conversion and bitwise operations (Tasks T40): BigInt implementation supporting signed 64-bit integers.
 * Error codes are decoupled from copy: core returns language-agnostic error codes and the UI translates them via i18n (T29 convention).
 */

export type RadixErrorCode = 'EMPTY' | 'INVALID' | 'RANGE';

export const RADIXES = [2, 8, 10, 16] as const;
export type Radix = (typeof RADIXES)[number];

/** Signed 64-bit integer range */
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

/** Detect the radix from the prefix: 0b→2 / 0o→8 / 0x→16 / otherwise→10; separators (_, spaces, commas) are tolerated */
export function detectRadix(input: string): Radix {
  const text = input.trim().toLowerCase();
  if (text.startsWith('0b')) return 2;
  if (text.startsWith('0o')) return 8;
  if (text.startsWith('0x')) return 16;
  return 10;
}

/** Parse an integer string into BigInt; INVALID on bad syntax, RANGE when outside i64 */
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
    // Prefix does not match the selected radix
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

/** 64-bit two's complement (fixed 64-character string for binary visualization) */
function toTwosComplement64(value: bigint): bigint {
  return value < 0n ? value + 2n ** 64n : value;
}

/** BigInt → strings in four radices (negatives keep the sign; hex/bin/oct are uppercase and unseparated) */
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

/** Binary string of the 64-bit two's complement (always 64 chars, easy to read as a bit pattern) */
export function toBitPattern(value: bigint): string {
  return toTwosComplement64(value).toString(2).padStart(64, '0');
}

/** Group the binary digits in fours for readability, e.g. 1111 0000 … */
export function groupBits(bits: string, groupSize = 4): string {
  const groups: string[] = [];
  for (let i = bits.length; i > 0; i -= groupSize) {
    groups.unshift(bits.slice(Math.max(0, i - groupSize), i));
  }
  return groups.join(' ');
}

const SHIFT_MASK = 63n; // Shift amount modulo 64 (matches 64-bit behavior in common languages)

/** Bitwise and/or/xor/shl/shr/not within i64; RANGE when the result overflows */
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
      // Shift in two's complement then reinterpret as signed to emulate 64-bit wraparound
      result = toTwosComplement64Signed((toTwosComplement64(a) << n) % 2n ** 64n);
      break;
    }
    case 'shr': {
      if (b === undefined) return { ok: false, error: 'INVALID' };
      // Arithmetic right shift (keeps the sign)
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

/** Interpret two's complement (0 ~ 2^64) as signed i64 */
function toTwosComplement64Signed(unsigned: bigint): bigint {
  return unsigned >= 2n ** 63n ? unsigned - 2n ** 64n : unsigned;
}
