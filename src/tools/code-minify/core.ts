import type { ToolResult } from '@/core/types';

export type MinifyLang = 'css' | 'html' | 'js' | 'json';

export const MINIFY_LANGS: { value: MinifyLang; label: string }[] = [
  { value: 'css', label: 'CSS' },
  { value: 'html', label: 'HTML' },
  { value: 'js', label: 'JavaScript' },
  { value: 'json', label: 'JSON' },
];

/**
 * Strip JS comments while correctly skipping strings, template literals, regex literals, and comments.
 * Conservative by design: newlines are preserved so automatic semicolon insertion (ASI) semantics never change.
 */
export function stripJsComments(code: string): string {
  let out = '';
  let i = 0;
  const n = code.length;
  // Last significant character, used to tell a division sign from the start of a regex literal
  let prev = '';
  const regexAllowed = () => prev === '' || /[([{,;:=!&|?+\-*%^~<>]/.test(prev);

  while (i < n) {
    const c = code[i];

    // Strings and template literals
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

    // Line comment
    if (c === '/' && code[i + 1] === '/') {
      i += 2;
      while (i < n && code[i] !== '\n') i += 1;
      continue;
    }
    // Block comment
    if (c === '/' && code[i + 1] === '*') {
      i += 2;
      while (i < n && !(code[i] === '*' && code[i + 1] === '/')) i += 1;
      i += 2;
      continue;
    }
    // Regex literal
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
  // Cleanup: removing a comment can leave trailing whitespace behind
  return out.replace(/[ \t]+$/gm, '');
}

/** Collapse horizontal whitespace (keeping newlines) and merge redundant blank lines. */
function collapseSpaces(code: string): string {
  return code
    .replace(/[ \t]+/g, ' ')
    .replace(/ *\n */g, '\n')
    .replace(/\n{2,}/g, '\n')
    .trim();
}

/** Conservative HTML minification: drop comments, whitespace between tags, and redundant spaces (leaves <pre>/<textarea> content alone). */
export function minifyHtml(code: string): string {
  return collapseSpaces(
    code
      .replace(/<!--[\s\S]*?-->/g, '')
      .replace(/>\s+</g, '><')
      .replace(/\s{2,}/g, ' '),
  );
}

/** JS minification: strip comments and collapse whitespace (newlines kept; safety first). */
export function minifyJs(code: string): string {
  return collapseSpaces(stripJsComments(code));
}

/** Minify code by language. CSS uses csso, JSON uses JSON.stringify, HTML/JS use conservative implementations. */
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
