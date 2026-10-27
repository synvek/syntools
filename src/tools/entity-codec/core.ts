import type { ToolResult } from '@/core/types';

/**
 * HTML entity / Unicode codec (Tasks T36):
 * Encoding supports named entities, decimal, hexadecimal, and \u escapes;
 * Decoding accepts all of the above; unrecognized entities are kept verbatim and reported (nothing throws).
 */

export type Direction = 'encode' | 'decode';
export type EncodeMode = 'named' | 'decimal' | 'hex' | 'unicode';
/** special = only &<>"'; nonascii = additionally covers every non-ASCII character */
export type EncodeScope = 'special' | 'nonascii';

/** Common named-entity table (the full HTML5 set has ~2000 entries; this covers the high-frequency subset, the rest go through numeric entities) */
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

/** Character → entity name (for named encoding) */
const CHAR_TO_NAME = new Map(Object.entries(NAMED_ENTITIES).map(([name, char]) => [char, name]));

const SPECIAL = new Set(['&', '<', '>', '"', "'"]);

function inScope(char: string, code: number, scope: EncodeScope): boolean {
  return SPECIAL.has(char) || (scope === 'nonascii' && (code < 0x20 || code > 0x7e));
}

/** Encode: convert according to mode and range */
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
        // Characters without a named entity fall back to decimal numeric entities
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
        // Supplementary-plane characters emit a \uHHHH surrogate pair (the Java/JSON convention)
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
  /** Unrecognized named entities (kept verbatim in the output) */
  unknown: string[];
}

/** Decode: numeric entities (decimal/hex), named entities, and \uXXXX; unrecognized ones are kept verbatim */
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

  // \uXXXX (surrogate pairs are reassembled piecewise by String.fromCharCode)
  out = out.replace(/\\u([0-9a-fA-F]{4})/g, (_match, hex: string) =>
    String.fromCharCode(Number.parseInt(hex, 16)),
  );

  return { ok: true, value: { output: out, unknown } };
}
