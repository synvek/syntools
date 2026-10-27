import type { ToolResult } from '@/core/types';

/** component = encodeURIComponent (encodes reserved characters); full = encodeURI (keeps URL structure characters) */
export type UrlMode = 'component' | 'full';

export function urlEncode(input: string, mode: UrlMode): ToolResult<string> {
  try {
    return {
      ok: true,
      value: mode === 'component' ? encodeURIComponent(input) : encodeURI(input),
    };
  } catch {
    return { ok: false, error: 'ENCODE_FAILED' };
  }
}

export function urlDecode(input: string, mode: UrlMode): ToolResult<string> {
  try {
    return {
      ok: true,
      value: mode === 'component' ? decodeURIComponent(input) : decodeURI(input),
    };
  } catch {
    return { ok: false, error: 'DECODE_FAILED' };
  }
}
