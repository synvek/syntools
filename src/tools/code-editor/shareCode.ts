import { deflate, inflate } from 'pako';
import { SHARE_PARAM, decodeShareState, type ShareState } from '@/core/lib/share';

/**
 * 分享状态压缩编解码（阶段 7）。
 *
 * 现状约束：`?s=` 为「JSON → base64url」，`SHARE_LIMIT = 2048`，代码稍长即不可分享。
 * 这里在工具内新增「JSON → deflate → base64url」的压缩编码，参数以 `z` 前缀标记，
 * 读取时按前缀选择解码路径 —— 未压缩的历史链接与站内其他工具语义完全不受影响。
 * 压缩后的上限放宽到 8192（主流浏览器与 CDN 对 URL 长度仍然安全）。
 * pako 是既有依赖，随工具 chunk 懒加载（实测 deflate+inflate ≈ 12.5KB gzip）。
 */

/** 压缩分享参数的长度上限（字节） */
export const SHARE_COMPRESSED_LIMIT = 8192;

/** 压缩参数前缀：未压缩参数是纯 base64url，不会以 z 开头后紧跟合法 JSON */
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

/** 状态 → 压缩参数值 */
export function encodeCompressedShare(state: ShareState): string {
  return MARKER + bytesToBase64Url(deflate(JSON.stringify(state)));
}

/** 压缩参数值 → 状态；任何解析失败返回 null，绝不抛异常 */
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
 * 读取地址栏 `?s=`（兼容压缩与未压缩两种编码）并与默认状态合并。
 * 语义与 `readSharedState` 一致：仅接受默认值中存在的键，且 typeof 与默认值一致。
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
