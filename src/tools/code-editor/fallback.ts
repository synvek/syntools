import type { ToolResult } from '@/core/types';

/**
 * 内置轻量格式化器（兜底）。
 *
 * 背景：prettier v3 生态没有维护中的 Rust / Go / C / C++ / C# / Python / Kotlin / Swift
 * 等语言插件（唯一 Rust 插件 `prettier-plugin-rust` 停留在 prettier@2 且已停更），
 * 因此这些语言走本文件的本地实现：
 *   - `brackets` 模式：按括号深度重排缩进（C / Rust / Go / Java / Kotlin / Swift …）
 *   - `indent` 模式：以原始缩进层级为骨架重排（Python / Ruby / Shell — 缩进本身即语义）
 * 两种模式都会跳过字符串与注释，避免把 `}` 之类的内容误判为结构符号。
 */

export type FallbackMode = 'brackets' | 'indent';

export interface FallbackOptions {
  /** 缩进单元，如 '  ' / '    ' / '\t' */
  indentUnit: string;
  mode?: FallbackMode;
  /** `#` 视为行注释（Shell / Ruby / Python） */
  hashComment?: boolean;
  /** `--` 视为行注释（Lua / SQL / Haskell） */
  dashComment?: boolean;
}

interface ScanState {
  blockComment: boolean;
  /** 三引号字符串的结束标记，如 '"""' / "'''" */
  triple: string | null;
}

/** 行内片段：code 可被格式化，其余原样保留 */
interface Span {
  text: string;
  code: boolean;
}

interface LineScan {
  spans: Span[];
  /** 该行代码部分是否以 `:` 结尾（Python 块起始） */
  endsWithColon: boolean;
  /** 行尾括号深度变化量 */
  delta: number;
  /** 行首闭合括号数量（用于本行前置去缩进） */
  leadingClosers: number;
  hasCode: boolean;
}

const CLOSERS = ')]}';
const OPENERS = '([{';

function isCloser(ch: string): boolean {
  return CLOSERS.includes(ch);
}

/** 扫描一行：识别字符串 / 注释跨度并统计括号，跨行状态写入 state */
function scanLine(line: string, state: ScanState, opts: FallbackOptions): LineScan {
  const spans: Span[] = [];
  let plain = '';
  let delta = 0;
  let leadingClosers = 0;
  let hasCode = false;
  let codeEnd = 0;
  let leading = true;

  const flushPlain = () => {
    if (plain) {
      spans.push({ text: plain, code: true });
      plain = '';
    }
  };

  let i = 0;
  const n = line.length;

  while (i < n) {
    // 三引号字符串（Python 文档串）
    if (state.triple) {
      const end = line.indexOf(state.triple, i);
      if (end < 0) {
        spans.push({ text: line.slice(i), code: false });
        i = n;
      } else {
        spans.push({ text: line.slice(i, end + 3), code: false });
        i = end + 3;
        state.triple = null;
      }
      continue;
    }
    // 块注释
    if (state.blockComment) {
      const end = line.indexOf('*/', i);
      if (end < 0) {
        spans.push({ text: line.slice(i), code: false });
        i = n;
      } else {
        spans.push({ text: line.slice(i, end + 2), code: false });
        i = end + 2;
        state.blockComment = false;
      }
      continue;
    }

    const ch = line[i];
    const next = line[i + 1];

    if (ch === '/' && next === '*') {
      flushPlain();
      spans.push({ text: '/*', code: false });
      state.blockComment = true;
      i += 2;
      continue;
    }
    if (ch === '/' && next === '/') {
      flushPlain();
      spans.push({ text: line.slice(i), code: false });
      i = n;
      continue;
    }
    if (ch === '#' && opts.hashComment) {
      flushPlain();
      spans.push({ text: line.slice(i), code: false });
      i = n;
      continue;
    }
    if (ch === '-' && next === '-' && opts.dashComment) {
      flushPlain();
      spans.push({ text: line.slice(i), code: false });
      i = n;
      continue;
    }
    if (ch === '"' || ch === "'" || ch === '`') {
      flushPlain();
      const marker = ch.repeat(3);
      if (line.startsWith(marker, i)) {
        state.triple = marker;
        spans.push({ text: marker, code: false });
        i += 3;
        continue;
      }
      // 同一行内查找闭合引号；找不到则视为字符字面量 / 生命周期标记（Rust `'a`）
      let j = i + 1;
      let closed = false;
      while (j < n) {
        if (line[j] === '\\') {
          j += 2;
          continue;
        }
        if (line[j] === ch) {
          closed = true;
          break;
        }
        if (ch === "'" && (line[j] === '\n' || line[j] === ';')) break;
        j += 1;
      }
      if (closed) {
        spans.push({ text: line.slice(i, j + 1), code: false });
        i = j + 1;
      } else {
        // 单字符字面量或生命周期：吞掉 1~2 个字符，不参与结构判断
        const width = next === '\\' ? 3 : 2;
        spans.push({ text: line.slice(i, i + width), code: false });
        i += width;
      }
      continue;
    }
    if (OPENERS.includes(ch)) {
      plain += ch;
      delta += 1;
      hasCode = true;
      leading = false;
      i += 1;
      continue;
    }
    if (isCloser(ch)) {
      plain += ch;
      delta -= 1;
      hasCode = true;
      if (leading) leadingClosers += 1;
      i += 1;
      continue;
    }
    if (!/\s/.test(ch)) {
      leading = false;
      codeEnd = i + 1;
    }
    if (!/\s/.test(ch)) hasCode = true;
    plain += ch;
    i += 1;
  }
  flushPlain();

  const codePart = line.slice(0, codeEnd);
  return {
    spans,
    endsWithColon: codePart.trimEnd().endsWith(':'),
    delta,
    leadingClosers,
    hasCode,
  };
}

/** 保守的空格整理：仅作用于代码片段（字符串 / 注释已排除） */
function tidyCode(text: string): string {
  let out = text;
  out = out.replace(/\s+([,;)\]}])/g, '$1');
  out = out.replace(/([,;])(?=\S)/g, '$1 ');
  out = out.replace(/\s*(===|!==|==|!=|<=|>=|=>|->|&&|\|\|)\s*/g, ' $1 ');
  out = out.replace(/(?<![=!<>+\-*/%&|^~])=(?!=)/g, ' = ');
  out = out.replace(/ {2,}/g, ' ');
  return out;
}

function lineIndentWidth(line: string, tabWidth: number): number {
  let width = 0;
  for (const ch of line) {
    if (ch === ' ') width += 1;
    else if (ch === '\t') width += Math.max(1, tabWidth);
    else break;
  }
  return width;
}

/**
 * 轻量格式化：重排缩进 + 清理空白。
 * 输入为空返回 EMPTY；任何异常都被捕获为 FORMAT_FAILED（core 层不抛异常）。
 */
export function formatFallback(code: string, options: FallbackOptions): ToolResult<string> {
  if (!code.trim()) return { ok: false, error: 'EMPTY' };
  try {
    const opts: FallbackOptions = { mode: 'brackets', ...options };
    const unit = opts.indentUnit || '  ';
    const tabWidth = unit.startsWith('\t') ? 2 : unit.length;
    const text = code.replace(/^\uFEFF/, '').replace(/\r\n?/g, '\n');
    const lines = text.split('\n');
    const state: ScanState = { blockComment: false, triple: null };

    const out: string[] = [];
    let depth = 0;
    let blankRun = 0;
    /** indent 模式的缩进层级栈（原始缩进宽度） */
    const levels: number[] = [0];
    let prevEndsWithColon = false;

    for (const raw of lines) {
      const line = raw.replace(/\s+$/, '');
      if (!line.trim()) {
        blankRun += 1;
        if (blankRun <= 1 && out.length > 0) out.push('');
        continue;
      }
      blankRun = 0;

      const scan = scanLine(line, state, opts);
      const content = scan.spans
        .map((span) => (span.code ? tidyCode(span.text) : span.text))
        .join('');
      // 注释 / 字符串开头的行保留原有对齐（块注释内的缩进等），代码行去掉前导空白
      const keepLeading = scan.spans.length > 0 && !scan.spans[0].code;
      const body = keepLeading ? content : content.replace(/^\s+/, '');

      let level: number;
      if (opts.mode === 'indent') {
        const width = lineIndentWidth(raw, tabWidth);
        while (levels.length > 1 && width < levels[levels.length - 1]) levels.pop();
        if (width > levels[levels.length - 1] && (prevEndsWithColon || levels.length === 1)) {
          levels.push(width);
        }
        // 括号未闭合 → 续行挂靠缩进
        level = levels.length - 1 + (depth > 0 ? 1 : 0);
      } else {
        level = Math.max(0, depth - scan.leadingClosers);
      }

      out.push(body ? unit.repeat(level) + body : '');

      depth = Math.max(0, depth + scan.delta);
      prevEndsWithColon = scan.endsWithColon;
    }

    return {
      ok: true,
      value: out
        .join('\n')
        .replace(/\n{3,}/g, '\n\n')
        .trimEnd(),
    };
  } catch {
    return { ok: false, error: 'FORMAT_FAILED' };
  }
}
