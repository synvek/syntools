import type { ToolResult } from '@/core/types';

/**
 * HTML 实体 / Unicode 编解码（Tasks T36）：
 * 编码支持命名实体 / 十进制 / 十六进制 / \u 转义；
 * 解码兼容上述全部形式，未识别的实体原样保留并列出（不抛异常）。
 */

export type Direction = 'encode' | 'decode';
export type EncodeMode = 'named' | 'decimal' | 'hex' | 'unicode';
/** special = 仅 &<>"'；nonascii = 另含全部非 ASCII 字符 */
export type EncodeScope = 'special' | 'nonascii';

/** 常用命名实体表（完整 HTML5 实体表约 2000 项，此处覆盖高频子集；其余走数字实体） */
const NAMED_ENTITIES: Record<string, string> = {
  amp: '&',
  lt: '<',
  gt: '>',
  quot: '"',
  apos: "'",
  nbsp: '\u00A0',
  copy: '\u00A9',
  reg: '\u00AE',
  trade: '\u2122',
  deg: '\u00B0',
  plusmn: '\u00B1',
  middot: '\u00B7',
  laquo: '\u00AB',
  raquo: '\u00BB',
  sect: '\u00A7',
  para: '\u00B6',
  times: '\u00D7',
  divide: '\u00F7',
  yen: '\u00A5',
  cent: '\u00A2',
  pound: '\u00A3',
  euro: '\u20AC',
  hellip: '\u2026',
  mdash: '\u2014',
  ndash: '\u2013',
  lsquo: '\u2018',
  rsquo: '\u2019',
  ldquo: '\u201C',
  rdquo: '\u201D',
  bull: '\u2022',
  dagger: '\u2020',
  Dagger: '\u2021',
  larr: '\u2190',
  rarr: '\u2192',
  uarr: '\u2191',
  darr: '\u2193',
  harr: '\u2194',
};

/** 字符 → 实体名（命名编码用） */
const CHAR_TO_NAME = new Map(Object.entries(NAMED_ENTITIES).map(([name, char]) => [char, name]));

const SPECIAL = new Set(['&', '<', '>', '"', "'"]);

function inScope(char: string, code: number, scope: EncodeScope): boolean {
  return SPECIAL.has(char) || (scope === 'nonascii' && (code < 0x20 || code > 0x7e));
}

/** 编码：按模式与范围转换 */
export function encodeEntities(
  text: string,
  mode: EncodeMode,
  scope: EncodeScope = 'special',
): ToolResult<string> {
  let out = '';
  for (const char of text) {
    const code = char.codePointAt(0)!;
    if (!inScope(char, code, scope)) {
      out += char;
      continue;
    }
    switch (mode) {
      case 'named': {
        const name = CHAR_TO_NAME.get(char);
        // 无命名实体的字符回退为十进制数字实体
        out += name ? `&${name};` : `&#${code};`;
        break;
      }
      case 'decimal':
        out += `&#${code};`;
        break;
      case 'hex':
        out += `&#x${code.toString(16).toUpperCase()};`;
        break;
      case 'unicode': {
        // 增补平面字符按 UTF-16 码元输出 \uHHHH 对（与 Java/JSON 习惯一致）
        for (let i = 0; i < char.length; i += 1) {
          out += `\\u${char.charCodeAt(i).toString(16).padStart(4, '0').toUpperCase()}`;
        }
        break;
      }
    }
  }
  return { ok: true, value: out };
}

export interface DecodeResult {
  output: string;
  /** 未识别的命名实体（原样保留在输出中） */
  unknown: string[];
}

/** 解码：数字实体（十进制/十六进制）+ 命名实体 + \uXXXX；未识别的原样保留 */
export function decodeEntities(text: string): ToolResult<DecodeResult> {
  const unknown: string[] = [];

  let out = text.replace(
    /&#([xX])([0-9a-fA-F]+);|&#(\d+);/g,
    (match, hexFlag, hexDigits, decDigits) => {
      const code = hexFlag ? Number.parseInt(hexDigits, 16) : Number.parseInt(decDigits, 10);
      if (!Number.isFinite(code) || code > 0x10ffff) return match;
      try {
        return String.fromCodePoint(code);
      } catch {
        return match;
      }
    },
  );

  out = out.replace(/&([a-zA-Z][a-zA-Z0-9]*);/g, (match, name: string) => {
    const char = NAMED_ENTITIES[name];
    if (char !== undefined) return char;
    if (!unknown.includes(match)) unknown.push(match);
    return match;
  });

  // \uXXXX（含代理对自动拼接由 String.fromCharCode 逐段还原）
  out = out.replace(/\\u([0-9a-fA-F]{4})/g, (_match, hex: string) =>
    String.fromCharCode(Number.parseInt(hex, 16)),
  );

  return { ok: true, value: { output: out, unknown } };
}
