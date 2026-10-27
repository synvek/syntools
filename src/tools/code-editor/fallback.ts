import type { ToolResult } from '@/core/types';

/**
 * Built-in lightweight formatter (fallback).
 *
 * Background: the prettier v3 ecosystem has no maintained plugins for Rust / Go / C / C++ / C# /
 * Python / Kotlin / Swift (the only Rust plugin, `prettier-plugin-rust`, is stuck on prettier@2
 * and unmaintained), so these languages use the local implementation in this file:
 *   - `brackets` mode: re-indent by bracket depth (C / Rust / Go / Java / Kotlin / Swift …)
 *   - `indent` mode: re-indent using the original indent levels as a skeleton (Python / Ruby /
 *     Shell — where indentation is semantic)
 * Both modes skip strings and comments so content like `}` is never mistaken for structure.
 */

export type FallbackMode = 'brackets' | 'indent';

export interface FallbackOptions {
  /** Indent unit, e.g. '  ' / '    ' / '\t' */
  indentUnit: string;
  mode?: FallbackMode;
  /** Treat `#` as a line comment (Shell / Ruby / Python) */
  hashComment?: boolean;
  /** Treat `--` as a line comment (Lua / SQL / Haskell) */
  dashComment?: boolean;
}

interface ScanState {
  blockComment: boolean;
  /** Closing delimiter of a triple-quoted string, e.g. '"""' / "'''" */
  triple: string | null;
}

/** Inline fragment: `code` spans may be reformatted, everything else is kept verbatim */
interface Span {
  text: string;
  code: boolean;
}

interface LineScan {
  spans: Span[];
  /** Whether the code part of the line ends with `:` (start of a Python block) */
  endsWithColon: boolean;
  /** Net change in bracket depth over the line */
  delta: number;
  /** Number of leading closing brackets (used to dedent this line up front) */
  leadingClosers: number;
  hasCode: boolean;
}

const CLOSERS = ')]}';
const OPENERS = '([{';

function isCloser(ch: string): boolean {
  return CLOSERS.includes(ch);
}

/** Scan one line: find string / comment spans and count brackets, writing multi-line state back */
function scanLine(line: string, state: ScanState, opts: FallbackOptions): LineScan {
  const spans: Span[] = [];
  let plain = '';
  let delta = 0;
  let leadingClosers = 0;
  let hasCode = false;
  let codeEnd = 0;
  let leading = true;

  const flushPlain = () => {
    if (plain) {
      spans.push({ text: plain, code: true });
      plain = '';
    }
  };

  let i = 0;
  const n = line.length;

  while (i < n) {
    // Triple-quoted string (Python docstrings)
    if (state.triple) {
      const end = line.indexOf(state.triple, i);
      if (end < 0) {
        spans.push({ text: line.slice(i), code: false });
        i = n;
      } else {
        spans.push({ text: line.slice(i, end + 3), code: false });
        i = end + 3;
        state.triple = null;
      }
      continue;
    }
    // Block comment
    if (state.blockComment) {
      const end = line.indexOf('*/', i);
      if (end < 0) {
        spans.push({ text: line.slice(i), code: false });
        i = n;
      } else {
        spans.push({ text: line.slice(i, end + 2), code: false });
        i = end + 2;
        state.blockComment = false;
      }
      continue;
    }

    const ch = line[i];
    const next = line[i + 1];

    if (ch === '/' && next === '*') {
      flushPlain();
      spans.push({ text: '/*', code: false });
      state.blockComment = true;
      i += 2;
      continue;
    }
    if (ch === '/' && next === '/') {
      flushPlain();
      spans.push({ text: line.slice(i), code: false });
      i = n;
      continue;
    }
    if (ch === '#' && opts.hashComment) {
      flushPlain();
      spans.push({ text: line.slice(i), code: false });
      i = n;
      continue;
    }
    if (ch === '-' && next === '-' && opts.dashComment) {
      flushPlain();
      spans.push({ text: line.slice(i), code: false });
      i = n;
      continue;
    }
    if (ch === '"' || ch === "'" || ch === '`') {
      flushPlain();
      const marker = ch.repeat(3);
      if (line.startsWith(marker, i)) {
        state.triple = marker;
        spans.push({ text: marker, code: false });
        i += 3;
        continue;
      }
      // Look for the closing quote on the same line; if absent, treat it as a char literal / lifetime (Rust `'a`)
      let j = i + 1;
      let closed = false;
      while (j < n) {
        if (line[j] === '\\') {
          j += 2;
          continue;
        }
        if (line[j] === ch) {
          closed = true;
          break;
        }
        if (ch === "'" && (line[j] === '\n' || line[j] === ';')) break;
        j += 1;
      }
      if (closed) {
        spans.push({ text: line.slice(i, j + 1), code: false });
        i = j + 1;
      } else {
        // Char literal or lifetime: consume 1-2 chars and keep it out of the structure scan
        const width = next === '\\' ? 3 : 2;
        spans.push({ text: line.slice(i, i + width), code: false });
        i += width;
      }
      continue;
    }
    if (OPENERS.includes(ch)) {
      plain += ch;
      delta += 1;
      hasCode = true;
      leading = false;
      i += 1;
      continue;
    }
    if (isCloser(ch)) {
      plain += ch;
      delta -= 1;
      hasCode = true;
      if (leading) leadingClosers += 1;
      i += 1;
      continue;
    }
    if (!/\s/.test(ch)) {
      leading = false;
      codeEnd = i + 1;
    }
    if (!/\s/.test(ch)) hasCode = true;
    plain += ch;
    i += 1;
  }
  flushPlain();

  const codePart = line.slice(0, codeEnd);
  return {
    spans,
    endsWithColon: codePart.trimEnd().endsWith(':'),
    delta,
    leadingClosers,
    hasCode,
  };
}

/** Conservative whitespace cleanup, applied to code spans only (strings / comments excluded) */
function tidyCode(text: string): string {
  let out = text;
  out = out.replace(/\s+([,;)\]}])/g, '$1');
  out = out.replace(/([,;])(?=\S)/g, '$1 ');
  out = out.replace(/\s*(===|!==|==|!=|<=|>=|=>|->|&&|\|\|)\s*/g, ' $1 ');
  out = out.replace(/(?<![=!<>+\-*/%&|^~])=(?!=)/g, ' = ');
  out = out.replace(/ {2,}/g, ' ');
  return out;
}

function lineIndentWidth(line: string, tabWidth: number): number {
  let width = 0;
  for (const ch of line) {
    if (ch === ' ') width += 1;
    else if (ch === '\t') width += Math.max(1, tabWidth);
    else break;
  }
  return width;
}

/**
 * Lightweight formatting: re-indent and tidy whitespace.
 * Empty input returns EMPTY; any exception is caught and reported as FORMAT_FAILED (core never throws).
 */
export function formatFallback(code: string, options: FallbackOptions): ToolResult<string> {
  if (!code.trim()) return { ok: false, error: 'EMPTY' };
  try {
    const opts: FallbackOptions = { mode: 'brackets', ...options };
    const unit = opts.indentUnit || '  ';
    const tabWidth = unit.startsWith('\t') ? 2 : unit.length;
    const text = code.replace(/^\uFEFF/, '').replace(/\r\n?/g, '\n');
    const lines = text.split('\n');
    const state: ScanState = { blockComment: false, triple: null };

    const out: string[] = [];
    let depth = 0;
    let blankRun = 0;
    /** Indent-level stack for `indent` mode (original indent widths) */
    const levels: number[] = [0];
    let prevEndsWithColon = false;

    for (const raw of lines) {
      const line = raw.replace(/\s+$/, '');
      if (!line.trim()) {
        blankRun += 1;
        if (blankRun <= 1 && out.length > 0) out.push('');
        continue;
      }
      blankRun = 0;

      const scan = scanLine(line, state, opts);
      const content = scan.spans
        .map((span) => (span.code ? tidyCode(span.text) : span.text))
        .join('');
      // Lines starting with a comment / string keep their alignment (e.g. inside block comments); code lines lose leading space
      const keepLeading = scan.spans.length > 0 && !scan.spans[0].code;
      const body = keepLeading ? content : content.replace(/^\s+/, '');

      let level: number;
      if (opts.mode === 'indent') {
        const width = lineIndentWidth(raw, tabWidth);
        while (levels.length > 1 && width < levels[levels.length - 1]) levels.pop();
        if (width > levels[levels.length - 1] && (prevEndsWithColon || levels.length === 1)) {
          levels.push(width);
        }
        // Unclosed brackets → continuation lines get one extra level
        level = levels.length - 1 + (depth > 0 ? 1 : 0);
      } else {
        level = Math.max(0, depth - scan.leadingClosers);
      }

      out.push(body ? unit.repeat(level) + body : '');

      depth = Math.max(0, depth + scan.delta);
      prevEndsWithColon = scan.endsWithColon;
    }

    return {
      ok: true,
      value: out
        .join('\n')
        .replace(/\n{3,}/g, '\n\n')
        .trimEnd(),
    };
  } catch {
    return { ok: false, error: 'FORMAT_FAILED' };
  }
}
