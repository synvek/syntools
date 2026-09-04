import { diffChars, diffLines, type Change } from 'diff';
import type { ToolResult } from '@/core/types';

export type DiffCellType = 'same' | 'added' | 'removed' | 'empty';

export interface DiffCell {
  type: DiffCellType;
  text: string;
}

/** 左右并排的一行：null 表示该侧无内容（占位对齐） */
export interface DiffRow {
  left: DiffCell | null;
  right: DiffCell | null;
}

/** 单侧源文本行注解（用于编辑器内高亮，行号与源文本一致） */
export type SideLineType = 'same' | 'added' | 'removed';

/** 行内片段：仅差异片段带 added/removed，相同部分为 same */
export interface DiffSegment {
  text: string;
  type: SideLineType;
}

export interface AnnotatedLine {
  text: string;
  /** 行级类型（行号着色）；有行内差异时仍为 added/removed */
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

/** 两侧文本合计上限，超过拒绝计算（防主线程长时间阻塞） */
export const MAX_DIFF_LENGTH = 200_000;

/** 将 diff change 的 value 拆为行；去掉尾部换行产生的空尾行 */
function toLines(value: string): string[] {
  const lines = value.split('\n');
  if (lines.length > 0 && lines[lines.length - 1] === '') {
    lines.pop();
  }
  return lines;
}

/** 编辑器展示用：保留末尾空行，空字符串视为一行 */
export function splitEditorLines(text: string): string[] {
  return text.split('\n');
}

/** 补齐末尾换行：使行比较忽略「文末是否有换行」的差异（空行差异不受影响） */
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
 * 对配对的修改行做字符级 diff，仅标记不同片段。
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
 * 行级对比并做左右对齐：
 * - 连续的 removed+added 块配对为「修改」，逐行并排（多的一侧用 empty 占位）
 * - 纯 added / removed 另一侧为 null
 * - 空行差异（如多余空行）会作为 removed/added 行正确呈现
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
 * 按源文本行注解左右两侧（无对齐占位），供编辑器内高亮与行号。
 * 修改行做字符级片段高亮；纯增删行整行标记。
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

/** 统计增/删/未变行数（empty 占位行不计） */
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
 * 将注解对齐到当前编辑器行：防抖计算滞后时按行数补齐/截断，避免高亮错位。
 * 若该行文本与注解一致则保留行内片段；否则退化为整行类型标记。
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
