import { diffChars, diffLines, type Change } from 'diff';
import type { ToolResult } from '@/core/types';

export type DiffCellType = 'same' | 'added' | 'removed' | 'empty';

export interface DiffCell {
  type: DiffCellType;
  text: string;
}

/** One side-by-side row: null means that side has no content (alignment placeholder) */
export interface DiffRow {
  left: DiffCell | null;
  right: DiffCell | null;
}

/** Per-line annotation for one side's source text (used for in-editor highlighting; line numbers match the source text) */
export type SideLineType = 'same' | 'added' | 'removed';

/** Inline segment: only differing segments carry added/removed, identical parts are same */
export interface DiffSegment {
  text: string;
  type: SideLineType;
}

export interface AnnotatedLine {
  text: string;
  /** Line-level type (drives line-number coloring); stays added/removed even when inline diffs exist */
  type: SideLineType;
  segments: DiffSegment[];
}

export interface DiffSides {
  left: AnnotatedLine[];
  right: AnnotatedLine[];
}

export interface DiffStats {
  added: number;
  removed: number;
  same: number;
}

/** Combined size limit for both sides; larger inputs are rejected (avoids blocking the main thread) */
export const MAX_DIFF_LENGTH = 200_000;

/** Split a diff change value into lines; drop the empty trailing line produced by a trailing newline */
function toLines(value: string): string[] {
  const lines = value.split('\n');
  if (lines.length > 0 && lines[lines.length - 1] === '') {
    lines.pop();
  }
  return lines;
}

/** For editor display: keep the trailing empty line and treat an empty string as one line */
export function splitEditorLines(text: string): string[] {
  return text.split('\n');
}

/** Pad a trailing newline so line comparison ignores whether the text ends with one (empty-line differences are unaffected) */
function normalizeTrailingNewline(text: string): string {
  return text === '' || text.endsWith('\n') ? text : `${text}\n`;
}

function prepareTexts(
  oldText: string,
  newText: string,
  options: { ignoreWhitespace?: boolean },
): { left: string; right: string } | ToolResult<never> {
  if (oldText.length + newText.length > MAX_DIFF_LENGTH) {
    return {
      ok: false,
      error: 'TOO_LARGE',
      params: { limit: MAX_DIFF_LENGTH / 1000 },
    };
  }
  const left = options.ignoreWhitespace
    ? oldText.replace(/[ \t]+/g, ' ').replace(/[ \t]+$/gm, '')
    : oldText;
  const right = options.ignoreWhitespace
    ? newText.replace(/[ \t]+/g, ' ').replace(/[ \t]+$/gm, '')
    : newText;
  return { left, right };
}

function runDiffLines(left: string, right: string): Change[] {
  return diffLines(normalizeTrailingNewline(left), normalizeTrailingNewline(right));
}

function wholeLine(text: string, type: SideLineType): AnnotatedLine {
  return {
    text,
    type,
    segments: [{ text, type }],
  };
}

function lineTypeFromSegments(segments: DiffSegment[], side: 'left' | 'right'): SideLineType {
  if (side === 'left' && segments.some((s) => s.type === 'removed')) return 'removed';
  if (side === 'right' && segments.some((s) => s.type === 'added')) return 'added';
  return 'same';
}

/**
 * Character-level diff for paired modified lines, marking only the differing segments.
 */
export function inlineCharDiff(
  oldLine: string,
  newLine: string,
): { left: AnnotatedLine; right: AnnotatedLine } {
  const changes = diffChars(oldLine, newLine);
  const leftSegs: DiffSegment[] = [];
  const rightSegs: DiffSegment[] = [];
  for (const c of changes) {
    if (c.removed) {
      leftSegs.push({ text: c.value, type: 'removed' });
    } else if (c.added) {
      rightSegs.push({ text: c.value, type: 'added' });
    } else {
      leftSegs.push({ text: c.value, type: 'same' });
      rightSegs.push({ text: c.value, type: 'same' });
    }
  }
  if (leftSegs.length === 0) leftSegs.push({ text: '', type: 'same' });
  if (rightSegs.length === 0) rightSegs.push({ text: '', type: 'same' });
  return {
    left: {
      text: oldLine,
      type: lineTypeFromSegments(leftSegs, 'left'),
      segments: leftSegs,
    },
    right: {
      text: newLine,
      type: lineTypeFromSegments(rightSegs, 'right'),
      segments: rightSegs,
    },
  };
}

/**
 * Line-level diff with left/right alignment:
 * - consecutive removed+added blocks are paired as modifications and placed side by side (the longer side uses empty placeholders)
 * - pure added / removed lines have null on the other side
 * - empty-line differences (e.g. extra blank lines) are still rendered correctly as removed/added rows
 */
export function computeLineDiff(
  oldText: string,
  newText: string,
  options: { ignoreWhitespace?: boolean } = {},
): ToolResult<DiffRow[]> {
  const prepared = prepareTexts(oldText, newText, options);
  if ('ok' in prepared) return prepared;
  const changes = runDiffLines(prepared.left, prepared.right);
  const rows: DiffRow[] = [];

  for (let i = 0; i < changes.length; i++) {
    const c = changes[i];
    const next = changes[i + 1];
    if (c.removed && next?.added) {
      const lefts = toLines(c.value);
      const rights = toLines(next.value);
      const count = Math.max(lefts.length, rights.length);
      for (let j = 0; j < count; j++) {
        rows.push({
          left:
            j < lefts.length ? { type: 'removed', text: lefts[j] } : { type: 'empty', text: '' },
          right:
            j < rights.length ? { type: 'added', text: rights[j] } : { type: 'empty', text: '' },
        });
      }
      i++;
    } else if (c.added) {
      for (const line of toLines(c.value)) {
        rows.push({ left: null, right: { type: 'added', text: line } });
      }
    } else if (c.removed) {
      for (const line of toLines(c.value)) {
        rows.push({ left: { type: 'removed', text: line }, right: null });
      }
    } else {
      for (const line of toLines(c.value)) {
        rows.push({
          left: { type: 'same', text: line },
          right: { type: 'same', text: line },
        });
      }
    }
  }
  return { ok: true, value: rows };
}

/**
 * Annotate both sides by source-text line (no alignment placeholders) for in-editor highlighting and line numbers.
 * Modified lines get character-level segment highlighting; pure insertions/deletions are marked on the whole line.
 */
export function annotateDiffSides(
  oldText: string,
  newText: string,
  options: { ignoreWhitespace?: boolean } = {},
): ToolResult<DiffSides> {
  const prepared = prepareTexts(oldText, newText, options);
  if ('ok' in prepared) return prepared;
  const changes = runDiffLines(prepared.left, prepared.right);
  const left: AnnotatedLine[] = [];
  const right: AnnotatedLine[] = [];

  for (let i = 0; i < changes.length; i++) {
    const c = changes[i];
    const next = changes[i + 1];
    if (c.removed && next?.added) {
      const lefts = toLines(c.value);
      const rights = toLines(next.value);
      const paired = Math.min(lefts.length, rights.length);
      for (let j = 0; j < paired; j++) {
        const pair = inlineCharDiff(lefts[j], rights[j]);
        left.push(pair.left);
        right.push(pair.right);
      }
      for (let j = paired; j < lefts.length; j++) left.push(wholeLine(lefts[j], 'removed'));
      for (let j = paired; j < rights.length; j++) right.push(wholeLine(rights[j], 'added'));
      i++;
    } else if (c.added) {
      for (const line of toLines(c.value)) right.push(wholeLine(line, 'added'));
    } else if (c.removed) {
      for (const line of toLines(c.value)) left.push(wholeLine(line, 'removed'));
    } else {
      for (const line of toLines(c.value)) {
        left.push(wholeLine(line, 'same'));
        right.push(wholeLine(line, 'same'));
      }
    }
  }
  return { ok: true, value: { left, right } };
}

/** Count added/deleted/unchanged lines (empty placeholder rows are not counted) */
export function diffStats(rows: DiffRow[]): DiffStats {
  const stats: DiffStats = { added: 0, removed: 0, same: 0 };
  for (const row of rows) {
    if (row.left?.type === 'removed') stats.removed++;
    if (row.right?.type === 'added') stats.added++;
    if (row.left?.type === 'same') stats.same++;
  }
  return stats;
}

export function sideStats(sides: DiffSides): DiffStats {
  return {
    added: sides.right.filter((l) => l.type === 'added').length,
    removed: sides.left.filter((l) => l.type === 'removed').length,
    same: sides.left.filter((l) => l.type === 'same').length,
  };
}

/**
 * Align annotations to the current editor lines: when the debounced computation lags, pad or truncate by line count to avoid misaligned highlighting.
 * If a line's text matches its annotation the inline segments are kept; otherwise it falls back to a whole-line type marker.
 */
export function alignAnnotations(
  editorLines: string[],
  annotated: AnnotatedLine[] | undefined,
  fallback: SideLineType,
): AnnotatedLine[] {
  return editorLines.map((text, i) => {
    const ann = annotated?.[i];
    if (!ann) return wholeLine(text, fallback);
    if (ann.text === text) return { ...ann, text };
    return wholeLine(text, ann.type);
  });
}
