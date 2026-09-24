import type { ToolResult } from '@/core/types';

export type BaseAlphabet = 'base16' | 'base32' | 'base32hex' | 'base64' | 'base64url' | 'base58';

const B32 = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ234567';
const B32HEX = '0123456789ABCDEFGHIJKLMNOPQRSTUV';
const B58 = '123456789ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz';

export function utf8ToBytes(str: string): Uint8Array {
  return new TextEncoder().encode(str);
}

export function bytesToBinaryString(bytes: Uint8Array): string {
  let out = '';
  for (let i = 0; i < bytes.length; i += 1024) {
    out += String.fromCharCode(...bytes.subarray(i, i + 1024));
  }
  return out;
}

export function binaryStringToBytes(bin: string): Uint8Array {
  const bytes = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i += 1) bytes[i] = bin.charCodeAt(i) & 0xff;
  return bytes;
}

function base32Encode(bytes: Uint8Array, alphabet: string): string {
  let bits = 0;
  let value = 0;
  let out = '';
  for (const b of bytes) {
    value = (value << 8) | b;
    bits += 8;
    while (bits >= 5) {
      out += alphabet[(value >>> (bits - 5)) & 31];
      bits -= 5;
    }
  }
  if (bits > 0) out += alphabet[(value << (5 - bits)) & 31];
  while (out.length % 8 !== 0) out += '=';
  return out;
}

function base32Decode(input: string, alphabet: string): ToolResult<Uint8Array> {
  const clean = input.replace(/=+$/g, '').toUpperCase();
  let bits = 0;
  let value = 0;
  const out: number[] = [];
  for (const ch of clean) {
    const idx = alphabet.indexOf(ch);
    if (idx < 0) return { ok: false, error: 'INVALID' };
    value = (value << 5) | idx;
    bits += 5;
    if (bits >= 8) {
      out.push((value >>> (bits - 8)) & 0xff);
      bits -= 8;
    }
  }
  return { ok: true, value: new Uint8Array(out) };
}

function base58Encode(bytes: Uint8Array): string {
  let num = 0n;
  for (const b of bytes) num = num * 256n + BigInt(b);
  let out = '';
  while (num > 0n) {
    const rem = Number(num % 58n);
    num /= 58n;
    out = B58[rem] + out;
  }
  for (const b of bytes) {
    if (b === 0) out = '1' + out;
    else break;
  }
  return out;
}

function base58Decode(input: string): ToolResult<Uint8Array> {
  let num = 0n;
  for (const ch of input) {
    const idx = B58.indexOf(ch);
    if (idx < 0) return { ok: false, error: 'INVALID' };
    num = num * 58n + BigInt(idx);
  }
  let hex = num.toString(16);
  if (hex.length % 2) hex = '0' + hex;
  const out = hex.match(/.{2}/g)?.map((h) => parseInt(h, 16)) ?? [];
  let leading = 0;
  while (leading < input.length && input[leading] === '1') leading += 1;
  return { ok: true, value: new Uint8Array([...new Array(leading).fill(0), ...out]) };
}

export function encodeBase(alphabet: BaseAlphabet, input: string): ToolResult<string> {
  const bytes = utf8ToBytes(input);
  switch (alphabet) {
    case 'base16':
      return {
        ok: true,
        value: Array.from(bytes, (b) => b.toString(16).padStart(2, '0'))
          .join('')
          .toUpperCase(),
      };
    case 'base32':
      return { ok: true, value: base32Encode(bytes, B32) };
    case 'base32hex':
      return { ok: true, value: base32Encode(bytes, B32HEX) };
    case 'base64':
      return { ok: true, value: btoa(bytesToBinaryString(bytes)) };
    case 'base64url': {
      const b64 = btoa(bytesToBinaryString(bytes));
      return { ok: true, value: b64.replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/g, '') };
    }
    case 'base58':
      return { ok: true, value: base58Encode(bytes) };
  }
}

export function decodeBase(alphabet: BaseAlphabet, input: string): ToolResult<string> {
  const trimmed = input.trim();
  if (!trimmed) return { ok: false, error: 'EMPTY' };
  try {
    let bytes: Uint8Array;
    switch (alphabet) {
      case 'base16': {
        const hex = trimmed.replace(/[^0-9a-fA-F]/g, '');
        if (hex.length % 2) return { ok: false, error: 'INVALID' };
        bytes = new Uint8Array(hex.match(/.{2}/g)?.map((h) => parseInt(h, 16)) ?? []);
        break;
      }
      case 'base32':
        return decodeText(base32Decode(trimmed, B32));
      case 'base32hex':
        return decodeText(base32Decode(trimmed, B32HEX));
      case 'base64': {
        const norm = trimmed.replace(/\s/g, '');
        bytes = binaryStringToBytes(atob(norm));
        break;
      }
      case 'base64url': {
        const norm = trimmed.replace(/-/g, '+').replace(/_/g, '/');
        const pad = norm.length % 4 ? '='.repeat(4 - (norm.length % 4)) : '';
        bytes = binaryStringToBytes(atob(norm + pad));
        break;
      }
      case 'base58':
        return decodeText(base58Decode(trimmed));
    }
    return { ok: true, value: new TextDecoder().decode(bytes!) };
  } catch {
    return { ok: false, error: 'INVALID' };
  }
}

function decodeText(r: ToolResult<Uint8Array>): ToolResult<string> {
  if (!r.ok) return r;
  return { ok: true, value: new TextDecoder().decode(r.value) };
}
