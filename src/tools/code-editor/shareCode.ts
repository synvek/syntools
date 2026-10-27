import { deflate, inflate } from 'pako';
import { SHARE_PARAM, decodeShareState, type ShareState } from '@/core/lib/share';

/**
 * Compressed share-state codec (phase 7).
 *
 * Current constraint: `?s=` is "JSON → base64url" with `SHARE_LIMIT = 2048`, so anything but a
 * short snippet cannot be shared. This adds a "JSON → deflate → base64url" encoding inside the
 * tool, marking the parameter with a `z` prefix; reads pick the decode path by that prefix, so
 * legacy uncompressed links and every other tool on the site are unaffected. The compressed
 * limit is relaxed to 8192 (still safe for URL lengths in mainstream browsers and CDNs).
 * pako is an existing dependency, lazily loaded with the tool chunk (≈ 12.5KB gzipped for
 * deflate + inflate).
 */

/** Length limit for a compressed share parameter (bytes) */
export const SHARE_COMPRESSED_LIMIT = 8192;

/** Compressed-parameter prefix: an uncompressed value is pure base64url and cannot start with z followed by valid JSON */
const MARKER = 'z';

function bytesToBase64Url(bytes: Uint8Array): string {
  let binary = '';
  for (const byte of bytes) binary += String.fromCharCode(byte);
  return btoa(binary).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

function base64UrlToBytes(param: string): Uint8Array {
  const base64 = param.replace(/-/g, '+').replace(/_/g, '/');
  const binary = atob(base64);
  const bytes = new Uint8Array(binary.length);
  for (let index = 0; index < binary.length; index += 1) bytes[index] = binary.charCodeAt(index);
  return bytes;
}

function isShareState(value: unknown): value is ShareState {
  if (typeof value !== 'object' || value === null || Array.isArray(value)) return false;
  return Object.values(value as Record<string, unknown>).every(
    (item) => typeof item === 'string' || typeof item === 'number' || typeof item === 'boolean',
  );
}

/** State → compressed parameter value */
export function encodeCompressedShare(state: ShareState): string {
  return MARKER + bytesToBase64Url(deflate(JSON.stringify(state)));
}

/** Compressed parameter value → state; any parse failure returns null and never throws */
export function decodeCompressedShare(param: string): ShareState | null {
  if (!param.startsWith(MARKER) || param.length <= MARKER.length) return null;
  try {
    const json = inflate(base64UrlToBytes(param.slice(MARKER.length)), { toText: true });
    const parsed: unknown = JSON.parse(json);
    return isShareState(parsed) ? parsed : null;
  } catch {
    return null;
  }
}

/**
 * Read `?s=` from the address bar (handling both compressed and uncompressed encodings) and merge
 * it over the defaults. Semantics match `readSharedState`: only keys present in the defaults are
 * accepted, and only when their typeof matches the default value.
 */
export function readSharedCodeState<T extends Record<string, string | number | boolean>>(
  defaults: T,
): Record<string, string | number | boolean> {
  const param = new URLSearchParams(window.location.search).get(SHARE_PARAM);
  if (!param) return { ...defaults };
  const shared = param.startsWith(MARKER) ? decodeCompressedShare(param) : decodeShareState(param);
  const out: Record<string, string | number | boolean> = { ...defaults };
  if (!shared) return out;
  for (const key of Object.keys(defaults)) {
    const value = shared[key];
    if (value !== undefined && typeof value === typeof defaults[key]) out[key] = value;
  }
  return out;
}

export { SHARE_PARAM };
