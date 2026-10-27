import type { LangSpec } from './core';
import { lineSpans, type LineSpan } from './lines';

/**
 * Foldable range computation (phase 4).
 *
 * Important caveat: the editing surface is owned by CodeJar and its content is plain text
 * (`textContent`), so hiding lines would require **rewriting the text**, which breaks draft /
 * export / undo consistency. This module therefore only produces "foldable ranges", which the
 * surface renders as **fold markers + range highlight + line-count badge**; it does not hide
 * anything (real folding needs a different editor kernel, see design doc 4.3 / section 6).
 */

export interface FoldRange {
  /** Line of the fold header (1-based) */
  headerLine: number;
  /** Last line of the fold body (1-based, inclusive) */
  endLine: number;
  /** Nesting depth (0-based) */
  depth: number;
}

export type FoldMode = 'brackets' | 'indent';

/** Max foldable ranges computed per file (huge files keep only the outermost layers) */
export const MAX_FOLD_RANGES = 2000;

const OPEN_BRACKETS = new Set(['{', '[', '(']);
const CLOSE_BRACKETS = new Set(['}', ']', ')']);
const QUOTES = new Set(['"', "'", '`']);

interface ScanContext {
  lineComment?: string;
  blockComment?: [string, string];
}

function ctxOf(spec: LangSpec): ScanContext {
  return { lineComment: spec.lineComment, blockComment: spec.blockComment };
}

/** Skip a string (escapes included) and return the end index */
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
    if (ch === '\n' && quote !== '`') return i;
    i += 1;
  }
  return text.length;
}

/** Fold ranges by bracket depth: a bracket opened on a line and closed on a later line forms a range */
function foldByBrackets(text: string, spans: LineSpan[], ctx: ScanContext): FoldRange[] {
  const ranges: FoldRange[] = [];
  const stack: Array<{ line: number; depth: number }> = [];
  let i = 0;
  let lineIndex = 0;

  while (i < text.length && ranges.length < MAX_FOLD_RANGES) {
    const ch = text[i]!;
    while (lineIndex + 1 < spans.length && spans[lineIndex + 1]!.start <= i) lineIndex += 1;

    if (QUOTES.has(ch)) {
      i = skipString(text, i);
      continue;
    }
    if (ctx.lineComment && text.startsWith(ctx.lineComment, i)) {
      while (i < text.length && text[i] !== '\n') i += 1;
      continue;
    }
    if (ctx.blockComment && text.startsWith(ctx.blockComment[0], i)) {
      const end = text.indexOf(ctx.blockComment[1], i);
      i = end < 0 ? text.length : end + ctx.blockComment[1].length;
      continue;
    }
    if (OPEN_BRACKETS.has(ch)) {
      stack.push({ line: spans[lineIndex]!.line, depth: stack.length });
      i += 1;
      continue;
    }
    if (CLOSE_BRACKETS.has(ch)) {
      const entry = stack.pop();
      const line = spans[lineIndex]!.line;
      if (entry && line > entry.line) {
        ranges.push({ headerLine: entry.line, endLine: line, depth: entry.depth });
      }
      i += 1;
      continue;
    }
    i += 1;
  }

  return ranges;
}

/** Fold ranges by indentation: consecutive lines indented deeper than the header form a block (Python / YAML / Shell) */
function foldByIndent(spans: LineSpan[]): FoldRange[] {
  const ranges: FoldRange[] = [];
  const indentOf = (span: LineSpan) => {
    const leading = /^[ \t]*/.exec(span.text)?.[0] ?? '';
    let columns = 0;
    for (const ch of leading) columns += ch === '\t' ? 2 : 1;
    return columns;
  };

  for (let index = 0; index < spans.length && ranges.length < MAX_FOLD_RANGES; index += 1) {
    const span = spans[index]!;
    if (span.text.trim().length === 0) continue;
    const base = indentOf(span);
    let endIndex = index;
    for (let next = index + 1; next < spans.length; next += 1) {
      const candidate = spans[next]!;
      if (candidate.text.trim().length === 0) continue; // blank lines do not break the block
      if (indentOf(candidate) <= base) break;
      endIndex = next;
    }
    if (endIndex > index)
      ranges.push({ headerLine: span.line, endLine: spans[endIndex]!.line, depth: 0 });
  }

  return ranges;
}

/**
 * Compute foldable ranges.
 * @param mode `brackets` (default) folds by bracket depth; `indent` folds by indentation
 */
export function foldRanges(text: string, spec: LangSpec, mode: FoldMode = 'brackets'): FoldRange[] {
  const spans = lineSpans(text);
  if (spans.length < 2) return [];
  return mode === 'indent' ? foldByIndent(spans) : foldByBrackets(text, spans, ctxOf(spec));
}

/** Default fold mode for a language: indent-based languages use `indent` */
export function defaultFoldMode(spec: LangSpec): FoldMode {
  return spec.fallbackMode === 'indent' ? 'indent' : 'brackets';
}

/** Line number → range headed by that line (outermost when nested, so the whole chunk collapses at once) */
export function foldRangeAtLine(ranges: FoldRange[], line: number): FoldRange | null {
  const matched = ranges.filter((range) => range.headerLine === line);
  if (matched.length === 0) return null;
  return matched.reduce(
    (outer, range) => (range.endLine > outer.endLine ? range : outer),
    matched[0]!,
  );
}
