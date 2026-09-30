/**
 * 文本行原语：把「字符偏移 ⇄ 行列」的换算收敛为纯函数，
 * 供行号槽、行操作（阶段 2）与覆盖层定位（阶段 1）共用。
 *
 * 换行口径与 `core.countStats` 保持一致：CRLF / CR / LF 都只算一次换行，
 * 因此 `\r\n` 不会被拆成两行（导入 Windows 源码时行号不会翻倍）。
 */

export interface LineSpan {
  /** 行号（1 起始） */
  line: number;
  /** 行内容在原文中的起始偏移 */
  start: number;
  /** 行内容的结束偏移（不含行尾换行符） */
  end: number;
  /** 行内容（不含换行符） */
  text: string;
}

const BREAK_RE = /\r\n|\r|\n/g;

/** 拆分文本为行片段；空文本视为 1 个空行（与编辑器视觉一致） */
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

/** 行内容数组（空文本 → `['']`） */
export function splitLines(text: string): string[] {
  return lineSpans(text).map((span) => span.text);
}

/** 行数（空文本 → 1） */
export function countLines(text: string): number {
  return lineSpans(text).length;
}

/**
 * 行前导空白的**列数**（制表符按 `tabSize` 折算）。
 * 缩进引导线按列定位，因此这里必须与 CSS 的 `tab-size` 保持一致。
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

/** 偏移钳制到 `[0, text.length]`；`NaN` 视为 0，`±Infinity` 钳到两端 */
export function clampOffset(text: string, offset: number): number {
  if (Number.isNaN(offset)) return 0;
  return Math.max(0, Math.min(Math.trunc(offset), text.length));
}

/**
 * 字符偏移 → 行列（均 1 起始，列 0 起始）。
 * 偏移落在换行符上时归到该行行尾；偏移等于下一行行首时归到下一行。
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

/** 行号（1 起始）→ 行片段下标；越界钳制，`NaN` 视为首行 */
function spanIndexAt(spans: LineSpan[], line: number): number {
  if (Number.isNaN(line)) return 0;
  return Math.min(Math.max(Math.trunc(line) - 1, 0), spans.length - 1);
}

/** 行列 → 字符偏移；行、列越界均钳制到有效范围 */
export function lineColToOffset(text: string, line: number, col: number): number {
  const spans = lineSpans(text);
  const span = spans[spanIndexAt(spans, line)]!;
  const width = Number.isNaN(col) ? 0 : Math.min(Math.max(Math.trunc(col), 0), span.text.length);
  return span.start + width;
}

/** 行号 → 该行行首偏移（越界钳制） */
export function lineStartOffset(text: string, line: number): number {
  return lineColToOffset(text, line, 0);
}

/** 行号 → 该行行尾偏移（不含换行符） */
export function lineEndOffset(text: string, line: number): number {
  const spans = lineSpans(text);
  return spans[spanIndexAt(spans, line)]!.end;
}
