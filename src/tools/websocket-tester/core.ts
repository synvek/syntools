import type { ToolResult } from '@/core/types';

export type PayloadMode = 'text' | 'hex' | 'base64';

/** 校验 WebSocket 地址（仅允许 ws / wss） */
export function validateWsUrl(input: string): ToolResult<{ url: string; secure: boolean }> {
  const trimmed = input.trim();
  if (!trimmed) return { ok: false, error: 'EMPTY' };
  let url: URL;
  try {
    url = new URL(trimmed);
  } catch {
    return { ok: false, error: 'INVALID_URL' };
  }
  if (url.protocol !== 'ws:' && url.protocol !== 'wss:') {
    return { ok: false, error: 'INVALID_SCHEME' };
  }
  return { ok: true, value: { url: url.toString(), secure: url.protocol === 'wss:' } };
}

function toBytes(text: string): Uint8Array {
  return new TextEncoder().encode(text);
}

function fromBytes(bytes: Uint8Array): string {
  return new TextDecoder().decode(bytes);
}

/** 按模式编码待发送消息 */
export function encodePayload(text: string, mode: PayloadMode): ToolResult<string | Uint8Array> {
  if (mode === 'text') {
    if (!text) return { ok: false, error: 'EMPTY_MESSAGE' };
    return { ok: true, value: text };
  }
  if (mode === 'hex') {
    const compact = text.replace(/[\s:]/g, '');
    if (!compact) return { ok: false, error: 'EMPTY_MESSAGE' };
    if (compact.length % 2 !== 0 || !/^[0-9a-fA-F]+$/.test(compact)) {
      return { ok: false, error: 'INVALID_HEX' };
    }
    const bytes = new Uint8Array(compact.length / 2);
    for (let i = 0; i < bytes.length; i += 1) {
      bytes[i] = parseInt(compact.slice(i * 2, i * 2 + 2), 16);
    }
    return { ok: true, value: bytes };
  }
  try {
    const binary = atob(text.trim());
    const bytes = new Uint8Array(binary.length);
    for (let i = 0; i < binary.length; i += 1) bytes[i] = binary.charCodeAt(i);
    return { ok: true, value: bytes };
  } catch {
    return { ok: false, error: 'INVALID_BASE64' };
  }
}

/** 将收到的数据按模式展示为文本（兼容跨 realm 的 ArrayBuffer / TypedArray） */
export function decodePayload(data: unknown, mode: PayloadMode): string {
  if (typeof data === 'string') {
    return mode === 'hex' ? bytesToHex(toBytes(data)) : data;
  }
  let bytes: Uint8Array | null = null;
  if (data instanceof Uint8Array) {
    bytes = data;
  } else if (data instanceof ArrayBuffer) {
    bytes = new Uint8Array(data);
  } else if (data && typeof data === 'object' && 'byteLength' in data) {
    const view = data as { buffer?: ArrayBufferLike; byteOffset?: number; byteLength: number };
    bytes = new Uint8Array(
      view.buffer ?? (data as ArrayBufferLike),
      view.byteOffset ?? 0,
      view.byteLength,
    );
  }
  if (bytes) return mode === 'hex' ? bytesToHex(bytes) : fromBytes(bytes);
  if (typeof Blob !== 'undefined' && data instanceof Blob) {
    return `[Binary Blob ${data.size} B]`;
  }
  return String(data);
}

function bytesToHex(bytes: Uint8Array): string {
  return Array.from(bytes, (b) => b.toString(16).padStart(2, '0')).join(' ');
}

export interface LogEntry {
  id: number;
  direction: 'sent' | 'received' | 'system';
  text: string;
  at: number;
}

let seq = 0;
export function nextLogId(): number {
  seq += 1;
  return seq;
}

/** WebSocket 关闭码释义（RFC 6455 + 常见扩展） */
export function closeCodeText(code: number): string {
  const map: Record<number, string> = {
    1000: 'CLOSE_NORMAL',
    1001: 'CLOSE_GOING_AWAY',
    1002: 'CLOSE_PROTOCOL_ERROR',
    1003: 'CLOSE_UNSUPPORTED',
    1005: 'CLOSE_NO_STATUS',
    1006: 'CLOSE_ABNORMAL',
    1007: 'CLOSE_INVALID_PAYLOAD',
    1008: 'CLOSE_POLICY_VIOLATION',
    1009: 'CLOSE_TOO_LARGE',
    1010: 'CLOSE_MANDATORY_EXT',
    1011: 'CLOSE_SERVER_ERROR',
    1012: 'CLOSE_SERVICE_RESTART',
    1013: 'CLOSE_TRY_AGAIN_LATER',
    1014: 'CLOSE_BAD_GATEWAY',
    1015: 'CLOSE_TLS_HANDSHAKE',
  };
  return map[code] ?? 'CLOSE_UNKNOWN';
}
