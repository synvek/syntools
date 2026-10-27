import type { LangSpec } from './core';

/**
 * Bracket matching pure logic (phase 4): supplies the matched position for "bracket pair
 * highlighting" and "jump to matching bracket".
 *
 * The editing surface is contenteditable, so highlight nodes cannot be inserted safely inside a
 * line; this module only **computes offsets** and the overlay draws them at the real pixel
 * position (see `CodeSurface`).
 *
 * Strings and comments are skipped while scanning so brackets inside `"}"` or `// )` are ignored.
 */

export interface BracketPair {
  /** Offset of the opening bracket */
  open: number;
  /** Offset of the closing bracket */
  close: number;
}

/** Supported bracket pairs (the intersection of common languages: round / square / curly) */
export const BRACKET_PAIRS: ReadonlyArray<readonly [string, string]> = [
  ['(', ')'],
  ['[', ']'],
  ['{', '}'],
];

/** Characters per scan limit, so an unclosed bracket cannot scan to EOF (degrades gracefully on huge files) */
export const MAX_BRACKET_SCAN = 200_000;

const QUOTES = new Set(['"', "'", '`']);

interface ScanContext {
  lineComment?: string;
  blockComment?: [string, string];
}

function ctxOf(spec: LangSpec): ScanContext {
  return { lineComment: spec.lineComment, blockComment: spec.blockComment };
}

/** Skip a string literal and return the index after it (EOF when unterminated) */
function skipString(text: string, start: number): number {
  const quote = text[start]!;
  let i = start + 1;
  while (i < text.length) {
    const ch = text[i]!;
    if (ch === '\\') {
      i += 2;
      continue;
    }
    if (ch === quote) return i + 1;
    if (ch === '\n' && quote !== '`') return i; // plain strings do not span lines
    i += 1;
  }
  return text.length;
}

/** Skip a line comment and return the index of the newline (exclusive) */
function skipLineComment(text: string, start: number): number {
  let i = start;
  while (i < text.length && text[i] !== '\n') i += 1;
  return i;
}

/** Skip a block comment and return the index after its closing delimiter */
function skipBlockComment(text: string, start: number, close: string): number {
  const end = text.indexOf(close, start);
  return end < 0 ? text.length : end + close.length;
}

/**
 * Scan from `from` to find the other end of the `[open, close]` pair.
 * @param direction 1 scans forward (open → close), -1 scans backward (close → open)
 */
function scanForPair(
  text: string,
  from: number,
  open: string,
  close: string,
  direction: 1 | -1,
  ctx: ScanContext,
): number | null {
  const chStart = direction === 1 ? open : close;
  const chEnd = direction === 1 ? close : open;
  let depth = 0;
  let i = from;
  let steps = 0;

  while (i >= 0 && i < text.length && steps < MAX_BRACKET_SCAN) {
    const ch = text[i]!;
    steps += 1;

    if (direction === 1) {
      if (QUOTES.has(ch)) {
        i = skipString(text, i);
        continue;
      }
      if (ctx.lineComment && text.startsWith(ctx.lineComment, i)) {
        i = skipLineComment(text, i) + 1;
        continue;
      }
      if (ctx.blockComment && text.startsWith(ctx.blockComment[0], i)) {
        i = skipBlockComment(text, i, ctx.blockComment[1]);
        continue;
      }
    }

    if (ch === chStart) depth += 1;
    else if (ch === chEnd) {
      depth -= 1;
      if (depth === 0) return i;
    }
    i += direction;
  }
  return null;
}

function pairOf(ch: string): readonly [string, string] | null {
  return BRACKET_PAIRS.find(([open, close]) => open === ch || close === ch) ?? null;
}

/**
 * Whether the offset sits inside a string / comment (determined by scanning from the start).
 * A caret on a bracket inside a literal such as `"{ }"` must not trigger matching.
 */
function isInsideLiteral(text: string, offset: number, ctx: ScanContext): boolean {
  if (offset > MAX_BRACKET_SCAN) return false; // huge files are treated as code to avoid a full scan on every caret move
  let i = 0;
  while (i < offset) {
    const ch = text[i]!;
    if (QUOTES.has(ch)) {
      const end = skipString(text, i);
      if (offset < end) return true;
      i = end;
      continue;
    }
    if (ctx.lineComment && text.startsWith(ctx.lineComment, i)) {
      const end = skipLineComment(text, i);
      if (offset < end) return true;
      i = end;
      continue;
    }
    if (ctx.blockComment && text.startsWith(ctx.blockComment[0], i)) {
      const end = skipBlockComment(text, i, ctx.blockComment[1]);
      if (offset < end) return true;
      i = end;
      continue;
    }
    i += 1;
  }
  return false;
}

/**
 * Find the partner of the bracket at `offset` (or at the character just before it).
 * Returns null when the caret is not next to a bracket or the bracket is unmatched.
 */
export function findBracketPair(text: string, offset: number, spec: LangSpec): BracketPair | null {
  const positions = [offset, offset - 1];
  const ctx = ctxOf(spec);

  for (const at of positions) {
    if (at < 0 || at >= text.length) continue;
    const ch = text[at]!;
    const pair = pairOf(ch);
    if (!pair) continue;
    if (isInsideLiteral(text, at, ctx)) continue;
    const [open, close] = pair;
    const isOpen = ch === open;
    const other = scanForPair(text, at, open, close, isOpen ? 1 : -1, ctx);
    if (other === null) continue;
    return isOpen ? { open: at, close: other } : { open: other, close: at };
  }
  return null;
}
