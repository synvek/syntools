import type { ToolResult } from '@/core/types';

/**
 * URL 状态分享（Tasks T28）：
 * 将工具输入/参数序列化为 query 参数 ?s=（JSON → base64url），
 * 接收方打开链接即还原状态。长输入（> 2KB）降级：不生成分享链接。
 */

/** 可分享的状态字段：仅原始类型（文件等不可序列化内容不得入内） */
export type ShareState = Record<string, string | number | boolean>;

export const SHARE_PARAM = 's';
/** 序列化结果长度上限（PRD：输入 > 2KB 不分享） */
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

/** 状态 → base64url 参数值 */
export function encodeShareState(state: ShareState): string {
  return utf8ToBase64Url(JSON.stringify(state));
}

/** base64url 参数值 → 状态；任何解析失败返回 null，绝不抛异常 */
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

/** 将默认值的字面量类型加宽为 string/number/boolean，便于还原后直接参与状态初始化 */
type Widened<T> = {
  [K in keyof T]: T[K] extends string ? string : T[K] extends number ? number : boolean;
};

/**
 * 读取地址栏 ?s= 并与默认状态合并（T28 还原）：
 * 仅接受默认值中存在的键，且 typeof 与默认值一致（URL 内容不可信，
 * 工具侧对枚举/数值范围仍需自行校验）。无参数或解析失败时返回默认值。
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

/** 生成完整分享链接；超长降级返回错误（交互规范：提示不分享） */
export function buildShareUrl(pathname: string, state: ShareState): ToolResult<string> {
  const param = encodeShareState(state);
  if (param.length > SHARE_LIMIT) {
    // 错误代码（不携带文案）：UI 层经 i18n 转为当前语言提示（T29）
    return { ok: false, error: 'TOO_LONG' };
  }
  return { ok: true, value: `${window.location.origin}${pathname}?${SHARE_PARAM}=${param}` };
}
