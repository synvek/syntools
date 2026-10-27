import type { ToolResult } from '@/core/types';

/**
 * URL state sharing (Tasks T28):
 * serialize tool input / options into the ?s= query param (JSON → base64url)
 * so the recipient restores the state by opening the link. Long input (> 2KB) degrades to no link.
 */

/** Shareable state fields: primitives only (no files or anything unserializable) */
export type ShareState = Record<string, string | number | boolean>;

export const SHARE_PARAM = 's';
/** Max serialized length (PRD: no sharing above 2KB of input) */
export const SHARE_LIMIT = 2048;

function utf8ToBase64Url(str: string): string {
  const bytes = new TextEncoder().encode(str);
  let bin = '';
  for (const b of bytes) bin += String.fromCharCode(b);
  return btoa(bin).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

function base64UrlToUtf8(param: string): string {
  const b64 = param.replace(/-/g, '+').replace(/_/g, '/');
  const bin = atob(b64);
  const bytes = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i += 1) bytes[i] = bin.charCodeAt(i);
  return new TextDecoder().decode(bytes);
}

/** State → base64url param value */
export function encodeShareState(state: ShareState): string {
  return utf8ToBase64Url(JSON.stringify(state));
}

/** base64url param value → state; returns null on any failure, never throws */
export function decodeShareState(param: string): ShareState | null {
  try {
    const parsed: unknown = JSON.parse(base64UrlToUtf8(param));
    if (typeof parsed !== 'object' || parsed === null || Array.isArray(parsed)) return null;
    const out: ShareState = {};
    for (const [key, value] of Object.entries(parsed)) {
      if (typeof value === 'string' || typeof value === 'number' || typeof value === 'boolean') {
        out[key] = value;
      }
    }
    return out;
  } catch {
    return null;
  }
}

/** Widen the defaults' literal types to string/number/boolean so restored values initialize state directly */
type Widened<T> = {
  [K in keyof T]: T[K] extends string ? string : T[K] extends number ? number : boolean;
};

/**
 * Read ?s= from the address bar and merge it over the defaults (T28 restore):
 * only keys present in the defaults with a matching typeof (URL content is untrusted,
 * so tools must still validate enums and ranges). Returns the defaults when absent or unparsable.
 */
export function readSharedState<T extends Record<string, string | number | boolean>>(
  defaults: T,
): Widened<T> {
  const param = new URLSearchParams(window.location.search).get(SHARE_PARAM);
  if (!param) return defaults as Widened<T>;
  const shared = decodeShareState(param);
  if (!shared) return defaults as Widened<T>;
  const out: Record<string, string | number | boolean> = { ...defaults };
  for (const key of Object.keys(defaults)) {
    const value = shared[key];
    if (value !== undefined && typeof value === typeof defaults[key]) {
      out[key] = value;
    }
  }
  return out as Widened<T>;
}

/** Build a full share link; over-length degrades to an error (interaction spec: notice, no link) */
export function buildShareUrl(pathname: string, state: ShareState): ToolResult<string> {
  const param = encodeShareState(state);
  if (param.length > SHARE_LIMIT) {
    // Error code without copy: the UI turns it into a localized message (T29)
    return { ok: false, error: 'TOO_LONG' };
  }
  return { ok: true, value: `${window.location.origin}${pathname}?${SHARE_PARAM}=${param}` };
}

/**
 * Build a share link from pre-encoded params plus a custom limit (added in phase 7).
 * `buildShareUrl` and its call sites stay as-is: the default encoding is still base64url and the default limit
 * is still `SHARE_LIMIT`; tools needing compaction (e.g. code-editor) call this instead.
 */
export function buildShareUrlWithLimit(
  pathname: string,
  param: string,
  limit: number,
): ToolResult<string> {
  if (param.length > limit) {
    return { ok: false, error: 'TOO_LONG' };
  }
  return { ok: true, value: `${window.location.origin}${pathname}?${SHARE_PARAM}=${param}` };
}
