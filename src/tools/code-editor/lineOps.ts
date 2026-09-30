import type { ToolResult } from '@/core/types';
import { lineSpans, offsetToLineCol } from './lines';

/**
 * 行操作纯逻辑（阶段 2）：注释切换、行移动 / 复制 / 删除 / 转置、缩进调整、跳转行。
 *
 * 设计约定（与 `markdown-preview/editor.ts` 的 `EditorSelection` 一致）：
 * - 输入输出都是「文本 + 选区」，不触碰 DOM，便于单测；
 * - 可由语言能力决定的失败（如 CSS 没有行注释）返回 `ToolResult`，几何类操作恒成功；
 * - 缩进 / 注释一律改写**行首空白之后**的位置，保留原有缩进层级。
 */

export interface EditorSelection {
  text: string;
  selectionStart: number;
  selectionEnd: number;
}

/** 一次文本编辑：在 `at` 处删除 `remove` 个字符并插入 `insert` */
export interface TextEdit {
  at: number;
  remove: number;
  insert: string;
}

export interface LineRange {
  /** 选区覆盖的首行（1 起始） */
  firstLine: number;
  /** 选区覆盖的末行（1 起始，含） */
  lastLine: number;
  /** 首行行首偏移 */
  start: number;
  /** 末行行尾偏移（不含换行符） */
  end: number;
}

const LEADING_WS_RE = /^[ \t]*/;

/** 行首空白长度 */
function indentWidth(line: string): number {
  return LEADING_WS_RE.exec(line)?.[0].length ?? 0;
}

/** 取 `offset` 处的换行符（CRLF / CR / LF）；末尾无换行时返回 '' */
function separatorAt(text: string, offset: number): string {
  if (text[offset] === '\r') return text[offset + 1] === '\n' ? '\r\n' : '\r';
  if (text[offset] === '\n') return '\n';
  return '';
}

/** 行块应使用的换行符：优先块后紧跟的，其次块前的，最后回退 `\n`（CRLF 文档复制出的行仍为 CRLF） */
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
 * 把选区两端跟随一组编辑位移：
 * - 完全落在编辑之前 → 整体平移；落在被删除区间内 → 贴到插入内容之后；
 * - 编辑按起点升序、互不重叠（调用方保证）。
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

/** 应用一组文本编辑并同步选区 */
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

/** 选区覆盖的整行范围；选区结束落在行首时不把该行计入（与主流编辑器一致） */
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

/** 选中整行（跳转行用）：返回新选区 */
export function selectLine(text: string, line: number): EditorSelection {
  const spans = lineSpans(text);
  const index = Math.min(Math.max(Math.trunc(line) - 1, 0), spans.length - 1);
  const span = spans[index]!;
  return { text, selectionStart: span.start, selectionEnd: span.end };
}

/** 该行是否已被行注释符注释（按行首空白之后判断） */
function isLineCommented(line: string, marker: string): boolean {
  return line.slice(indentWidth(line)).startsWith(marker);
}

/**
 * 切换行注释：全部已注释 → 取消注释；否则统一加注释（空行跳过）。
 * 与 VS Code 一致，注释符插在行首空白之后，取消时连同一个尾随空格一并移除。
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
 * 切换块注释：选区**两侧**已有块注释符 → 拆掉；否则用块注释符包裹。
 * 折叠光标时插入成对的 `开 关` 并把光标置于中间（再次触发即拆掉，可往返切换）。
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

/** 上移 / 下移整行块；已在首行 / 末行时原样返回 */
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
 * 转置行（单行语义）：与上一行互换；已在首行则与下一行互换。
 * 与 `moveLines` 的区别：转置始终只针对**一行**，不随选区扩张成块。
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
 * 复制当前行（或所选行块）：向下复制时把块插到下方，向上复制时插到上方。
 * 选区始终停留在**原行块**上，可连续触发；换行符沿用原文（保留 CRLF）。
 */
export function duplicateLines(
  text: string,
  selectionStart: number,
  selectionEnd: number,
  direction: 'up' | 'down' = 'down',
): EditorSelection {
  const range = selectionLineRange(text, selectionStart, selectionEnd);
  const block = text.slice(range.start, range.end);
  // 块后紧跟的换行符（保留 CRLF）；块是最后一行时回退到文档既有换行符
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

/** 删除当前行（或所选行块）；末行会连同上一行的换行一起删除 */
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

/** 增加 / 减少所选行块的缩进（空行跳过；减少时最多移除一个缩进单元） */
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
