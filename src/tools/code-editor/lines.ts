/**
 * Text-line primitives: "character offset ⇄ line/column" conversions as pure functions, shared by
 * the gutter, line operations (phase 2) and overlay positioning (phase 1).
 *
 * Line breaks follow `core.countStats`: CRLF / CR / LF each count as a single break, so `\r\n`
 * never produces two lines (line numbers do not double when importing Windows sources).
 */

export interface LineSpan {
  /** Line number (1-based) */
  line: number;
  /** Offset where the line content starts in the source */
  start: number;
  /** Offset where the line content ends (trailing newline excluded) */
  end: number;
  /** Line content (newline excluded) */
  text: string;
}

const BREAK_RE = /\r\n|\r|\n/g;

/** Split text into line spans; empty text counts as one empty line (matching the editor view) */
export function lineSpans(text: string): LineSpan[] {
  const spans: LineSpan[] = [];
  let start = 0;
  let line = 1;
  BREAK_RE.lastIndex = 0;
  let match = BREAK_RE.exec(text);
  while (match !== null) {
    spans.push({ line, start, end: match.index, text: text.slice(start, match.index) });
    start = match.index + match[0].length;
    line += 1;
    match = BREAK_RE.exec(text);
  }
  spans.push({ line, start, end: text.length, text: text.slice(start) });
  return spans;
}

/** Array of line contents (empty text → `['']`) */
export function splitLines(text: string): string[] {
  return lineSpans(text).map((span) => span.text);
}

/** Line count (empty text → 1) */
export function countLines(text: string): number {
  return lineSpans(text).length;
}

/**
 * **Column count** of the line's leading whitespace (tabs expanded to `tabSize`).
 * Indent guides are positioned by column, so this must stay consistent with CSS `tab-size`.
 */
export function leadingColumns(line: string, tabSize: number): number {
  let columns = 0;
  for (const char of line) {
    if (char === ' ') columns += 1;
    else if (char === '\t') columns += tabSize;
    else break;
  }
  return columns;
}

/** Clamp an offset into `[0, text.length]`; `NaN` becomes 0 and `±Infinity` clamps to either end */
export function clampOffset(text: string, offset: number): number {
  if (Number.isNaN(offset)) return 0;
  return Math.max(0, Math.min(Math.trunc(offset), text.length));
}

/**
 * Character offset → line/column (line is 1-based, column is 0-based).
 * An offset on a newline belongs to the end of that line; an offset equal to the next line's
 * start belongs to the next line.
 */
export function offsetToLineCol(text: string, offset: number): { line: number; col: number } {
  const target = clampOffset(text, offset);
  const spans = lineSpans(text);
  for (let i = 0; i < spans.length; i += 1) {
    const span = spans[i]!;
    if (target <= span.end) return { line: span.line, col: target - span.start };
    const next = spans[i + 1];
    if (next && target < next.start) return { line: span.line, col: span.text.length };
  }
  const last = spans[spans.length - 1]!;
  return { line: last.line, col: last.text.length };
}

/** Line number (1-based) → span index; out-of-range values are clamped, `NaN` means the first line */
function spanIndexAt(spans: LineSpan[], line: number): number {
  if (Number.isNaN(line)) return 0;
  return Math.min(Math.max(Math.trunc(line) - 1, 0), spans.length - 1);
}

/** Line/column → character offset; both line and column are clamped to the valid range */
export function lineColToOffset(text: string, line: number, col: number): number {
  const spans = lineSpans(text);
  const span = spans[spanIndexAt(spans, line)]!;
  const width = Number.isNaN(col) ? 0 : Math.min(Math.max(Math.trunc(col), 0), span.text.length);
  return span.start + width;
}

/** Line number → offset of that line's start (clamped) */
export function lineStartOffset(text: string, line: number): number {
  return lineColToOffset(text, line, 0);
}

/** Line number → offset of that line's end (newline excluded) */
export function lineEndOffset(text: string, line: number): number {
  const spans = lineSpans(text);
  return spans[spanIndexAt(spans, line)]!.end;
}
