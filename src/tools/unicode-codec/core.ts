import type { ToolResult } from '@/core/types';

/**
 * Unicode 编码转换：文本 ⇄ JS 转义 / 码点 / HTML 实体 / UTF-8 字节。
 */

export type UnicodeFormat = 'js' | 'jsBrace' | 'codePoint' | 'htmlHex' | 'htmlDec' | 'utf8';
export type UnicodeDirection = 'encode' | 'decode';
export type UnicodeError = 'EMPTY' | 'INVALID';

export const UNICODE_FORMATS: UnicodeFormat[] = [
  'js',
  'jsBrace',
  'codePoint',
  'htmlHex',
  'htmlDec',
  'utf8',
];

function encodeCodePoint(cp: number, format: UnicodeFormat): string {
  const hex = cp.toString(16);
  const hexUpper = hex.toUpperCase();
  const hexPad = hexUpper.padStart(cp > 0xffff ? 5 : 4, '0');
  switch (format) {
    case 'js':
      if (cp <= 0xffff) return `\\u${hex.padStart(4, '0')}`;
      {
        const v = cp - 0x10000;
        const hi = 0xd800 + (v >> 10);
        const lo = 0xdc00 + (v & 0x3ff);
        return `\\u${hi.toString(16).padStart(4, '0')}\\u${lo.toString(16).padStart(4, '0')}`;
      }
    case 'jsBrace':
      return `\\u{${hex}}`;
    case 'codePoint':
      return `U+${hexPad}`;
    case 'htmlHex':
      return `&#x${hexUpper};`;
    case 'htmlDec':
      return `&#${cp};`;
    case 'utf8': {
      const bytes = Array.from(new TextEncoder().encode(String.fromCodePoint(cp)));
      return bytes.map((b) => b.toString(16).padStart(2, '0').toUpperCase()).join(' ');
    }
    default:
      return hex;
  }
}

export function encodeUnicode(input: string, format: UnicodeFormat): string {
  const parts: string[] = [];
  for (const ch of input) {
    parts.push(encodeCodePoint(ch.codePointAt(0)!, format));
  }
  if (format === 'utf8') return parts.join(' ');
  if (format === 'codePoint') return parts.join(' ');
  if (format === 'js' || format === 'jsBrace') return parts.join('');
  return parts.join('');
}

/** 解码常见 Unicode 表示：\uXXXX、\u{…}、U+XXXX、&#x…;、&#…;、UTF-8 十六进制字节 */
export function decodeUnicode(input: string): ToolResult<string> {
  const trimmed = input.trim();
  if (!trimmed) return { ok: false, error: 'EMPTY' };

  // UTF-8 十六进制字节串：如 "E4 B8 AD" 或 "e4b8ad"
  if (/^(?:[0-9a-fA-F]{2}(?:\s+[0-9a-fA-F]{2})+|[0-9a-fA-F]{4,})$/.test(trimmed) && !/[\\&U+]/.test(trimmed)) {
    const hex = trimmed.replace(/\s+/g, '');
    if (hex.length % 2 !== 0) return { ok: false, error: 'INVALID' };
    try {
      const bytes = new Uint8Array(hex.length / 2);
      for (let i = 0; i < bytes.length; i++) {
        bytes[i] = parseInt(hex.slice(i * 2, i * 2 + 2), 16);
      }
      return { ok: true, value: new TextDecoder('utf-8', { fatal: true }).decode(bytes) };
    } catch {
      return { ok: false, error: 'INVALID' };
    }
  }

  try {
    let i = 0;
    let out = '';
    const s = trimmed;
    while (i < s.length) {
      // \u{XXXXX}
      let m = /^\\u\{([0-9a-fA-F]{1,6})\}/.exec(s.slice(i));
      if (m) {
        out += String.fromCodePoint(parseInt(m[1], 16));
        i += m[0].length;
        continue;
      }
      // \uXXXX
      m = /^\\u([0-9a-fA-F]{4})/.exec(s.slice(i));
      if (m) {
        out += String.fromCharCode(parseInt(m[1], 16));
        i += m[0].length;
        continue;
      }
      // U+XXXX / u+XXXX
      m = /^U\+([0-9a-fA-F]{4,6})\b/i.exec(s.slice(i));
      if (m) {
        out += String.fromCodePoint(parseInt(m[1], 16));
        i += m[0].length;
        continue;
      }
      // &#xHHHH; or &#NNNN;
      m = /^&#x([0-9a-fA-F]{1,6});/i.exec(s.slice(i));
      if (m) {
        out += String.fromCodePoint(parseInt(m[1], 16));
        i += m[0].length;
        continue;
      }
      m = /^&#([0-9]{1,7});/.exec(s.slice(i));
      if (m) {
        out += String.fromCodePoint(Number(m[1]));
        i += m[0].length;
        continue;
      }
      // 跳过空白分隔
      if (/\s/.test(s[i])) {
        i += 1;
        continue;
      }
      // 普通字符原样保留（便于混排）
      out += s[i];
      i += 1;
    }
    if (!out) return { ok: false, error: 'INVALID' };
    return { ok: true, value: out };
  } catch {
    return { ok: false, error: 'INVALID' };
  }
}

export function processUnicode(
  input: string,
  direction: UnicodeDirection,
  format: UnicodeFormat,
): ToolResult<string> {
  if (!input) return { ok: false, error: 'EMPTY' };
  if (direction === 'encode') return { ok: true, value: encodeUnicode(input, format) };
  return decodeUnicode(input);
}
