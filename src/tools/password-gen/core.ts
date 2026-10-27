import type { ToolResult } from '@/core/types';

/**
 * Random password generation (Tasks T38): crypto.getRandomValues + rejection sampling (no modulo bias).
 * Error codes are decoupled from copy: core returns language-agnostic error codes and the UI translates them via i18n (T29 convention).
 */

export type PasswordErrorCode = 'NO_SETS' | 'INVALID_LENGTH';

export interface PasswordOptions {
  length: number;
  lowercase: boolean;
  uppercase: boolean;
  digits: boolean;
  symbols: boolean;
  /** Exclude easily confused characters (0 O 1 l I | ` ' ") */
  excludeAmbiguous: boolean;
  /** Guarantee at least one character from every selected character set */
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

/** Build the character sets from the options (empty sets are dropped after excluding confusables) */
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

/** Estimate entropy: length * log2(pool size) */
export function entropyBits(length: number, poolSize: number): number {
  if (poolSize <= 1) return 0;
  return length * Math.log2(poolSize);
}

export type Strength = 'weak' | 'medium' | 'strong';

/** Strength grading: < 50 bits weak, < 80 bits medium, otherwise strong (OWASP recommends ≥ 80) */
export function strengthOf(bits: number): Strength {
  if (bits < 50) return 'weak';
  if (bits < 80) return 'medium';
  return 'strong';
}

/** Uniform random integer in [0, max): rejection sampling removes modulo bias */
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

/** Generate a random password; on failure error is a PasswordErrorCode */
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

  // Fisher-Yates shuffle: stops the guaranteed characters from staying at the front
  for (let i = chars.length - 1; i > 0; i -= 1) {
    const j = randomInt(i + 1);
    [chars[i], chars[j]] = [chars[j], chars[i]];
  }
  return { ok: true, value: chars.join('') };
}
