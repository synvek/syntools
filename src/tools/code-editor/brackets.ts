import type { LangSpec } from './core';

/**
 * 括号配对纯逻辑（阶段 4）：为「配对高亮」与「跳转到配对括号」提供匹配位置。
 *
 * 编辑区是 contenteditable，无法在行内安全地插入高亮节点，因此这里只负责**算出偏移**，
 * 由覆盖层按实际像素位置绘制（见 `CodeSurface`）。
 *
 * 扫描时跳过字符串与注释，避免把 `"}"` 或 `// )` 里的括号计入配对。
 */

export interface BracketPair {
  /** 左括号偏移 */
  open: number;
  /** 右括号偏移 */
  close: number;
}

/** 支持的括号对（按常见语言取交集：圆括号 / 方括号 / 花括号） */
export const BRACKET_PAIRS: ReadonlyArray<readonly [string, string]> = [
  ['(', ')'],
  ['[', ']'],
  ['{', '}'],
];

/** 单次扫描的字符上限，防止未闭合括号导致扫到文末（超长文件下退化） */
export const MAX_BRACKET_SCAN = 200_000;

const QUOTES = new Set(['"', "'", '`']);

interface ScanContext {
  lineComment?: string;
  blockComment?: [string, string];
}

function ctxOf(spec: LangSpec): ScanContext {
  return { lineComment: spec.lineComment, blockComment: spec.blockComment };
}

/** 跳过字符串字面量，返回结束后的下标（未闭合则返回文末） */
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
    if (ch === '\n' && quote !== '`') return i; // 普通字符串不跨行
    i += 1;
  }
  return text.length;
}

/** 跳过行注释，返回换行符下标（不含） */
function skipLineComment(text: string, start: number): number {
  let i = start;
  while (i < text.length && text[i] !== '\n') i += 1;
  return i;
}

/** 跳过块注释，返回结束符之后的下标 */
function skipBlockComment(text: string, start: number, close: string): number {
  const end = text.indexOf(close, start);
  return end < 0 ? text.length : end + close.length;
}

/**
 * 从 `from` 开始扫描，找到与 `[open, close]` 配对的另一端。
 * @param direction 1 向前（从左括号找右括号），-1 向后（从右括号找左括号）
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
 * 该偏移是否落在字符串 / 注释内部（从文首扫描判定）。
 * 光标停在 `"{ }"` 这类字面量里的括号上时不应触发配对。
 */
function isInsideLiteral(text: string, offset: number, ctx: ScanContext): boolean {
  if (offset > MAX_BRACKET_SCAN) return false; // 超长文件退化为「按代码处理」，避免每次移动光标全量扫描
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
 * 求 `offset` 处（含其前一字符）括号的配对位置。
 * 不在括号旁或括号不配对时返回 null。
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
