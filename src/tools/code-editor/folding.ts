import type { LangSpec } from './core';
import { lineSpans, type LineSpan } from './lines';

/**
 * 可折叠范围计算（阶段 4）。
 *
 * 重要前提：编辑区由 CodeJar 托管，内容就是一段纯文本（`textContent`），
 * 隐藏部分行只能靠**改写文本**实现，会破坏草稿 / 导出 / 撤销的一致性。
 * 因此这里只产出「可折叠范围」，由编辑区以**折叠标记 + 范围高亮 + 行数徽标**呈现，
 * 不做隐藏式折叠（真正的隐藏折叠需要更换编辑器内核，见方案文档 4.3 / 六）。
 */

export interface FoldRange {
  /** 折叠头所在行（1 起始） */
  headerLine: number;
  /** 折叠体末行（1 起始，含） */
  endLine: number;
  /** 嵌套深度（0 起） */
  depth: number;
}

export type FoldMode = 'brackets' | 'indent';

/** 单文件参与计算的可折叠范围上限（超长文件下只保留前若干层） */
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

/** 跳过字符串（含转义），返回结束下标 */
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

/** 按括号深度求可折叠范围：同一行打开的括号在更后面的行闭合即形成范围 */
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

/** 按缩进求可折叠范围：后一行缩进更深的连续行构成块（Python / YAML / Shell 等） */
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
      if (candidate.text.trim().length === 0) continue; // 空行不打断块
      if (indentOf(candidate) <= base) break;
      endIndex = next;
    }
    if (endIndex > index)
      ranges.push({ headerLine: span.line, endLine: spans[endIndex]!.line, depth: 0 });
  }

  return ranges;
}

/**
 * 计算可折叠范围。
 * @param mode `brackets`（默认）按括号深度；`indent` 按缩进语义
 */
export function foldRanges(text: string, spec: LangSpec, mode: FoldMode = 'brackets'): FoldRange[] {
  const spans = lineSpans(text);
  if (spans.length < 2) return [];
  return mode === 'indent' ? foldByIndent(spans) : foldByBrackets(text, spans, ctxOf(spec));
}

/** 该语言默认的折叠模式：缩进即语义的语言走 indent */
export function defaultFoldMode(spec: LangSpec): FoldMode {
  return spec.fallbackMode === 'indent' ? 'indent' : 'brackets';
}

/** 行号 → 以该行为折叠头的范围（存在嵌套时取最外层，便于一次收起整段） */
export function foldRangeAtLine(ranges: FoldRange[], line: number): FoldRange | null {
  const matched = ranges.filter((range) => range.headerLine === line);
  if (matched.length === 0) return null;
  return matched.reduce(
    (outer, range) => (range.endLine > outer.endLine ? range : outer),
    matched[0]!,
  );
}
