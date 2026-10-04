import { diffLines } from 'diff';
import type { ToolResult } from '@/core/types';
import { htmlToPlain } from './core';

/**
 * 版本差异对比（纯逻辑，便于单测）：
 * HTML → 规范文本行（复用 htmlToPlain 的块级换行规则）→ diffLines → 结构化差异。
 *
 * 同时提供「统一视图行」与「左右对照行」两种形态：
 * 前者用于统计与无障碍朗读，后者用于面板渲染。
 */

export type DiffRowKind = 'equal' | 'insert' | 'delete';

export interface DiffRow {
  kind: DiffRowKind;
  /** 行文本（不含换行符） */
  text: string;
  /** 对比基准版本中的行号（1 起）；插入行为 null */
  beforeLine: number | null;
  /** 当前版本中的行号（1 起）；删除行为 null */
  afterLine: number | null;
}

export interface DiffStats {
  addedLines: number;
  removedLines: number;
  addedChars: number;
  removedChars: number;
  beforeLines: number;
  afterLines: number;
}

export interface VersionDiffResult extends DiffStats {
  rows: DiffRow[];
  /** 两份内容完全一致 */
  identical: boolean;
  /** 行级相似度 0–1（1 表示完全相同） */
  similarity: number;
}

/** 统一的空状态错误码，UI 用 translateToolError 渲染 */
const EMPTY_ERROR = 'EMPTY';

/** 拆分行的同时丢弃末尾换行产生的空行，避免虚增行号 */
function toLines(text: string): string[] {
  if (!text) return [];
  const lines = text.split('\n');
  if (lines.length > 0 && lines[lines.length - 1] === '') lines.pop();
  return lines;
}

/**
 * 行级 diff 的前置归一化：补上末尾换行。
 * 否则「末行无换行符」会被 jsdiff 视为与整块文本不同，导致首行被误判为新增。
 */
function toDiffText(text: string): string {
  if (!text) return '';
  return text.endsWith('\n') ? text : `${text}\n`;
}

/**
 * 生成版本差异。
 * 两侧都没有可对比文本时返回 EMPTY（UI 提示而不是渲染空面板）。
 */
export function buildVersionDiff(
  beforeHtml: string,
  afterHtml: string,
): ToolResult<VersionDiffResult> {
  const beforeText = htmlToPlain(beforeHtml);
  const afterText = htmlToPlain(afterHtml);
  if (!beforeText && !afterText) return { ok: false, error: EMPTY_ERROR };

  const rows: DiffRow[] = [];
  let beforeLine = 1;
  let afterLine = 1;
  let addedLines = 0;
  let removedLines = 0;
  let addedChars = 0;
  let removedChars = 0;

  for (const change of diffLines(toDiffText(beforeText), toDiffText(afterText))) {
    const lines = toLines(change.value);
    if (change.added) {
      for (const line of lines) {
        rows.push({ kind: 'insert', text: line, beforeLine: null, afterLine: afterLine++ });
        addedLines += 1;
        addedChars += line.length;
      }
    } else if (change.removed) {
      for (const line of lines) {
        rows.push({ kind: 'delete', text: line, beforeLine: beforeLine++, afterLine: null });
        removedLines += 1;
        removedChars += line.length;
      }
    } else {
      for (const line of lines) {
        rows.push({ kind: 'equal', text: line, beforeLine: beforeLine++, afterLine: afterLine++ });
      }
    }
  }

  const beforeLines = Math.max(0, beforeLine - 1);
  const afterLines = Math.max(0, afterLine - 1);
  const identical = addedLines === 0 && removedLines === 0;

  return {
    ok: true,
    value: {
      rows,
      addedLines,
      removedLines,
      addedChars,
      removedChars,
      beforeLines,
      afterLines,
      identical,
      similarity: identical
        ? 1
        : Math.max(0, 1 - (addedLines + removedLines) / Math.max(1, beforeLines + afterLines)),
    },
  };
}

export type SideRowKind = 'equal' | 'change' | 'insert' | 'delete';

/** 左右对照行：一侧为 null 表示该侧此行不存在 */
export interface DiffSideRow {
  kind: SideRowKind;
  left: DiffRow | null;
  right: DiffRow | null;
}

/**
 * 把统一视图行整理为左右对照行：
 * 连续的删除/插入块按序号两两配对（成对即为「修改」），多余的一侧单独成行。
 */
export function buildSideBySide(rows: readonly DiffRow[]): DiffSideRow[] {
  const out: DiffSideRow[] = [];
  let index = 0;
  while (index < rows.length) {
    const row = rows[index];
    if (row.kind === 'equal') {
      out.push({ kind: 'equal', left: row, right: row });
      index += 1;
      continue;
    }
    const deletions: DiffRow[] = [];
    const insertions: DiffRow[] = [];
    while (index < rows.length && rows[index].kind !== 'equal') {
      const current = rows[index];
      if (current.kind === 'delete') deletions.push(current);
      else insertions.push(current);
      index += 1;
    }
    const pairs = Math.max(deletions.length, insertions.length);
    for (let k = 0; k < pairs; k += 1) {
      const left = deletions[k] ?? null;
      const right = insertions[k] ?? null;
      out.push({
        left,
        right,
        kind: left && right ? 'change' : left ? 'delete' : 'insert',
      });
    }
  }
  return out;
}
