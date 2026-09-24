import type { ToolResult } from '@/core/types';

export type Pbkdf2Hash = 'SHA-256' | 'SHA-512';
export type HashEncoding = 'hex' | 'base64';

export interface Pbkdf2Options {
  password: string;
  /** 16 进制盐；省略则随机生成 16 字节 */
  salt?: string;
  iterations: number;
  hash: Pbkdf2Hash;
  encoding: HashEncoding;
}

export interface Pbkdf2Result {
  hash: string;
  salt: string;
  iterations: number;
  /** 通用格式：pbkdf2$<hash>$<iters>$<saltHex>$<hashHex> */
  format: string;
}

function bytesToHex(bytes: Uint8Array): string {
  let hex = '';
  for (let i = 0; i < bytes.length; i += 1) hex += bytes[i].toString(16).padStart(2, '0');
  return hex;
}

function bytesToBase64(bytes: Uint8Array): string {
  let binary = '';
  const CHUNK = 0x8000;
  for (let i = 0; i < bytes.length; i += CHUNK) {
    binary += String.fromCharCode(...bytes.subarray(i, i + CHUNK));
  }
  return btoa(binary);
}

function hexToBytes(hex: string): Uint8Array | null {
  const cleaned = hex.replace(/\s+/g, '').toLowerCase();
  if (!cleaned || cleaned.length % 2 !== 0 || /[^0-9a-f]/.test(cleaned)) return null;
  const bytes = new Uint8Array(cleaned.length / 2);
  for (let i = 0; i < bytes.length; i += 1) {
    bytes[i] = parseInt(cleaned.slice(i * 2, i * 2 + 2), 16);
  }
  return bytes;
}

/** 基于 WebCrypto 的 PBKDF2 派生（零额外依赖）。 */
export async function pbkdf2(options: Pbkdf2Options): Promise<ToolResult<Pbkdf2Result>> {
  if (!options.password) return { ok: false, error: 'EMPTY' };

  const iterations = Number.isFinite(options.iterations) ? Math.floor(options.iterations) : 0;
  if (iterations < 1 || iterations > 10_000_000) return { ok: false, error: 'INVALID_ITERS' };

  let saltBytes: Uint8Array;
  if (options.salt?.trim()) {
    const parsed = hexToBytes(options.salt.trim());
    if (!parsed || parsed.length < 8) return { ok: false, error: 'INVALID_SALT' };
    saltBytes = parsed;
  } else {
    saltBytes = crypto.getRandomValues(new Uint8Array(16));
  }

  try {
    const material = await crypto.subtle.importKey(
      'raw',
      new TextEncoder().encode(options.password),
      'PBKDF2',
      false,
      ['deriveBits'],
    );
    const length = options.hash === 'SHA-512' ? 512 : 256;
    const bits = await crypto.subtle.deriveBits(
      { name: 'PBKDF2', salt: saltBytes, iterations, hash: options.hash },
      material,
      length,
    );
    const derived = new Uint8Array(bits);
    const saltHex = bytesToHex(saltBytes);
    const hashHex = bytesToHex(derived);
    const encoded = options.encoding === 'hex' ? hashHex : bytesToBase64(derived);
    const format = `pbkdf2$${options.hash.toLowerCase()}$${iterations}$${saltHex}$${hashHex}`;
    return { ok: true, value: { hash: encoded, salt: saltHex, iterations, format } };
  } catch {
    return { ok: false, error: 'DERIVE_FAILED' };
  }
}
