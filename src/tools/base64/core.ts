import type { ToolResult } from '@/core/types';

const BASE64_ALPHABET = /^[A-Za-z0-9+/]$/;
const CHUNK_SIZE = 0x8000;

/** 字节 → Base64 字符串（分块处理，文件模式可直接复用） */
export function bytesToBase64(bytes: Uint8Array, urlSafe = false): string {
  let binary = '';
  for (let i = 0; i < bytes.length; i += CHUNK_SIZE) {
    binary += String.fromCharCode(...bytes.subarray(i, i + CHUNK_SIZE));
  }
  let result = btoa(binary);
  if (urlSafe) {
    result = result.replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
  }
  return result;
}

/** Base64 字符串 → 字节；校验字符集与长度，非法输入返回错误码 */
export function base64ToBytes(input: string, urlSafe = false): ToolResult<Uint8Array> {
  let normalized = input.replace(/\s+/g, '');
  if (urlSafe) {
    normalized = normalized.replace(/-/g, '+').replace(/_/g, '/');
  }

  for (let i = 0; i < normalized.length; i++) {
    const ch = normalized[i];
    if (ch === '=') {
      if (i < normalized.length - 2 || !/^=+$/.test(normalized.slice(i))) {
        return { ok: false, error: 'INVALID_PADDING', params: { position: i } };
      }
      break;
    }
    if (!BASE64_ALPHABET.test(ch)) {
      return { ok: false, error: 'INVALID_CHAR', params: { position: i, char: ch } };
    }
  }

  const contentLength = normalized.replace(/=+$/, '').length;
  if (contentLength % 4 === 1) {
    return { ok: false, error: 'INVALID_LENGTH' };
  }

  try {
    const binary = atob(normalized);
    const bytes = new Uint8Array(binary.length);
    for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
    return { ok: true, value: bytes };
  } catch {
    return { ok: false, error: 'DECODE_FAILED' };
  }
}

/** 文本 → Base64（TextEncoder 保证 Unicode 安全） */
export function encodeBase64(input: string, urlSafe = false): ToolResult<string> {
  return { ok: true, value: bytesToBase64(new TextEncoder().encode(input), urlSafe) };
}

/** Base64 → 文本（UTF-8 解码） */
export function decodeBase64(input: string, urlSafe = false): ToolResult<string> {
  const bytes = base64ToBytes(input, urlSafe);
  if (!bytes.ok) return bytes;
  return { ok: true, value: new TextDecoder().decode(bytes.value) };
}
