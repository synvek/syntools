import type { ToolResult } from '@/core/types';

/**
 * JWT 解析（Tasks T33）：header.payload.signature 三段拆分 + base64url 解码 + JSON 解析。
 * 只读解析、不做验签（验签需要密钥，与数据不出浏览器原则无关，属范围外）。
 * 错误码与文案解耦：core 返回语言无关的错误码，UI 层经 i18n 翻译（T29 约定）。
 */

export type JwtErrorCode = 'EMPTY' | 'INVALID_PARTS' | 'INVALID_HEADER' | 'INVALID_PAYLOAD';

export interface JwtInfo {
  header: Record<string, unknown>;
  payload: Record<string, unknown>;
  /** base64url 原样的签名段 */
  signature: string;
  /** header 声明的算法（如 HS256/RS256），缺失时返回 null */
  alg: string | null;
}

/** JWT 中常见的时间类声明（epoch 秒） */
export const TIME_CLAIMS = ['exp', 'nbf', 'iat'] as const;
export type TimeClaim = (typeof TIME_CLAIMS)[number];

function base64UrlToUtf8(part: string): string {
  const b64 = part.replace(/-/g, '+').replace(/_/g, '/');
  const padded = b64 + '='.repeat((4 - (b64.length % 4)) % 4);
  const bin = atob(padded);
  const bytes = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i += 1) bytes[i] = bin.charCodeAt(i);
  return new TextDecoder().decode(bytes);
}

/** 单段解码：任何失败（非法 base64/非法 JSON/非对象）返回 null，绝不抛异常 */
function decodeJsonSegment(part: string): Record<string, unknown> | null {
  try {
    const parsed: unknown = JSON.parse(base64UrlToUtf8(part));
    if (typeof parsed !== 'object' || parsed === null || Array.isArray(parsed)) return null;
    return parsed as Record<string, unknown>;
  } catch {
    return null;
  }
}

/** 归一化：去首尾空白与可选 `Bearer ` 前缀 */
export function normalizeToken(input: string): string {
  const trimmed = input.trim();
  return trimmed.startsWith('Bearer ') ? trimmed.slice('Bearer '.length).trim() : trimmed;
}

/** 解析 JWT；错误时 error 为 JwtErrorCode（UI 层翻译为当前语言文案） */
export function parseJwt(input: string): ToolResult<JwtInfo> {
  const token = normalizeToken(input);
  if (!token) return { ok: false, error: 'EMPTY' };
  const parts = token.split('.');
  if (parts.length !== 3) return { ok: false, error: 'INVALID_PARTS' };
  const header = decodeJsonSegment(parts[0]);
  if (!header) return { ok: false, error: 'INVALID_HEADER' };
  const payload = decodeJsonSegment(parts[1]);
  if (!payload) return { ok: false, error: 'INVALID_PAYLOAD' };
  return {
    ok: true,
    value: {
      header,
      payload,
      signature: parts[2],
      alg: typeof header.alg === 'string' ? header.alg : null,
    },
  };
}

/** 读取 exp/nbf/iat 声明（epoch 秒）；不存在或非有限数值时返回 null */
export function readTimeClaim(payload: Record<string, unknown>, claim: TimeClaim): number | null {
  const value = payload[claim];
  return typeof value === 'number' && Number.isFinite(value) ? value : null;
}

/** 依据 exp 判断是否已过期；无 exp 声明时返回 null */
export function isExpired(payload: Record<string, unknown>, nowMs = Date.now()): boolean | null {
  const exp = readTimeClaim(payload, 'exp');
  if (exp === null) return null;
  return exp * 1000 <= nowMs;
}
