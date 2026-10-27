import type { ToolResult } from '@/core/types';
import { lineSpans, offsetToLineCol } from './lines';

/**
 * Line-operation pure logic (phase 2): comment toggling, moving / duplicating / deleting /
 * transposing lines, indentation and go-to-line.
 *
 * Design rules (consistent with `EditorSelection` in `markdown-preview/editor.ts`):
 * - Input and output are plain "text + selection"; the DOM is never touched, so it unit-tests well;
 * - Failures caused by language capabilities (e.g. CSS has no line comments) return `ToolResult`,
 *   while geometry-only operations always succeed;
 * - Indentation and comments are always applied **after the leading whitespace**, so the
 *   existing indent level is preserved.
 */

export interface EditorSelection {
  text: string;
  selectionStart: number;
  selectionEnd: number;
}

/** One text edit: remove `remove` characters at `at` and insert `insert` instead */
export interface TextEdit {
  at: number;
  remove: number;
  insert: string;
}

export interface LineRange {
  /** First line covered by the selection (1-based) */
  firstLine: number;
  /** Last line covered by the selection (1-based, inclusive) */
  lastLine: number;
  /** Offset of the first line's start */
  start: number;
  /** Offset of the last line's end (newline excluded) */
  end: number;
}

const LEADING_WS_RE = /^[ \t]*/;

/** Length of the leading whitespace */
function indentWidth(line: string): number {
  return LEADING_WS_RE.exec(line)?.[0].length ?? 0;
}

/** Newline sequence at `offset` (CRLF / CR / LF); returns '' when the text ends without one */
function separatorAt(text: string, offset: number): string {
  if (text[offset] === '\r') return text[offset + 1] === '\n' ? '\r\n' : '\r';
  if (text[offset] === '\n') return '\n';
  return '';
}

/** Newline for a line block: the one after the block, else the one before, else `\n` (CRLF docs stay CRLF) */
function lineEndingFor(text: string, range: LineRange): string {
  const trailing = separatorAt(text, range.end);
  if (trailing) return trailing;
  const before = text.slice(0, range.start);
  if (before.endsWith('\r\n')) return '\r\n';
  if (before.endsWith('\n')) return '\n';
  if (before.endsWith('\r')) return '\r';
  return '\n';
}

/**
 * Shift both selection edges along with a batch of edits:
 * - Entirely before an edit → translated by its delta; inside a deleted range → snapped to the
 *   end of the inserted text;
 * - Edits are sorted by start offset and never overlap (guaranteed by the caller).
 */
function mapPosition(sorted: TextEdit[], pos: number): number {
  let delta = 0;
  for (const edit of sorted) {
    const end = edit.at + edit.remove;
    if (end <= pos) {
      delta += edit.insert.length - edit.remove;
      continue;
    }
    if (edit.at <= pos) return edit.at + delta + edit.insert.length;
    break;
  }
  return pos + delta;
}

/** Apply a batch of text edits and remap the selection */
export function applyEdits(
  text: string,
  edits: TextEdit[],
  selectionStart: number,
  selectionEnd: number,
): EditorSelection {
  const sorted = [...edits].sort((a, b) => a.at - b.at);
  let next = '';
  let cursor = 0;
  for (const edit of sorted) {
    next += text.slice(cursor, edit.at) + edit.insert;
    cursor = edit.at + edit.remove;
  }
  next += text.slice(cursor);
  return {
    text: next,
    selectionStart: mapPosition(sorted, selectionStart),
    selectionEnd: mapPosition(sorted, selectionEnd),
  };
}

/** Full-line range covered by the selection; a trailing caret at column 0 does not count (as in mainstream editors) */
export function selectionLineRange(
  text: string,
  selectionStart: number,
  selectionEnd: number,
): LineRange {
  const start = Math.min(selectionStart, selectionEnd);
  const end = Math.max(selectionStart, selectionEnd);
  const spans = lineSpans(text);
  const from = offsetToLineCol(text, start);
  const to = offsetToLineCol(text, end);
  const firstLine = from.line;
  let lastLine = to.line;
  if (lastLine > firstLine && to.col === 0) lastLine -= 1;
  const firstSpan = spans[firstLine - 1] ?? spans[0]!;
  const lastSpan = spans[lastLine - 1] ?? spans[spans.length - 1]!;
  return { firstLine, lastLine, start: firstSpan.start, end: lastSpan.end };
}

/** Select an entire line (used by go-to-line); returns the new selection */
export function selectLine(text: string, line: number): EditorSelection {
  const spans = lineSpans(text);
  const index = Math.min(Math.max(Math.trunc(line) - 1, 0), spans.length - 1);
  const span = spans[index]!;
  return { text, selectionStart: span.start, selectionEnd: span.end };
}

/** Whether the line is already commented (checked after the leading whitespace) */
function isLineCommented(line: string, marker: string): boolean {
  return line.slice(indentWidth(line)).startsWith(marker);
}

/**
 * Toggle line comments: if every line is commented, uncomment them; otherwise comment them all
 * (blank lines are skipped). As in VS Code the marker goes after the leading whitespace, and
 * uncommenting also removes one trailing space.
 */
export function toggleLineComment(
  text: string,
  selectionStart: number,
  selectionEnd: number,
  lineComment: string | undefined,
): ToolResult<EditorSelection> {
  const marker = lineComment?.trim();
  if (!marker) return { ok: false, error: 'UNSUPPORTED' };

  const range = selectionLineRange(text, selectionStart, selectionEnd);
  const targets = lineSpans(text)
    .slice(range.firstLine - 1, range.lastLine)
    .filter((span) => span.text.trim().length > 0);
  if (targets.length === 0) return { ok: true, value: { text, selectionStart, selectionEnd } };

  const commented = targets.every((span) => isLineCommented(span.text, marker));
  const edits: TextEdit[] = targets.map((span) => {
    const at = span.start + indentWidth(span.text);
    if (!commented) return { at, remove: 0, insert: `${marker} ` };
    const rest = span.text.slice(indentWidth(span.text));
    return { at, remove: marker.length + (rest.startsWith(`${marker} `) ? 1 : 0), insert: '' };
  });

  return { ok: true, value: applyEdits(text, edits, selectionStart, selectionEnd) };
}

/**
 * Toggle block comments: if the markers already sit on **both** sides of the selection, remove
 * them; otherwise wrap the selection. With a collapsed caret a matching `open close` pair is
 * inserted and the caret placed between them (triggering again removes it, so it round-trips).
 */
export function toggleBlockComment(
  text: string,
  selectionStart: number,
  selectionEnd: number,
  block: [string, string] | undefined,
): ToolResult<EditorSelection> {
  if (!block || block.length !== 2) return { ok: false, error: 'UNSUPPORTED' };
  const [open, close] = block;
  const start = Math.min(selectionStart, selectionEnd);
  const end = Math.max(selectionStart, selectionEnd);

  const before = text.slice(0, start);
  const after = text.slice(end);
  const beforeMark = before.endsWith(`${open} `) ? `${open} ` : before.endsWith(open) ? open : null;
  const afterMark = after.startsWith(` ${close}`)
    ? ` ${close}`
    : after.startsWith(close)
      ? close
      : null;

  if (beforeMark && afterMark) {
    return {
      ok: true,
      value: {
        text:
          before.slice(0, before.length - beforeMark.length) +
          text.slice(start, end) +
          after.slice(afterMark.length),
        selectionStart: start - beforeMark.length,
        selectionEnd: end - beforeMark.length,
      },
    };
  }

  const shift = open.length + 1;
  if (start === end) {
    return {
      ok: true,
      value: {
        text: `${before}${open} ${close}${after}`,
        selectionStart: start + shift,
        selectionEnd: start + shift,
      },
    };
  }
  return {
    ok: true,
    value: {
      text: `${before}${open} ${text.slice(start, end)} ${close}${after}`,
      selectionStart: start + shift,
      selectionEnd: end + shift,
    },
  };
}

/** Move a line block up / down; returns the input unchanged at the first / last line */
export function moveLines(
  text: string,
  selectionStart: number,
  selectionEnd: number,
  direction: 'up' | 'down',
): EditorSelection {
  const range = selectionLineRange(text, selectionStart, selectionEnd);
  const spans = lineSpans(text);
  const block = text.slice(range.start, range.end);

  if (direction === 'up') {
    if (range.firstLine <= 1) return { text, selectionStart, selectionEnd };
    const prev = spans[range.firstLine - 2]!;
    const sep = text.slice(prev.end, range.start);
    const shift = -(prev.text.length + sep.length);
    return {
      text: text.slice(0, prev.start) + block + sep + prev.text + text.slice(range.end),
      selectionStart: selectionStart + shift,
      selectionEnd: selectionEnd + shift,
    };
  }

  if (range.lastLine >= spans.length) return { text, selectionStart, selectionEnd };
  const next = spans[range.lastLine]!;
  const sep = text.slice(range.end, next.start);
  const shift = next.text.length + sep.length;
  return {
    text: text.slice(0, range.start) + next.text + sep + block + text.slice(next.end),
    selectionStart: selectionStart + shift,
    selectionEnd: selectionEnd + shift,
  };
}

/**
 * Transpose lines (single-line semantics): swap with the previous line, or with the next line
 * when already on the first. Unlike `moveLines`, this always acts on **one** line and never
 * expands to the whole selected block.
 */
export function transposeLine(
  text: string,
  selectionStart: number,
  selectionEnd: number,
): EditorSelection {
  const { start, end } = selectionLineRange(text, selectionStart, selectionEnd);
  const direction = offsetToLineCol(text, start).line <= 1 ? 'down' : 'up';
  return moveLines(text, start, end, direction);
}

/**
 * Duplicate the current line (or selected block): inserting below when duplicating down, above
 * when duplicating up. The selection stays on the **original block** so it can be repeated; the
 * newline sequence is taken from the source (CRLF is preserved).
 */
export function duplicateLines(
  text: string,
  selectionStart: number,
  selectionEnd: number,
  direction: 'up' | 'down' = 'down',
): EditorSelection {
  const range = selectionLineRange(text, selectionStart, selectionEnd);
  const block = text.slice(range.start, range.end);
  // Newline right after the block (keeps CRLF); falls back to the document's own when it is last
  const separator = lineEndingFor(text, range);
  if (direction === 'up') {
    const shift = block.length + separator.length;
    return {
      text: `${text.slice(0, range.start)}${block}${separator}${text.slice(range.start)}`,
      selectionStart: selectionStart + shift,
      selectionEnd: selectionEnd + shift,
    };
  }
  return {
    text: `${text.slice(0, range.end)}${separator}${block}${text.slice(range.end)}`,
    selectionStart,
    selectionEnd,
  };
}

/** Delete the current line (or selected block); for the last line the preceding newline goes too */
export function deleteLines(
  text: string,
  selectionStart: number,
  selectionEnd: number,
): EditorSelection {
  const range = selectionLineRange(text, selectionStart, selectionEnd);
  const spans = lineSpans(text);
  const isLastLine = range.lastLine >= spans.length;

  if (isLastLine && range.firstLine > 1) {
    const prevEnd = spans[range.firstLine - 2]!.end;
    return {
      text: text.slice(0, prevEnd) + text.slice(range.end),
      selectionStart: prevEnd,
      selectionEnd: prevEnd,
    };
  }

  const separator = separatorAt(text, range.end);
  const next = text.slice(0, range.start) + text.slice(range.end + separator.length);
  const caret = Math.min(range.start, next.length);
  return { text: next, selectionStart: caret, selectionEnd: caret };
}

/** Indent / outdent the selected block (blank lines skipped; outdent removes at most one unit) */
export function indentLines(
  text: string,
  selectionStart: number,
  selectionEnd: number,
  unit: string,
  delta: 1 | -1,
): EditorSelection {
  const range = selectionLineRange(text, selectionStart, selectionEnd);
  const targets = lineSpans(text)
    .slice(range.firstLine - 1, range.lastLine)
    .filter((span) => span.text.trim().length > 0);

  const edits: TextEdit[] = [];
  for (const span of targets) {
    const width = indentWidth(span.text);
    if (delta > 0) {
      edits.push({ at: span.start, remove: 0, insert: unit });
      continue;
    }
    if (width === 0) continue;
    const leading = span.text.slice(0, width);
    const remove = leading.startsWith(unit) ? unit.length : Math.min(width, unit.length);
    edits.push({ at: span.start, remove, insert: '' });
  }

  return applyEdits(text, edits, selectionStart, selectionEnd);
}
