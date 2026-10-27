import beautify from 'js-beautify';
import type { ToolResult } from '@/core/types';

/**
 * JS minify / format: formatting uses js-beautify, minification is a lightweight local implementation (avoiding an oversized terser dependency).
 * Error codes are decoupled from copy: core returns language-neutral codes that the UI translates via i18n.
 */

export type JsErrorCode = 'EMPTY' | 'INVALID';
export type IndentSize = 2 | 4;
export type JsAction = 'format' | 'compress';

/**
 * Lightweight minification: strip comments and redundant whitespace while preserving strings, template literals, and regex literals.
 * No identifier mangling (the bundle budget leaves no room for a full JS minifier).
 */
export function minifyJs(input: string): string {
  let out = '';
  let i = 0;
  const n = input.length;
  let lastWasSpace = false;

  const peek = (offset = 0) => input[i + offset];
  const isIdent = (ch: string | undefined) => !!ch && /[A-Za-z0-9_$]/.test(ch);

  while (i < n) {
    const ch = input[i];
    const next = peek(1);

    // Line comment
    if (ch === '/' && next === '/') {
      i += 2;
      while (i < n && input[i] !== '\n') i++;
      continue;
    }
    // Block comment
    if (ch === '/' && next === '*') {
      i += 2;
      while (i < n && !(input[i] === '*' && peek(1) === '/')) i++;
      i += 2;
      continue;
    }
    // String
    if (ch === '"' || ch === "'" || ch === '`') {
      const quote = ch;
      out += ch;
      i++;
      while (i < n) {
        const c = input[i];
        out += c;
        if (c === '\\') {
          i++;
          if (i < n) out += input[i];
          i++;
          continue;
        }
        if (quote === '`' && c === '$' && peek(1) === '{') {
          // Template interpolation: jump to the matching } by counting nested braces
          out += '{';
          i += 2;
          let depth = 1;
          while (i < n && depth > 0) {
            const t = input[i];
            out += t;
            if (t === '{') depth++;
            else if (t === '}') depth--;
            else if (t === '\\') {
              i++;
              if (i < n) out += input[i];
            } else if (t === '"' || t === "'" || t === '`') {
              const q = t;
              i++;
              while (i < n) {
                const s = input[i];
                out += s;
                if (s === '\\') {
                  i++;
                  if (i < n) out += input[i];
                } else if (s === q) break;
                i++;
              }
            }
            i++;
          }
          continue;
        }
        if (c === quote) {
          i++;
          break;
        }
        i++;
      }
      lastWasSpace = false;
      continue;
    }
    // Regex literal (heuristic: the previous non-space character is not an identifier char, digit, or ) ] })
    if (ch === '/') {
      const prev = out.trimEnd().slice(-1);
      if (!prev || !/[A-Za-z0-9_$)\]}]/.test(prev)) {
        out += '/';
        i++;
        while (i < n) {
          const c = input[i];
          out += c;
          if (c === '\\') {
            i++;
            if (i < n) out += input[i];
            i++;
            continue;
          }
          if (c === '/') {
            i++;
            while (i < n && /[a-z]/i.test(input[i])) {
              out += input[i];
              i++;
            }
            break;
          }
          if (c === '\n') break;
          i++;
        }
        lastWasSpace = false;
        continue;
      }
    }

    if (/\s/.test(ch)) {
      // Keep a single space only where two identifier characters would otherwise touch
      if (!lastWasSpace) {
        const left = out.slice(-1);
        let j = i + 1;
        while (j < n && /\s/.test(input[j])) j++;
        const right = input[j];
        if (isIdent(left) && isIdent(right)) {
          out += ' ';
          lastWasSpace = true;
        }
      }
      i++;
      continue;
    }

    out += ch;
    lastWasSpace = false;
    i++;
  }
  return out.trim();
}

export function processJs(
  input: string,
  action: JsAction,
  indent: IndentSize = 2,
): ToolResult<string> {
  if (!input.trim()) return { ok: false, error: 'EMPTY' };
  try {
    if (action === 'format') {
      return {
        ok: true,
        value: beautify.js(input, {
          indent_size: indent,
          end_with_newline: false,
        }),
      };
    }
    return { ok: true, value: minifyJs(input) };
  } catch {
    return { ok: false, error: 'INVALID' };
  }
}
