import { gzip, ungzip } from 'pako';
import type { ToolResult } from '@/core/types';

export type GzipErrorCode = 'EMPTY' | 'INVALID' | 'DECOMPRESS_FAILED';

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
    const bin = atob(input.replace(/\s+/g, ''));
    const bytes = new Uint8Array(bin.length);
    for (let i = 0; i < bin.length; i += 1) bytes[i] = bin.charCodeAt(i);
    return bytes;
  } catch {
    return null;
  }
}

/** Gzip compress text → base64 */
export function gzipCompress(text: string): ToolResult<string> {
  if (!text) return { ok: false, error: 'EMPTY' };
  try {
    const compressed = gzip(text);
    return { ok: true, value: bytesToBase64(compressed) };
  } catch {
    return { ok: false, error: 'INVALID' };
  }
}

/** Gzip decompress base64 → text */
export function gzipDecompress(base64: string): ToolResult<string> {
  const trimmed = base64.trim();
  if (!trimmed) return { ok: false, error: 'EMPTY' };
  const bytes = base64ToBytes(trimmed);
  if (!bytes) return { ok: false, error: 'INVALID' };
  try {
    const inflated = ungzip(bytes);
    return { ok: true, value: new TextDecoder().decode(inflated) };
  } catch {
    return { ok: false, error: 'DECOMPRESS_FAILED' };
  }
}
