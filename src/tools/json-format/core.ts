import type { ToolResult } from '@/core/types';

export type IndentSize = 2 | 4;

export type JsonErrorCode =
  | 'INVALID_LITERAL'
  | 'NEWLINE_IN_STRING'
  | 'UNEXPECTED_STRING_END'
  | 'INVALID_UNICODE_ESCAPE'
  | 'INVALID_ESCAPE'
  | 'INVALID_NUMBER'
  | 'DECIMAL_NO_DIGITS'
  | 'EXPONENT_NO_DIGITS'
  | 'UNEXPECTED_END'
  | 'INVALID_CHAR'
  | 'TRAILING_COMMA'
  | 'KEY_MUST_BE_STRING'
  | 'MISSING_COLON'
  | 'MISSING_VALUE'
  | 'UNCLOSED_OBJECT'
  | 'MISSING_COMMA_OBJECT'
  | 'UNCLOSED_ARRAY'
  | 'MISSING_COMMA_ARRAY'
  | 'EXTRA_CONTENT'
  | 'UNCLOSED_STRING';

export interface JsonIssue {
  code: JsonErrorCode;
  line: number;
  column: number;
  params?: Record<string, string | number>;
}

/** 字符位置 → 行/列（均从 1 开始） */
export function positionToLineColumn(
  input: string,
  position: number,
): { line: number; column: number } {
  let line = 1;
  let column = 1;
  for (let i = 0; i < position && i < input.length; i++) {
    if (input[i] === '\n') {
      line++;
      column = 1;
    } else {
      column++;
    }
  }
  return { line, column };
}

function makeIssue(
  input: string,
  code: JsonErrorCode,
  at: number,
  params?: Record<string, string | number>,
): JsonIssue {
  return { code, ...positionToLineColumn(input, at), params };
}

/**
 * 轻量递归下降 JSON 扫描器：仅在 JSON.parse 失败后用于定位首个错误位置。
 * 返回 null 表示语法合法。
 */
export function locateJsonError(input: string): JsonIssue | null {
  let pos = 0;

  const fail = (
    code: JsonErrorCode,
    at = pos,
    params?: Record<string, string | number>,
  ): JsonIssue => makeIssue(input, code, at, params);

  const skipWhitespace = () => {
    while (pos < input.length) {
      const ch = input[pos];
      if (ch === ' ' || ch === '\t' || ch === '\n' || ch === '\r') pos++;
      else break;
    }
  };

  const parseLiteral = (literal: string): JsonIssue | null => {
    if (input.startsWith(literal, pos)) {
      pos += literal.length;
      return null;
    }
    return fail('INVALID_LITERAL', pos, { literal });
  };

  const parseString = (): JsonIssue | null => {
    const start = pos;
    pos++;
    while (pos < input.length) {
      const ch = input[pos];
      if (ch === '"') {
        pos++;
        return null;
      }
      if (ch === '\n') return fail('NEWLINE_IN_STRING', start);
      if (ch === '\\') {
        const next = input[pos + 1];
        if (next === undefined) return fail('UNEXPECTED_STRING_END', start);
        if (next === 'u') {
          if (!/^[0-9a-fA-F]{4}$/.test(input.slice(pos + 2, pos + 6))) {
            return fail('INVALID_UNICODE_ESCAPE', pos);
          }
          pos += 6;
        } else if ('"\\/bfnrt'.includes(next)) {
          pos += 2;
        } else {
          return fail('INVALID_ESCAPE', pos, { char: next });
        }
      } else {
        pos++;
      }
    }
    return fail('UNCLOSED_STRING', start);
  };

  const parseNumber = (): JsonIssue | null => {
    const start = pos;
    if (input[pos] === '-') pos++;
    if (input[pos] === '0') {
      pos++;
    } else if (input[pos] >= '1' && input[pos] <= '9') {
      while (pos < input.length && input[pos] >= '0' && input[pos] <= '9') pos++;
    } else {
      return fail('INVALID_NUMBER', start);
    }
    if (input[pos] === '.') {
      pos++;
      if (!(input[pos] >= '0' && input[pos] <= '9')) return fail('DECIMAL_NO_DIGITS', pos - 1);
      while (pos < input.length && input[pos] >= '0' && input[pos] <= '9') pos++;
    }
    if (input[pos] === 'e' || input[pos] === 'E') {
      pos++;
      if (input[pos] === '+' || input[pos] === '-') pos++;
      if (!(input[pos] >= '0' && input[pos] <= '9')) return fail('EXPONENT_NO_DIGITS', pos - 1);
      while (pos < input.length && input[pos] >= '0' && input[pos] <= '9') pos++;
    }
    return null;
  };

  const parseValue = (): JsonIssue | null => {
    skipWhitespace();
    if (pos >= input.length) return fail('UNEXPECTED_END', pos);
    const ch = input[pos];
    if (ch === '{') return parseObject();
    if (ch === '[') return parseArray();
    if (ch === '"') return parseString();
    if (ch === 't') return parseLiteral('true');
    if (ch === 'f') return parseLiteral('false');
    if (ch === 'n') return parseLiteral('null');
    if (ch === '-' || (ch >= '0' && ch <= '9')) return parseNumber();
    if (ch === '}' || ch === ']') {
      return fail('MISSING_VALUE', pos);
    }
    return fail('INVALID_CHAR', pos, { char: ch });
  };

  const parseObject = (): JsonIssue | null => {
    const start = pos;
    pos++;
    skipWhitespace();
    if (input[pos] === '}') {
      pos++;
      return null;
    }
    for (;;) {
      skipWhitespace();
      if (input[pos] !== '"') {
        return fail(input[pos] === '}' ? 'TRAILING_COMMA' : 'KEY_MUST_BE_STRING', pos);
      }
      const keyIssue = parseString();
      if (keyIssue) return keyIssue;
      skipWhitespace();
      if (input[pos] !== ':') return fail('MISSING_COLON', pos);
      pos++;
      const valueExpect = pos;
      const valueIssue = parseValue();
      if (valueIssue) {
        return valueIssue.code === 'MISSING_VALUE'
          ? fail('MISSING_VALUE', valueExpect)
          : valueIssue;
      }
      skipWhitespace();
      if (input[pos] === ',') {
        pos++;
        continue;
      }
      if (input[pos] === '}') {
        pos++;
        return null;
      }
      return fail(pos >= input.length ? 'UNCLOSED_OBJECT' : 'MISSING_COMMA_OBJECT', start);
    }
  };

  const parseArray = (): JsonIssue | null => {
    const start = pos;
    pos++;
    skipWhitespace();
    if (input[pos] === ']') {
      pos++;
      return null;
    }
    for (;;) {
      const valueExpect = pos;
      const valueIssue = parseValue();
      if (valueIssue) {
        return valueIssue.code === 'MISSING_VALUE'
          ? fail('MISSING_VALUE', valueExpect)
          : valueIssue;
      }
      skipWhitespace();
      if (input[pos] === ',') {
        pos++;
        continue;
      }
      if (input[pos] === ']') {
        pos++;
        return null;
      }
      return fail(pos >= input.length ? 'UNCLOSED_ARRAY' : 'MISSING_COMMA_ARRAY', start);
    }
  };

  const result = parseValue();
  if (result) return result;
  skipWhitespace();
  if (pos < input.length) return fail('EXTRA_CONTENT', pos);
  return null;
}

function issueToResult(issue: JsonIssue): ToolResult<string> {
  return {
    ok: false,
    error: issue.code,
    params: { line: issue.line, column: issue.column, ...issue.params },
  };
}

export function formatJson(input: string, indent: IndentSize): ToolResult<string> {
  if (!input.trim()) return { ok: false, error: 'EMPTY' };
  try {
    return { ok: true, value: JSON.stringify(JSON.parse(input), null, indent) };
  } catch {
    const found = locateJsonError(input);
    return found ? issueToResult(found) : { ok: false, error: 'UNKNOWN' };
  }
}

export function compressJson(input: string): ToolResult<string> {
  if (!input.trim()) return { ok: false, error: 'EMPTY' };
  try {
    return { ok: true, value: JSON.stringify(JSON.parse(input)) };
  } catch {
    const found = locateJsonError(input);
    return found ? issueToResult(found) : { ok: false, error: 'UNKNOWN' };
  }
}

export function validateJson(input: string): ToolResult<string> {
  if (!input.trim()) return { ok: false, error: 'EMPTY' };
  try {
    JSON.parse(input);
    return { ok: true, value: 'VALID' };
  } catch {
    const found = locateJsonError(input);
    return found ? issueToResult(found) : { ok: false, error: 'UNKNOWN' };
  }
}
