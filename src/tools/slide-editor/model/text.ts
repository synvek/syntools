import type { Paragraph, RunStyle, TextAlign, TextBody, TextRun } from './types';

/**
 * 富文本纯逻辑层：把 TextBody 展平成「字符 + 样式 + 所属段落」的序列来操作。
 *
 * 之所以需要这一层：行内编辑用的是一个纯文本 textarea，编辑结束后必须把
 * 新文本映射回 run 级模型。早期实现直接「按行重建段落 + 每段套用首个 run 的样式」，
 * 导致两个真实缺陷：
 *   1. 段落内混排样式（如部分加粗）被抹平；
 *   2. spaceBefore / spaceAfter / indent 等段落属性被丢弃。
 * 这里改为「公共前缀 / 公共后缀 diff + 按字符继承样式」，只重算真正被改动的那一段。
 */

/** 展平后的单个字符。`paragraph === -1` 表示段落分隔符（\n） */
export interface FlatChar {
  paragraph: number;
  text: string;
  style?: RunStyle;
}

/** TextBody → 字符序列（段落间插入 -1 分隔项） */
export function flattenBody(body: TextBody): FlatChar[] {
  const chars: FlatChar[] = [];
  body.paragraphs.forEach((paragraph, index) => {
    if (index > 0) chars.push({ paragraph: -1, text: '\n' });
    for (const run of paragraph.runs) {
      // 按码点拆分，避免把 emoji / 代理对切坏
      for (const text of Array.from(run.text)) {
        chars.push({ paragraph: index, text, style: run.style });
      }
    }
  });
  return chars;
}

/** TextBody → 纯文本（与 textarea 内容一一对应） */
export function bodyToText(body: TextBody): string {
  return flattenBody(body)
    .map((char) => char.text)
    .join('');
}

function styleEquals(a: RunStyle | undefined, b: RunStyle | undefined): boolean {
  if (a === b) return true;
  if (!a || !b) return false;
  const keys = new Set([...Object.keys(a), ...Object.keys(b)]);
  for (const key of keys) {
    if ((a as Record<string, unknown>)[key] !== (b as Record<string, unknown>)[key]) return false;
  }
  return true;
}

/** 取某一段落的段落级属性（不含 runs） */
function paragraphProps(source: TextBody, origin: number): Omit<Paragraph, 'runs'> {
  const picked = source.paragraphs[origin] ?? source.paragraphs[0];
  if (!picked) return {};
  const { runs: _runs, ...rest } = picked;
  void _runs;
  return rest;
}

/** 字符序列 → TextBody：相邻同样式字符合并为一个 run，段落属性按首字符来源段落继承 */
export function rebuildBody(chars: FlatChar[], source: TextBody): TextBody {
  const paragraphs: Paragraph[] = [];
  let origin = 0;
  let runs: TextRun[] = [];

  const flush = () => {
    paragraphs.push({ ...paragraphProps(source, origin), runs });
    runs = [];
  };

  for (const char of chars) {
    if (char.paragraph === -1) {
      flush();
      continue;
    }
    if (runs.length === 0) origin = char.paragraph;
    const last = runs[runs.length - 1];
    if (last && styleEquals(last.style, char.style)) {
      last.text += char.text;
    } else {
      runs.push({ text: char.text, style: char.style });
    }
  }
  flush();

  // 全空文档也要保留一个空段落，否则模型与渲染都会缺少落点
  if (paragraphs.length === 0)
    paragraphs.push({ ...paragraphProps(source, 0), runs: [{ text: '' }] });
  return { ...source, paragraphs };
}

/** 查询选区内是否「全部」具备某样式，用于工具栏三态回显 */
export function queryStyleRange(body: TextBody, start: number, end: number): RunStyle {
  const chars = flattenBody(body);
  const slice = chars.slice(Math.max(0, start), Math.min(end, chars.length));
  const text = slice.filter((char) => char.paragraph >= 0);
  if (text.length === 0) return {};
  const flags: ('bold' | 'italic' | 'underline' | 'strike')[] = [
    'bold',
    'italic',
    'underline',
    'strike',
  ];
  const result: RunStyle = {};
  for (const flag of flags) {
    result[flag] = text.every((char) => Boolean(char.style?.[flag]));
  }
  return result;
}

/** 给选区 [start, end) 内的字符打样式补丁（会按需切分 run） */
export function applyStyleRange(
  body: TextBody,
  start: number,
  end: number,
  patch: Partial<RunStyle>,
): TextBody {
  if (end <= start) return body;
  const chars = flattenBody(body);
  const from = Math.max(0, start);
  const to = Math.min(end, chars.length);
  let touched = false;
  for (let i = from; i < to; i += 1) {
    const char = chars[i];
    if (char.paragraph < 0) continue;
    char.style = { ...(char.style ?? {}), ...patch };
    touched = true;
  }
  if (!touched) return body;
  return rebuildBody(chars, body);
}

/** 段落级属性（去掉 runs），供重建段落时复用 */
function propsOf(paragraph: Paragraph | undefined): Omit<Paragraph, 'runs'> {
  if (!paragraph) return {};
  const { runs: _runs, ...rest } = paragraph;
  void _runs;
  return rest;
}

/**
 * 单行内的文本 diff：把旧 run 序列映射到新文本，返回合并后的 run 序列。
 * 只重算「公共前缀之后、公共后缀之前」的区间，新字符继承被替换处首字符的样式
 * —— 与 PowerPoint 的「紧邻样式继承」行为一致。
 */
function diffLineToRuns(oldRuns: TextRun[], nextLine: string): TextRun[] {
  const oldChars: { text: string; style?: RunStyle }[] = [];
  for (const run of oldRuns) {
    for (const text of Array.from(run.text)) oldChars.push({ text, style: run.style });
  }
  const newChars = Array.from(nextLine);

  let prefix = 0;
  const maxPrefix = Math.min(oldChars.length, newChars.length);
  while (prefix < maxPrefix && oldChars[prefix].text === newChars[prefix]) prefix += 1;

  let suffix = 0;
  const maxSuffix = Math.min(oldChars.length - prefix, newChars.length - prefix);
  while (
    suffix < maxSuffix &&
    oldChars[oldChars.length - 1 - suffix].text === newChars[newChars.length - 1 - suffix]
  ) {
    suffix += 1;
  }

  // 继承「插入点前一个字符」的样式：与 PowerPoint 输入时的紧邻继承行为一致
  // （在末尾追加时即最后一个字符；整行为空时无样式可继承）
  const inherit = oldChars[Math.max(0, Math.min(prefix - 1, oldChars.length - 1))]?.style;
  const head = oldChars.slice(0, prefix);
  const tail = oldChars.slice(oldChars.length - suffix);
  const middle = newChars
    .slice(prefix, newChars.length - suffix)
    .map((text) => ({ text, style: inherit }));

  const runs: TextRun[] = [];
  for (const char of [...head, ...middle, ...tail]) {
    const last = runs[runs.length - 1];
    if (last && styleEquals(last.style, char.style)) last.text += char.text;
    else runs.push({ text: char.text, style: char.style });
  }
  return runs.length > 0 ? runs : [{ text: '', style: inherit }];
}

/**
 * 用编辑后的纯文本替换 TextBody 的文字内容，同时保留样式与段落属性。
 *
 * 段落属性按「行」映射：行数不变时逐行对应；行数变化时多出来的行继承末段属性。
 * 行内样式走 `diffLineToRuns` 的字符级 diff，只重算真正被改动的区间。
 */
export function replaceBodyText(body: TextBody, nextText: string): TextBody {
  const oldCount = body.paragraphs.length;
  const newLines = nextText.split('\n');
  const paragraphs: Paragraph[] = newLines.map((line, index) => {
    // 行数一致时逐行对齐，最大程度保留各段自己的属性
    const sourceIndex =
      newLines.length === oldCount ? index : Math.min(index, Math.max(0, oldCount - 1));
    const source = body.paragraphs[sourceIndex];
    return { ...propsOf(source), runs: diffLineToRuns(source?.runs ?? [], line) };
  });
  return { ...body, paragraphs };
}

/**
 * 等比缩放全部 run 的字号，用于模拟 PowerPoint 的 normAutofit
 * （自动调整文字大小以适应形状：缩字后重新排版，而不是把文字压扁）。
 */
export function scaleBodyFonts(body: TextBody, factor: number): TextBody {
  if (!Number.isFinite(factor) || factor <= 0 || factor === 1) return body;
  return {
    ...body,
    paragraphs: body.paragraphs.map((paragraph) => ({
      ...paragraph,
      runs: paragraph.runs.map((run) => ({
        ...run,
        style: {
          ...(run.style ?? {}),
          size: Math.max(4, (run.style?.size ?? 18) * factor),
        },
      })),
    })),
  };
}

/** 段落对齐：同时写回全部段落（与属性面板行为一致） */
export function setBodyAlign(body: TextBody, align: TextAlign): TextBody {
  return { ...body, paragraphs: body.paragraphs.map((paragraph) => ({ ...paragraph, align })) };
}
