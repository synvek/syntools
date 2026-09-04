import type { ToolResult } from '@/core/types';

export type HmacAlgorithm = 'SHA-256' | 'SHA-512';
export type HmacEncoding = 'hex' | 'base64';

export type HmacErrorCode = 'EMPTY' | 'INVALID_KEY';

const CHUNK = 0x8000;

function bytesToHex(bytes: Uint8Array): string {
  let hex = '';
  for (let i = 0; i < bytes.length; i += 1) hex += bytes[i].toString(16).padStart(2, '0');
  return hex;
}

function bytesToBase64(bytes: Uint8Array): string {
  let binary = '';
  for (let i = 0; i < bytes.length; i += CHUNK) {
    binary += String.fromCharCode(...bytes.subarray(i, i + CHUNK));
  }
  return btoa(binary);
}

/** HMAC-SHA256 / SHA512 via WebCrypto */
export async function computeHmac(
  message: string,
  secret: string,
  algorithm: HmacAlgorithm,
  encoding: HmacEncoding,
): Promise<ToolResult<string>> {
  if (!message) return { ok: false, error: 'EMPTY' };
  if (!secret) return { ok: false, error: 'INVALID_KEY' };

  try {
    const key = await crypto.subtle.importKey(
      'raw',
      new TextEncoder().encode(secret),
      { name: 'HMAC', hash: algorithm },
      false,
      ['sign'],
    );
    const sig = await crypto.subtle.sign('HMAC', key, new TextEncoder().encode(message));
    const bytes = new Uint8Array(sig);
    return {
      ok: true,
      value: encoding === 'hex' ? bytesToHex(bytes) : bytesToBase64(bytes),
    };
  } catch {
    return { ok: false, error: 'INVALID_KEY' };
  }
}
