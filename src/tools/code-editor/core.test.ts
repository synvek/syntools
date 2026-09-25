import { describe, expect, it } from 'vitest';
import {
  buildExportFilename,
  buildSnippet,
  buildStandaloneHtml,
  checkImportFile,
  countStats,
  detectLanguageByExt,
  getLangSpec,
  isLangId,
  MAX_IMPORT_BYTES,
  sanitizeFilename,
} from './core';
import { formatFallback } from './fallback';
import { CODE_THEMES, getTheme, isThemeId, themeCssVars, themeStyleBlock } from './themes';

describe('语言表', () => {
  it('识别 Java / Rust 等常见语言', () => {
    expect(getLangSpec('java').ext).toBe('.java');
    expect(getLangSpec('rust').ext).toBe('.rs');
    expect(getLangSpec('java').format).toBe('prettier');
    expect(getLangSpec('rust').format).toBe('fallback');
    expect(isLangId('kotlin')).toBe(true);
    expect(isLangId('brainfuck')).toBe(false);
  });

  it('按扩展名反查语言，未知扩展名返回 null', () => {
    expect(detectLanguageByExt('Main.java')).toBe('java');
    expect(detectLanguageByExt('lib.rs')).toBe('rust');
    expect(detectLanguageByExt('Dockerfile')).toBeNull();
  });
});

describe('导出文件名', () => {
  it('清洗非法字符并补扩展名', () => {
    expect(sanitizeFilename('  my file  ')).toBe('my file');
    expect(sanitizeFilename('../../etc/passwd')).toBe('etcpasswd');
    expect(sanitizeFilename('')).toBe('snippet');
    expect(buildExportFilename('Demo', getLangSpec('java'))).toBe('Demo.java');
    expect(buildExportFilename('demo.java', getLangSpec('java'))).toBe('demo.java');
    expect(buildExportFilename('', getLangSpec('rust'))).toBe('snippet.rs');
  });
});

describe('统计与校验', () => {
  it('统计字符 / 行数 / 字节', () => {
    expect(countStats('a\n你')).toEqual({ chars: 3, lines: 2, bytes: 5 });
    expect(countStats('')).toEqual({ chars: 0, lines: 0, bytes: 0 });
  });

  it('超 10MB 的导入文件被拒绝', () => {
    expect(checkImportFile({ name: 'a.java', size: 1024 })).toEqual({ ok: true, value: 'a.java' });
    const result = checkImportFile({ name: 'big.java', size: MAX_IMPORT_BYTES + 1 });
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error).toBe('TOO_LARGE');
  });
});

describe('导出内容', () => {
  it('独立 HTML 内嵌主题样式与高亮片段', () => {
    const html = buildStandaloneHtml(
      '<span class="token keyword">class</span>',
      getLangSpec('java'),
      themeStyleBlock(getTheme('dracula')),
      'Demo',
    );
    expect(html).toContain('<!doctype html>');
    expect(html).toContain('<title>Demo</title>');
    expect(html).toContain('language-java');
    expect(html).toContain('#ff79c6');
    expect(html).toContain('<span class="token keyword">class</span>');
  });

  it('标题中的尖括号被转义', () => {
    const html = buildStandaloneHtml('x', getLangSpec('java'), '.token{}', '<script>');
    expect(html).not.toContain('<script>');
    expect(html).toContain('&lt;script&gt;');
  });

  it('复制片段带语言 class', () => {
    expect(buildSnippet('x', getLangSpec('rust'))).toBe(
      '<pre class="language-rust"><code class="language-rust">x</code></pre>',
    );
    expect(buildSnippet('x', getLangSpec('plaintext'))).toContain('language-text');
  });
});

describe('主题', () => {
  it('提供 10 套深浅各半的风格', () => {
    expect(CODE_THEMES).toHaveLength(10);
    const dark = CODE_THEMES.filter((t) => t.mode === 'dark');
    expect(dark).toHaveLength(5);
    expect(CODE_THEMES.filter((t) => t.mode === 'light')).toHaveLength(5);
    expect(new Set(CODE_THEMES.map((t) => t.id)).size).toBe(10);
    // 深色主题背景必须足够暗，浅色主题背景足够亮，避免误配
    for (const t of CODE_THEMES) {
      const lum = parseInt(t.bg.slice(1, 3), 16);
      expect(t.mode === 'dark' ? lum < 0x60 : lum > 0xd0).toBe(true);
    }
  });

  it('未知主题回落默认，变量覆盖全部 token', () => {
    expect(isThemeId('dracula')).toBe(true);
    expect(getTheme('nope').id).toBe(CODE_THEMES[0].id);
    const vars = themeCssVars(getTheme('nord'));
    expect(vars['--ce-bg']).toBe('#2e3440');
    expect(vars['--ce-keyword']).toBe('#81a1c1');
  });
});

describe('formatFallback（内置格式化器）', () => {
  it('按括号重排 Rust 缩进', () => {
    const input = ['fn main() {', 'let s = "}";', 'if true {', 'println!("{}", s);', '}', '}'].join(
      '\n',
    );
    const result = formatFallback(input, { indentUnit: '  ' });
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.value).toBe(
      ['fn main() {', '  let s = "}";', '  if true {', '    println!("{}", s);', '  }', '}'].join(
        '\n',
      ),
    );
  });

  it('字符串与注释内的括号不参与缩进', () => {
    const input = ['// }}}', 'let a = "{(((";', 'let b = 1;'].join('\n');
    const result = formatFallback(input, { indentUnit: '  ' });
    expect(result.ok && result.value).toBe('// }}}\nlet a = "{(((";\nlet b = 1;');
  });

  it('块注释跨行不破坏后续缩进', () => {
    const input = ['/*', ' }', '*/', 'fn a() {', '}', ''].join('\n');
    const result = formatFallback(input, { indentUnit: '  ' });
    expect(result.ok && result.value).toBe('/*\n }\n*/\nfn a() {\n}');
  });

  it('Python 按缩进语义重排并归一化', () => {
    const input = ['def f(x):', '      if x:', '            return 1', '      return 0'].join('\n');
    const result = formatFallback(input, {
      indentUnit: '  ',
      mode: 'indent',
      hashComment: true,
    });
    expect(result.ok && result.value).toBe(
      ['def f(x):', '  if x:', '    return 1', '  return 0'].join('\n'),
    );
  });

  it('Python 的 else 与块同级', () => {
    const input = ['if a:', '  x = 1', 'else:', '  x = 2', 'y = 3'].join('\n');
    const result = formatFallback(input, {
      indentUnit: '  ',
      mode: 'indent',
      hashComment: true,
    });
    expect(result.ok && result.value).toBe(
      ['if a:', '  x = 1', 'else:', '  x = 2', 'y = 3'].join('\n'),
    );
  });

  it('折叠多余空行并清理行尾空白', () => {
    const input = 'fn a() {   \n\n\n\n  let b = 1;   \n}';
    const result = formatFallback(input, { indentUnit: '  ' });
    expect(result.ok && result.value).toBe('fn a() {\n\n  let b = 1;\n}');
  });

  it('整理逗号与运算符空格但不改动字符串内容', () => {
    const result = formatFallback('let a = f(1 ,2) ;', { indentUnit: '  ' });
    expect(result.ok && result.value).toBe('let a = f(1, 2);');
  });

  it('支持 Tab 缩进单元', () => {
    const result = formatFallback('fn a() {\nb();\n}', { indentUnit: '\t' });
    expect(result.ok && result.value).toBe('fn a() {\n\tb();\n}');
  });

  it('空输入返回 EMPTY 而非抛异常', () => {
    expect(formatFallback('   ', { indentUnit: '  ' })).toEqual({ ok: false, error: 'EMPTY' });
  });
});
