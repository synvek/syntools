/**
 * Markdown 编辑辅助：围绕选区包裹 / 行前缀插入，供工具栏与快捷键复用。
 */

export interface EditorSelection {
  text: string;
  selectionStart: number;
  selectionEnd: number;
}

export type MarkdownAction =
  | 'bold'
  | 'italic'
  | 'strike'
  | 'h1'
  | 'h2'
  | 'h3'
  | 'h4'
  | 'h5'
  | 'h6'
  | 'quote'
  | 'code'
  | 'codeBlock'
  | 'link'
  | 'image'
  | 'ul'
  | 'ol'
  | 'hr'
  | 'table';

function wrap(
  text: string,
  start: number,
  end: number,
  before: string,
  after: string,
  placeholder = '',
): EditorSelection {
  const selected = text.slice(start, end);
  const body = selected || placeholder;
  const next = text.slice(0, start) + before + body + after + text.slice(end);
  return {
    text: next,
    selectionStart: start + before.length,
    selectionEnd: start + before.length + body.length,
  };
}

function prefixLines(
  text: string,
  start: number,
  end: number,
  prefixFor: (lineIndex: number, line: string) => string,
): EditorSelection {
  let lineStart = start;
  while (lineStart > 0 && text[lineStart - 1] !== '\n') lineStart--;
  let lineEnd = end;
  while (lineEnd < text.length && text[lineEnd] !== '\n') lineEnd++;

  const block = text.slice(lineStart, lineEnd);
  const lines = block.length === 0 ? [''] : block.split('\n');
  const rewritten = lines.map((line, i) => prefixFor(i, line)).join('\n');
  const next = text.slice(0, lineStart) + rewritten + text.slice(lineEnd);
  return {
    text: next,
    selectionStart: lineStart,
    selectionEnd: lineStart + rewritten.length,
  };
}

function setHeading(text: string, start: number, end: number, level: number): EditorSelection {
  const hashes = '#'.repeat(Math.min(6, Math.max(1, level)));
  return prefixLines(text, start, end, (_, line) => {
    const stripped = line.replace(/^#{1,6}\s+/, '');
    return `${hashes} ${stripped}`;
  });
}

/** 对选区应用 Markdown 语法动作，返回新文本与建议选区 */
export function applyMarkdownAction(
  text: string,
  selectionStart: number,
  selectionEnd: number,
  action: MarkdownAction,
): EditorSelection {
  const start = Math.max(0, Math.min(selectionStart, text.length));
  const end = Math.max(start, Math.min(selectionEnd, text.length));

  switch (action) {
    case 'bold':
      return wrap(text, start, end, '**', '**', 'bold');
    case 'italic':
      return wrap(text, start, end, '*', '*', 'italic');
    case 'strike':
      return wrap(text, start, end, '~~', '~~', 'text');
    case 'code':
      return wrap(text, start, end, '`', '`', 'code');
    case 'codeBlock':
      return wrap(text, start, end, '```\n', '\n```', 'code');
    case 'link': {
      const selected = text.slice(start, end) || 'link';
      const next = `${text.slice(0, start)}[${selected}](https://)${text.slice(end)}`;
      const urlStart = start + selected.length + 3;
      return { text: next, selectionStart: urlStart, selectionEnd: urlStart + 'https://'.length };
    }
    case 'image': {
      const selected = text.slice(start, end) || 'alt';
      const next = `${text.slice(0, start)}![${selected}](https://)${text.slice(end)}`;
      const urlStart = start + selected.length + 4;
      return { text: next, selectionStart: urlStart, selectionEnd: urlStart + 'https://'.length };
    }
    case 'h1':
      return setHeading(text, start, end, 1);
    case 'h2':
      return setHeading(text, start, end, 2);
    case 'h3':
      return setHeading(text, start, end, 3);
    case 'h4':
      return setHeading(text, start, end, 4);
    case 'h5':
      return setHeading(text, start, end, 5);
    case 'h6':
      return setHeading(text, start, end, 6);
    case 'quote':
      return prefixLines(text, start, end, (_, line) =>
        line.startsWith('> ') ? line : `> ${line}`,
      );
    case 'ul':
      return prefixLines(text, start, end, (_, line) => {
        const stripped = line.replace(/^(\s*)([-*+]|\d+\.)\s+/, '$1');
        return `- ${stripped}`;
      });
    case 'ol':
      return prefixLines(text, start, end, (i, line) => {
        const stripped = line.replace(/^(\s*)([-*+]|\d+\.)\s+/, '$1');
        return `${i + 1}. ${stripped}`;
      });
    case 'hr': {
      const needsLeading = start > 0 && text[start - 1] !== '\n';
      const needsTrailing = end < text.length && text[end] !== '\n';
      const insert = `${needsLeading ? '\n' : ''}\n---\n${needsTrailing ? '\n' : ''}`;
      const next = text.slice(0, start) + insert + text.slice(end);
      const caret = start + insert.length;
      return { text: next, selectionStart: caret, selectionEnd: caret };
    }
    case 'table': {
      const table = '| Column 1 | Column 2 |\n| -------- | -------- |\n| Cell     | Cell     |\n';
      const needsLeading = start > 0 && text[start - 1] !== '\n';
      const insert = `${needsLeading ? '\n\n' : ''}${table}`;
      const next = text.slice(0, start) + insert + text.slice(end);
      const caret = start + insert.length;
      return { text: next, selectionStart: caret, selectionEnd: caret };
    }
    default:
      return { text, selectionStart: start, selectionEnd: end };
  }
}

/** CodeJar 实例上需要的最小接口（避免把编辑器实现泄漏到工具栏） */
export interface MarkdownJarLike {
  toString: () => string;
  save: () => { start: number; end: number; dir?: '->' | '<-' };
  restore: (pos: { start: number; end: number; dir?: '->' | '<-' }) => void;
  updateCode: (code: string, callOnUpdate?: boolean) => void;
  recordHistory: () => void;
}

/** 在 CodeJar 上应用 Markdown 动作并精确恢复选区 */
export function runMarkdownAction(jar: MarkdownJarLike, action: MarkdownAction): boolean {
  const pos = jar.save();
  const result = applyMarkdownAction(jar.toString(), pos.start, pos.end, action);
  jar.updateCode(result.text);
  jar.restore({ start: result.selectionStart, end: result.selectionEnd, dir: '->' });
  jar.recordHistory();
  return true;
}
