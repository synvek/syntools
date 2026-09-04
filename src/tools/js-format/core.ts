import beautify from 'js-beautify';
import type { ToolResult } from '@/core/types';

/**
 * JS 压缩 / 格式化：格式化走 js-beautify，压缩为轻量本地实现（避免引入体积超标的 terser）。
 * 错误码与文案解耦：core 返回语言无关错误码，UI 层经 i18n 翻译。
 */

export type JsErrorCode = 'EMPTY' | 'INVALID';
export type IndentSize = 2 | 4;
export type JsAction = 'format' | 'compress';

/**
 * 轻量压缩：去掉注释与多余空白，保留字符串 / 模板字符串 / 正则字面量。
 * 不做变量混淆（体积预算内无法引入完整 JS 压缩器）。
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

    // 行注释
    if (ch === '/' && next === '/') {
      i += 2;
      while (i < n && input[i] !== '\n') i++;
      continue;
    }
    // 块注释
    if (ch === '/' && next === '*') {
      i += 2;
      while (i < n && !(input[i] === '*' && peek(1) === '/')) i++;
      i += 2;
      continue;
    }
    // 字符串
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
          // 模板插值：简单跳到匹配的 }（嵌套大括号计数）
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
    // 正则字面量（启发式：前一个非空白不是标识符 / 数字 / ) ] }）
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
      // 仅在两个标识符相邻时保留一个空格
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
