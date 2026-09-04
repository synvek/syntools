import type { ToolResult } from '@/core/types';

export type TotpErrorCode = 'EMPTY' | 'INVALID_SECRET';
export type TotpDigits = 6 | 8;

const BASE32_ALPHABET = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ234567';

/** Decode RFC 4648 base32 (ignore spaces/padding, case-insensitive) */
export function decodeBase32(input: string): ToolResult<Uint8Array> {
  const cleaned = input.replace(/[\s=]+/g, '').toUpperCase();
  if (!cleaned) return { ok: false, error: 'EMPTY' };
  let bits = 0;
  let value = 0;
  const out: number[] = [];
  for (const ch of cleaned) {
    const idx = BASE32_ALPHABET.indexOf(ch);
    if (idx < 0) return { ok: false, error: 'INVALID_SECRET' };
    value = (value << 5) | idx;
    bits += 5;
    if (bits >= 8) {
      out.push((value >>> (bits - 8)) & 0xff);
      bits -= 8;
    }
  }
  return { ok: true, value: new Uint8Array(out) };
}

function counterToBytes(counter: number): Uint8Array {
  const buf = new Uint8Array(8);
  let n = counter;
  for (let i = 7; i >= 0; i -= 1) {
    buf[i] = n & 0xff;
    n = Math.floor(n / 256);
  }
  return buf;
}

async function hmacSha1(key: Uint8Array, data: Uint8Array): Promise<Uint8Array> {
  const cryptoKey = await crypto.subtle.importKey(
    'raw',
    key,
    { name: 'HMAC', hash: 'SHA-1' },
    false,
    ['sign'],
  );
  const sig = await crypto.subtle.sign('HMAC', cryptoKey, data);
  return new Uint8Array(sig);
}

function truncateHotp(hmac: Uint8Array, digits: TotpDigits): string {
  const offset = hmac[hmac.length - 1] & 0x0f;
  const code =
    ((hmac[offset] & 0x7f) << 24) |
    ((hmac[offset + 1] & 0xff) << 16) |
    ((hmac[offset + 2] & 0xff) << 8) |
    (hmac[offset + 3] & 0xff);
  const mod = 10 ** digits;
  return String(code % mod).padStart(digits, '0');
}

export interface TotpResult {
  code: string;
  remaining: number;
  period: number;
  digits: TotpDigits;
}

/** Generate TOTP (RFC 6238) with HMAC-SHA1, period 30 */
export async function generateTotp(
  secretBase32: string,
  digits: TotpDigits = 6,
  nowMs = Date.now(),
  period = 30,
): Promise<ToolResult<TotpResult>> {
  const decoded = decodeBase32(secretBase32);
  if (!decoded.ok) return decoded;
  if (decoded.value.length === 0) return { ok: false, error: 'INVALID_SECRET' };

  try {
    const counter = Math.floor(nowMs / 1000 / period);
    const remaining = period - (Math.floor(nowMs / 1000) % period);
    const hmac = await hmacSha1(decoded.value, counterToBytes(counter));
    return {
      ok: true,
      value: { code: truncateHotp(hmac, digits), remaining, period, digits },
    };
  } catch {
    return { ok: false, error: 'INVALID_SECRET' };
  }
}

/** Verify a TOTP code with ±1 window */
export async function verifyTotp(
  secretBase32: string,
  code: string,
  digits: TotpDigits = 6,
  nowMs = Date.now(),
  period = 30,
): Promise<ToolResult<boolean>> {
  const cleaned = code.replace(/\s+/g, '');
  if (!cleaned) return { ok: false, error: 'EMPTY' };
  const current = await generateTotp(secretBase32, digits, nowMs, period);
  if (!current.ok) return current;
  if (cleaned === current.value.code) return { ok: true, value: true };

  const prev = await generateTotp(secretBase32, digits, nowMs - period * 1000, period);
  if (prev.ok && cleaned === prev.value.code) return { ok: true, value: true };
  const next = await generateTotp(secretBase32, digits, nowMs + period * 1000, period);
  if (next.ok && cleaned === next.value.code) return { ok: true, value: true };
  return { ok: true, value: false };
}
