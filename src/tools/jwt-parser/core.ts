import type { ToolResult } from '@/core/types';

/**
 * JWT parsing (Tasks T33): split header.payload.signature, base64url-decode, then parse the JSON.
 * Read-only parsing with no signature verification (verification needs a key and is out of scope).
 * Error codes are decoupled from copy: core returns language-neutral codes that the UI translates via i18n (T29 convention).
 */

export type JwtErrorCode = 'EMPTY' | 'INVALID_PARTS' | 'INVALID_HEADER' | 'INVALID_PAYLOAD';

export interface JwtInfo {
  header: Record<string, unknown>;
  payload: Record<string, unknown>;
  /** Signature segment, kept in raw base64url form */
  signature: string;
  /** Algorithm declared in the header (e.g. HS256/RS256); null when absent */
  alg: string | null;
}

/** Common time-based JWT claims (epoch seconds) */
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

/** Decode one segment: any failure (bad base64, bad JSON, non-object) returns null and never throws */
function decodeJsonSegment(part: string): Record<string, unknown> | null {
  try {
    const parsed: unknown = JSON.parse(base64UrlToUtf8(part));
    if (typeof parsed !== 'object' || parsed === null || Array.isArray(parsed)) return null;
    return parsed as Record<string, unknown>;
  } catch {
    return null;
  }
}

/** Normalize: trim whitespace and drop an optional `Bearer ` prefix */
export function normalizeToken(input: string): string {
  const trimmed = input.trim();
  return trimmed.startsWith('Bearer ') ? trimmed.slice('Bearer '.length).trim() : trimmed;
}

/** Parse a JWT; on failure, error is a JwtErrorCode (translated to the current language by the UI) */
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

/** Read the exp/nbf/iat claims (epoch seconds); null when missing or not a finite number */
export function readTimeClaim(payload: Record<string, unknown>, claim: TimeClaim): number | null {
  const value = payload[claim];
  return typeof value === 'number' && Number.isFinite(value) ? value : null;
}

/** Decide whether the token has expired from exp; null when there is no exp claim */
export function isExpired(payload: Record<string, unknown>, nowMs = Date.now()): boolean | null {
  const exp = readTimeClaim(payload, 'exp');
  if (exp === null) return null;
  return exp * 1000 <= nowMs;
}

export type JwtSignErrorCode = 'EMPTY' | 'INVALID_PAYLOAD' | 'SIGN_FAILED';

function utf8ToBase64Url(text: string): string {
  const bytes = new TextEncoder().encode(text);
  let bin = '';
  for (const b of bytes) bin += String.fromCharCode(b);
  return btoa(bin).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

function bytesToBase64Url(bytes: Uint8Array): string {
  let bin = '';
  for (const b of bytes) bin += String.fromCharCode(b);
  return btoa(bin).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

/** Encode JWT segments without signing (signature empty) */
export function encodeJwtUnsigned(
  payloadJson: string,
  headerExtras?: Record<string, unknown>,
): ToolResult<string> {
  const trimmed = payloadJson.trim();
  if (!trimmed) return { ok: false, error: 'EMPTY' };
  let payload: unknown;
  try {
    payload = JSON.parse(trimmed);
  } catch {
    return { ok: false, error: 'INVALID_PAYLOAD' };
  }
  if (typeof payload !== 'object' || payload === null || Array.isArray(payload)) {
    return { ok: false, error: 'INVALID_PAYLOAD' };
  }
  const header = { alg: 'none', typ: 'JWT', ...headerExtras };
  const h = utf8ToBase64Url(JSON.stringify(header));
  const p = utf8ToBase64Url(JSON.stringify(payload));
  return { ok: true, value: `${h}.${p}.` };
}

/** Sign JWT with HS256 (WebCrypto HMAC-SHA256) */
export async function signJwtHs256(
  payloadJson: string,
  secret: string,
  headerExtras?: Record<string, unknown>,
): Promise<ToolResult<string>> {
  const trimmed = payloadJson.trim();
  if (!trimmed) return { ok: false, error: 'EMPTY' };
  if (!secret) return { ok: false, error: 'EMPTY' };

  let payload: unknown;
  try {
    payload = JSON.parse(trimmed);
  } catch {
    return { ok: false, error: 'INVALID_PAYLOAD' };
  }
  if (typeof payload !== 'object' || payload === null || Array.isArray(payload)) {
    return { ok: false, error: 'INVALID_PAYLOAD' };
  }

  const header = { alg: 'HS256', typ: 'JWT', ...headerExtras };
  const h = utf8ToBase64Url(JSON.stringify(header));
  const p = utf8ToBase64Url(JSON.stringify(payload));
  const data = new TextEncoder().encode(`${h}.${p}`);

  try {
    const key = await crypto.subtle.importKey(
      'raw',
      new TextEncoder().encode(secret),
      { name: 'HMAC', hash: 'SHA-256' },
      false,
      ['sign'],
    );
    const sig = new Uint8Array(await crypto.subtle.sign('HMAC', key, data));
    return { ok: true, value: `${h}.${p}.${bytesToBase64Url(sig)}` };
  } catch {
    return { ok: false, error: 'SIGN_FAILED' };
  }
}
