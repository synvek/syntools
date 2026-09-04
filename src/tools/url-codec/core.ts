import type { ToolResult } from '@/core/types';

/** component = encodeURIComponent（编码保留字符）；full = encodeURI（保留 URL 结构字符） */
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
