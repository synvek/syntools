import type { ToolResult } from '@/core/types';

export const MAX_BATCH = 10_000;

export interface UuidFormatOptions {
  uppercase: boolean;
  hyphens: boolean;
  braces: boolean;
}

export const DEFAULT_FORMAT: UuidFormatOptions = {
  uppercase: false,
  hyphens: true,
  braces: false,
};

function v4Fallback(): string {
  const bytes = crypto.getRandomValues(new Uint8Array(16));
  bytes[6] = (bytes[6] & 0x0f) | 0x40;
  bytes[8] = (bytes[8] & 0x3f) | 0x80;
  const hex = Array.from(bytes, (b) => b.toString(16).padStart(2, '0')).join('');
  return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-${hex.slice(12, 16)}-${hex.slice(16, 20)}-${hex.slice(20)}`;
}

export function generateV4(): string {
  if (typeof crypto.randomUUID === 'function') return crypto.randomUUID();
  return v4Fallback();
}

export function generateV7(now = Date.now()): string {
  const ms = BigInt(now) & 0xffffffffffffn;
  const randA = crypto.getRandomValues(new Uint8Array(2));
  const randB = crypto.getRandomValues(new Uint8Array(8));
  const timeHex = ms.toString(16).padStart(12, '0');
  const randA12 = (((randA[0] << 8) | randA[1]) & 0x0fff).toString(16).padStart(3, '0');
  const variant = ((randB[0] & 0x3f) | 0x80).toString(16).padStart(2, '0');
  const rest = Array.from(randB.slice(1), (b) => b.toString(16).padStart(2, '0')).join('');
  return `${timeHex.slice(0, 8)}-${timeHex.slice(8)}-7${randA12}-${variant}${rest.slice(0, 2)}-${rest.slice(2)}`;
}

export function formatUuid(uuid: string, options: UuidFormatOptions): string {
  const hex = uuid.replace(/[-{}]/g, '');
  let result = options.hyphens
    ? `${hex.slice(0, 8)}-${hex.slice(8, 12)}-${hex.slice(12, 16)}-${hex.slice(16, 20)}-${hex.slice(20)}`
    : hex;
  if (options.braces) result = `{${result}}`;
  return options.uppercase ? result.toUpperCase() : result.toLowerCase();
}

export type UuidVersion = 'v4' | 'v7';

export function generateBatch(
  version: UuidVersion,
  count: number,
  options: UuidFormatOptions,
): ToolResult<string[]> {
  if (!Number.isInteger(count) || count < 1) {
    return { ok: false, error: 'INVALID_COUNT' };
  }
  if (count > MAX_BATCH) {
    return { ok: false, error: 'TOO_MANY', params: { max: MAX_BATCH } };
  }
  const generate = version === 'v4' ? generateV4 : generateV7;
  const list: string[] = [];
  for (let i = 0; i < count; i++) {
    list.push(formatUuid(generate(), options));
  }
  return { ok: true, value: list };
}
