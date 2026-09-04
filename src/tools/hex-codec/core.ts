import type { ToolResult } from '@/core/types';

export type HexErrorCode = 'EMPTY' | 'INVALID_HEX';

function bytesToHex(bytes: Uint8Array, spaced: boolean): string {
  let hex = '';
  for (let i = 0; i < bytes.length; i += 1) {
    if (spaced && i > 0) hex += ' ';
    hex += bytes[i].toString(16).padStart(2, '0');
  }
  return hex;
}

/** UTF-8 text → hex */
export function encodeHex(text: string, spaced = false): ToolResult<string> {
  if (!text) return { ok: false, error: 'EMPTY' };
  const bytes = new TextEncoder().encode(text);
  return { ok: true, value: bytesToHex(bytes, spaced) };
}

/** Hex → UTF-8 text */
export function decodeHex(hex: string): ToolResult<string> {
  const cleaned = hex.replace(/\s+/g, '');
  if (!cleaned) return { ok: false, error: 'EMPTY' };
  if (cleaned.length % 2 !== 0 || /[^0-9a-fA-F]/.test(cleaned)) {
    return { ok: false, error: 'INVALID_HEX' };
  }
  const bytes = new Uint8Array(cleaned.length / 2);
  for (let i = 0; i < bytes.length; i += 1) {
    bytes[i] = parseInt(cleaned.slice(i * 2, i * 2 + 2), 16);
  }
  try {
    return { ok: true, value: new TextDecoder('utf-8', { fatal: true }).decode(bytes) };
  } catch {
    return { ok: false, error: 'INVALID_HEX' };
  }
}
