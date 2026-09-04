import type { ToolResult } from '@/core/types';

export type AesErrorCode = 'EMPTY' | 'INVALID_KEY' | 'DECRYPT_FAILED' | 'INVALID_INPUT';

const SALT_LEN = 16;
const IV_LEN = 12;
const KEY_LEN = 32;
const PBKDF2_ITERS = 100_000;
const CHUNK = 0x8000;

function bytesToBase64(bytes: Uint8Array): string {
  let binary = '';
  for (let i = 0; i < bytes.length; i += CHUNK) {
    binary += String.fromCharCode(...bytes.subarray(i, i + CHUNK));
  }
  return btoa(binary);
}

function base64ToBytes(input: string): Uint8Array | null {
  try {
    const normalized = input.replace(/\s+/g, '');
    const bin = atob(normalized);
    const bytes = new Uint8Array(bin.length);
    for (let i = 0; i < bin.length; i += 1) bytes[i] = bin.charCodeAt(i);
    return bytes;
  } catch {
    return null;
  }
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

function concat(...parts: Uint8Array[]): Uint8Array {
  const total = parts.reduce((n, p) => n + p.length, 0);
  const out = new Uint8Array(total);
  let offset = 0;
  for (const part of parts) {
    out.set(part, offset);
    offset += part.length;
  }
  return out;
}

async function deriveKeyFromPassphrase(passphrase: string, salt: Uint8Array): Promise<CryptoKey> {
  const material = await crypto.subtle.importKey(
    'raw',
    new TextEncoder().encode(passphrase),
    'PBKDF2',
    false,
    ['deriveKey'],
  );
  return crypto.subtle.deriveKey(
    { name: 'PBKDF2', salt, iterations: PBKDF2_ITERS, hash: 'SHA-256' },
    material,
    { name: 'AES-GCM', length: KEY_LEN * 8 },
    false,
    ['encrypt', 'decrypt'],
  );
}

async function importRawKey(keyBytes: Uint8Array): Promise<CryptoKey | null> {
  if (keyBytes.length !== 16 && keyBytes.length !== 32) return null;
  try {
    return await crypto.subtle.importKey(
      'raw',
      keyBytes,
      { name: 'AES-GCM', length: keyBytes.length * 8 },
      false,
      ['encrypt', 'decrypt'],
    );
  } catch {
    return null;
  }
}

export type AesKeyMode = 'passphrase' | 'raw';

export interface AesEncryptOptions {
  plaintext: string;
  mode: AesKeyMode;
  passphrase?: string;
  keyHex?: string;
  /** optional IV as hex (12 bytes); random if omitted */
  ivHex?: string;
}

export interface AesDecryptOptions {
  ciphertext: string;
  mode: AesKeyMode;
  passphrase?: string;
  keyHex?: string;
}

/** AES-GCM encrypt; output base64(salt|iv|ciphertext+tag) */
export async function encryptAes(options: AesEncryptOptions): Promise<ToolResult<string>> {
  const plaintext = options.plaintext;
  if (!plaintext) return { ok: false, error: 'EMPTY' };

  let key: CryptoKey | null = null;
  const salt = crypto.getRandomValues(new Uint8Array(SALT_LEN));

  if (options.mode === 'passphrase') {
    const passphrase = options.passphrase ?? '';
    if (!passphrase) return { ok: false, error: 'INVALID_KEY' };
    try {
      key = await deriveKeyFromPassphrase(passphrase, salt);
    } catch {
      return { ok: false, error: 'INVALID_KEY' };
    }
  } else {
    const keyBytes = hexToBytes(options.keyHex ?? '');
    if (!keyBytes) return { ok: false, error: 'INVALID_KEY' };
    key = await importRawKey(keyBytes);
    if (!key) return { ok: false, error: 'INVALID_KEY' };
  }

  let iv: Uint8Array;
  if (options.ivHex?.trim()) {
    const parsed = hexToBytes(options.ivHex);
    if (!parsed || parsed.length !== IV_LEN) return { ok: false, error: 'INVALID_INPUT' };
    iv = parsed;
  } else {
    iv = crypto.getRandomValues(new Uint8Array(IV_LEN));
  }

  try {
    const cipherBuf = await crypto.subtle.encrypt(
      { name: 'AES-GCM', iv: iv as BufferSource },
      key,
      new TextEncoder().encode(plaintext),
    );
    const packed = concat(salt, iv, new Uint8Array(cipherBuf));
    return { ok: true, value: bytesToBase64(packed) };
  } catch {
    return { ok: false, error: 'INVALID_INPUT' };
  }
}

/** AES-GCM decrypt from base64(salt|iv|ciphertext+tag) */
export async function decryptAes(options: AesDecryptOptions): Promise<ToolResult<string>> {
  const raw = options.ciphertext.trim();
  if (!raw) return { ok: false, error: 'EMPTY' };

  const packed = base64ToBytes(raw);
  if (!packed || packed.length < SALT_LEN + IV_LEN + 16) {
    return { ok: false, error: 'INVALID_INPUT' };
  }

  const salt = packed.subarray(0, SALT_LEN);
  const iv = packed.subarray(SALT_LEN, SALT_LEN + IV_LEN);
  const ciphertext = packed.subarray(SALT_LEN + IV_LEN);

  let key: CryptoKey | null = null;
  if (options.mode === 'passphrase') {
    const passphrase = options.passphrase ?? '';
    if (!passphrase) return { ok: false, error: 'INVALID_KEY' };
    try {
      key = await deriveKeyFromPassphrase(passphrase, salt);
    } catch {
      return { ok: false, error: 'INVALID_KEY' };
    }
  } else {
    const keyBytes = hexToBytes(options.keyHex ?? '');
    if (!keyBytes) return { ok: false, error: 'INVALID_KEY' };
    key = await importRawKey(keyBytes);
    if (!key) return { ok: false, error: 'INVALID_KEY' };
  }

  try {
    const plainBuf = await crypto.subtle.decrypt(
      { name: 'AES-GCM', iv: iv as BufferSource },
      key,
      ciphertext,
    );
    return { ok: true, value: new TextDecoder().decode(plainBuf) };
  } catch {
    return { ok: false, error: 'DECRYPT_FAILED' };
  }
}
