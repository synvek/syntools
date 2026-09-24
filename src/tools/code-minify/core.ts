import type { ToolResult } from '@/core/types';

export type MinifyLang = 'css' | 'html' | 'js' | 'json';

export const MINIFY_LANGS: { value: MinifyLang; label: string }[] = [
  { value: 'css', label: 'CSS' },
  { value: 'html', label: 'HTML' },
  { value: 'js', label: 'JavaScript' },
  { value: 'json', label: 'JSON' },
];

/**
 * 移除 JS 注释：正确跳过字符串 / 模板字符串 / 正则字面量 / 注释。
 * 保守策略——保留换行，避免 ASI（自动分号插入）语义变化。
 */
export function stripJsComments(code: string): string {
  let out = '';
  let i = 0;
  const n = code.length;
  // 上一处有效字符，用于判断 '/' 是除号还是正则字面量起始
  let prev = '';
  const regexAllowed = () => prev === '' || /[([{,;:=!&|?+\-*%^~<>]/.test(prev);

  while (i < n) {
    const c = code[i];

    // 字符串 / 模板字符串
    if (c === '"' || c === "'" || c === '`') {
      const quote = c;
      out += c;
      i += 1;
      while (i < n) {
        const d = code[i];
        if (d === '\\') {
          out += d + (code[i + 1] ?? '');
          i += 2;
          continue;
        }
        out += d;
        i += 1;
        if (d === quote) break;
      }
      prev = quote;
      continue;
    }

    // 行注释
    if (c === '/' && code[i + 1] === '/') {
      i += 2;
      while (i < n && code[i] !== '\n') i += 1;
      continue;
    }
    // 块注释
    if (c === '/' && code[i + 1] === '*') {
      i += 2;
      while (i < n && !(code[i] === '*' && code[i + 1] === '/')) i += 1;
      i += 2;
      continue;
    }
    // 正则字面量
    if (c === '/' && regexAllowed()) {
      out += c;
      i += 1;
      let inClass = false;
      while (i < n) {
        const d = code[i];
        if (d === '\\') {
          out += d + (code[i + 1] ?? '');
          i += 2;
          continue;
        }
        out += d;
        i += 1;
        if (d === '[') inClass = true;
        else if (d === ']') inClass = false;
        else if (d === '/' && !inClass) break;
      }
      while (i < n && /[a-z]/i.test(code[i])) {
        out += code[i];
        i += 1;
      }
      prev = '/';
      continue;
    }

    out += c;
    if (!/\s/.test(c)) prev = c;
    i += 1;
  }
  // 收尾：删除注释后可能残留的行尾空白
  return out.replace(/[ \t]+$/gm, '');
}

/** 压缩水平空白（保留换行），并合并多余空行。 */
function collapseSpaces(code: string): string {
  return code
    .replace(/[ \t]+/g, ' ')
    .replace(/ *\n */g, '\n')
    .replace(/\n{2,}/g, '\n')
    .trim();
}

/** 保守的 HTML 压缩：移除注释、标签间空白与多余空格（不处理 <pre>/<textarea> 内容）。 */
export function minifyHtml(code: string): string {
  return collapseSpaces(
    code
      .replace(/<!--[\s\S]*?-->/g, '')
      .replace(/>\s+</g, '><')
      .replace(/\s{2,}/g, ' '),
  );
}

/** JS 压缩：移除注释 + 压缩空白（保留换行，安全优先）。 */
export function minifyJs(code: string): string {
  return collapseSpaces(stripJsComments(code));
}

/** 按语言压缩代码。CSS 走 csso，JSON 走 JSON.stringify，HTML/JS 为保守实现。 */
export async function minifyCode(lang: MinifyLang, code: string): Promise<ToolResult<string>> {
  if (!code.trim()) return { ok: false, error: 'EMPTY' };

  if (lang === 'json') {
    try {
      return { ok: true, value: JSON.stringify(JSON.parse(code)) };
    } catch {
      return { ok: false, error: 'INVALID_JSON' };
    }
  }

  if (lang === 'css') {
    try {
      const { minify } = await import('csso');
      const result = minify(code);
      return { ok: true, value: result.css };
    } catch {
      return { ok: false, error: 'MINIFY_FAILED' };
    }
  }

  if (lang === 'html') return { ok: true, value: minifyHtml(code) };
  return { ok: true, value: minifyJs(code) };
}
