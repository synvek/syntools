import { describe, expect, it } from 'vitest';
import {
  MAX_EXPORT_HTML_BYTES,
  MAX_IMPORT_BYTES,
  buildExportFilename,
  checkExportSize,
  checkImportFile,
  computePageBreaks,
  countDocStats,
  createEmptyDocHtml,
  countPages,
  htmlToPlain,
  normalizeImportedDocHtml,
  pageIndexOfPosition,
  resolveImportKind,
  scanMarkdownExportLosses,
  sanitizeDocHtml,
  sanitizeFilename,
  textToDocHtml,
} from './core';

describe('resolveImportKind', () => {
  it('recognizes .docx case-insensitively', () => {
    expect(resolveImportKind('报告.DOCX')).toBe('docx');
    expect(resolveImportKind(' spec.docx ')).toBe('docx');
  });

  it('classifies legacy binary files as legacy-doc', () => {
    expect(resolveImportKind('旧文档.doc')).toBe('legacy-doc');
    expect(resolveImportKind('notes.wps')).toBe('legacy-doc');
    expect(resolveImportKind('note.rtf')).toBe('legacy-doc');
  });

  it('recognizes the local text formats (P0-3)', () => {
    expect(resolveImportKind('note.TXT')).toBe('txt');
    expect(resolveImportKind('readme.md')).toBe('md');
    expect(resolveImportKind('readme.markdown')).toBe('md');
    expect(resolveImportKind('page.html')).toBe('html');
    expect(resolveImportKind('page.htm')).toBe('html');
  });

  it('rejects other extensions', () => {
    expect(resolveImportKind('a.pdf')).toBe('unsupported');
    expect(resolveImportKind('a.xlsx')).toBe('unsupported');
  });
});

describe('checkImportFile', () => {
  it('accepts a valid .docx', () => {
    expect(checkImportFile({ name: 'a.docx', size: 1024 })).toEqual({ ok: true, value: 'docx' });
  });

  it('returns a specific error code for legacy .doc', () => {
    expect(checkImportFile({ name: 'a.doc', size: 1024 })).toEqual({
      ok: false,
      error: 'UNSUPPORTED_LEGACY_DOC',
    });
  });

  it('rejects non-docx files', () => {
    expect(checkImportFile({ name: 'a.pdf', size: 1024 })).toEqual({
      ok: false,
      error: 'NOT_DOCX',
    });
  });

  it('returns TOO_LARGE for oversized files', () => {
    const result = checkImportFile({ name: 'a.docx', size: MAX_IMPORT_BYTES + 1 });
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error).toBe('TOO_LARGE');
  });

  it('accepts text formats and applies the same size ceiling (P0-3)', () => {
    for (const [name, kind] of [
      ['note.txt', 'txt'],
      ['readme.md', 'md'],
      ['page.html', 'html'],
    ] as const) {
      expect(checkImportFile({ name, size: 1024 })).toEqual({ ok: true, value: kind });
      const oversized = checkImportFile({ name, size: MAX_IMPORT_BYTES + 1 });
      expect(oversized.ok).toBe(false);
      if (!oversized.ok) expect(oversized.error).toBe('TOO_LARGE');
    }
  });
});

describe('textToDocHtml (P0-3)', () => {
  it('turns plain text into paragraphs and keeps line breaks', () => {
    const result = textToDocHtml('第一行\n第二行\n\n第四行', 'txt');
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.value).toContain('<p>第一行</p>');
    expect(result.value).toContain('<p>第二行</p>');
    expect(result.value).toContain('<p><br></p>');
  });

  it('escapes raw markup in a .txt file', () => {
    const result = textToDocHtml('<script>alert(1)</script>&done', 'txt');
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.value).not.toContain('<script');
    expect(result.value).toContain('&lt;script&gt;');
  });

  it('converts Markdown headings, lists and inline styles', () => {
    const result = textToDocHtml('# 标题\n\n- 甲\n- 乙\n\n正文 **粗体**', 'md');
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.value).toContain('<h1>标题</h1>');
    expect(result.value).toContain('<ul><li>甲</li><li>乙</li></ul>');
    expect(result.value).toContain('<strong>粗体</strong>');
  });

  it('sanitizes HTML imports and blocks javascript: links', () => {
    const result = textToDocHtml(
      '<p onclick="alert(1)">正文</p><script>alert(2)</script><a href="javascript:alert(3)">链接</a>',
      'html',
    );
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.value).toContain('正文');
    expect(result.value).not.toContain('<script');
    expect(result.value).not.toContain('onclick');
    expect(result.value).not.toContain('javascript:');
  });

  it('rejects empty input', () => {
    expect(textToDocHtml('   \n ', 'txt')).toEqual({ ok: false, error: 'EMPTY' });
  });
});

describe('buildExportFilename', () => {
  it('builds a .txt filename (P0-3)', () => {
    expect(buildExportFilename('季度 汇总', 'txt')).toBe('季度 汇总.txt');
  });
});

describe('checkExportSize', () => {
  it('blocks exporting an empty document', () => {
    expect(checkExportSize('<p></p>')).toEqual({ ok: false, error: 'EMPTY' });
    expect(checkExportSize('   ')).toEqual({ ok: false, error: 'EMPTY' });
  });

  it('blocks exporting beyond the limit', () => {
    const oversized = `<p>${'a'.repeat(MAX_EXPORT_HTML_BYTES + 1)}</p>`;
    const result = checkExportSize(oversized);
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error).toBe('TOO_LARGE');
  });

  it('passes for a normal document', () => {
    expect(checkExportSize('<p>hello</p>')).toEqual({ ok: true, value: true });
  });
});

describe('sanitizeDocHtml', () => {
  it('strips scripts and event attributes', () => {
    const dirty = '<p onclick="alert(1)">你好</p><script>alert(2)</script>';
    const result = sanitizeDocHtml(dirty);
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.value).not.toContain('script');
    expect(result.value).not.toContain('onclick');
    expect(result.value).toContain('你好');
  });

  it('returns EMPTY for empty content', () => {
    expect(sanitizeDocHtml('  ')).toEqual({ ok: false, error: 'EMPTY' });
  });
});

describe('normalizeImportedDocHtml', () => {
  it('wraps loose inline content inside blockquote in a paragraph', () => {
    expect(normalizeImportedDocHtml('<blockquote>Quoted</blockquote>')).toContain(
      '<blockquote><p>Quoted</p></blockquote>',
    );
  });

  it('leaves a blockquote that already has block children untouched', () => {
    const html = '<blockquote><p>Quoted</p></blockquote>';
    expect(normalizeImportedDocHtml(html)).toBe(html);
  });

  it('does not add an empty paragraph to an empty blockquote', () => {
    const html = '<blockquote></blockquote>';
    expect(normalizeImportedDocHtml(html)).toBe(html);
  });
});

describe('htmlToPlain and countDocStats', () => {
  it('turns block elements into line breaks and keeps CJK text', () => {
    const plain = htmlToPlain('<h1>标题</h1><p>第一段</p><p>第二段</p>');
    expect(plain).toBe('标题\n第一段\n第二段');
  });

  it('counts words and paragraphs in mixed Chinese/English text', () => {
    const stats = countDocStats('你好世界 hello world');
    expect(stats.chars).toBe(16);
    expect(stats.charsNoSpace).toBe(14);
    expect(stats.words).toBe(6);
  });

  it('counts paragraphs as non-empty lines', () => {
    const plain = htmlToPlain('<p>a</p><ul><li>b</li><li>c</li></ul>');
    const stats = countDocStats(plain);
    expect(stats.paragraphs).toBe(3);
    expect(stats.words).toBe(3);
  });

  it('reports zero stats for an empty document', () => {
    expect(countDocStats('')).toEqual({ chars: 0, charsNoSpace: 0, words: 0, paragraphs: 0 });
  });
});

describe('filename handling', () => {
  it('filters illegal characters and caps the length', () => {
    expect(sanitizeFilename('report/2024:q1?')).toBe('report2024q1');
    expect(sanitizeFilename('')).toBe('document');
    expect(sanitizeFilename('a'.repeat(100)).length).toBe(60);
  });

  it('builds an export filename with the extension', () => {
    expect(buildExportFilename('年度报告', 'docx')).toBe('年度报告.docx');
    expect(buildExportFilename('', 'pdf')).toBe('document.pdf');
  });
});

describe('computePageBreaks', () => {
  it('produces no break when everything fits on one page', () => {
    expect(
      computePageBreaks(
        [
          { top: 0, height: 50 },
          { top: 50, height: 60 },
        ],
        200,
      ),
    ).toEqual([]);
  });

  it('moves a page-spanning block entirely to the next page', () => {
    const cuts = computePageBreaks(
      [
        { top: 0, height: 100 },
        { top: 100, height: 100 },
        { top: 200, height: 100 },
      ],
      150,
    );
    expect(cuts).toEqual([100, 200]);
  });

  it('allows overflow when a block is taller than a page, without looping forever', () => {
    const cuts = computePageBreaks([{ top: 0, height: 500 }], 200);
    expect(cuts).toEqual([500]);
  });

  it('returns an empty array for an invalid page height', () => {
    expect(computePageBreaks([{ top: 0, height: 10 }], 0)).toEqual([]);
  });
});

describe('createEmptyDocHtml', () => {
  it('returns empty paragraph HTML', () => {
    expect(createEmptyDocHtml()).toBe('<p></p>');
  });
});

describe('pageIndexOfPosition / countPages', () => {
  it('puts everything on page 1 when unpaginated', () => {
    expect(pageIndexOfPosition([], 0)).toBe(1);
    expect(pageIndexOfPosition([], 5000)).toBe(1);
    expect(countPages([])).toBe(1);
  });

  it('finds the page number by binary search over page starts', () => {
    const starts = [100, 250, 900];
    expect(pageIndexOfPosition(starts, 0)).toBe(1);
    expect(pageIndexOfPosition(starts, 99)).toBe(1);
    // A break point itself belongs to the new page
    expect(pageIndexOfPosition(starts, 100)).toBe(2);
    expect(pageIndexOfPosition(starts, 249)).toBe(2);
    expect(pageIndexOfPosition(starts, 250)).toBe(3);
    expect(pageIndexOfPosition(starts, 100000)).toBe(4);
    expect(countPages(starts)).toBe(4);
  });

  it('stays correct and logarithmic with many page breaks', () => {
    // Page starts exist from page 2 on (page 1 starts at the document head and is not in the array)
    const starts = Array.from({ length: 500 }, (_, index) => (index + 1) * 100);
    expect(pageIndexOfPosition(starts, 0)).toBe(1);
    expect(pageIndexOfPosition(starts, 99)).toBe(1);
    expect(pageIndexOfPosition(starts, 100)).toBe(2);
    expect(pageIndexOfPosition(starts, 49900)).toBe(500);
    expect(pageIndexOfPosition(starts, 50000)).toBe(501);
    expect(countPages(starts)).toBe(501);
  });
});

describe('scanMarkdownExportLosses', () => {
  it('counts comments / revisions / paragraph layout / floating images', () => {
    const html = [
      '<p style="text-indent: 24px"><span data-comment-id="c-1">批注</span></p>',
      '<p><ins data-track="insert">新增</ins><del data-track="delete">删除</del></p>',
      '<p style="margin-top: 12px">间距</p>',
      '<img src="data:image/png;base64,iVBORw0KGgo=" data-layer="front">',
    ].join('');
    const result = scanMarkdownExportLosses(html);
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.value.comments).toBe(1);
    expect(result.value.trackedChanges).toBe(2);
    expect(result.value.paragraphSpacing).toBe(2);
    expect(result.value.floatingImages).toBe(1);
  });

  it('does not treat inline images as floating overhead', () => {
    const result = scanMarkdownExportLosses('<img src="x.png" data-layer="inline">');
    expect(result.ok && result.value.floatingImages).toBe(0);
  });

  it('ignores default page setup and only counts non-default settings', () => {
    const defaults = scanMarkdownExportLosses('<p>x</p>');
    expect(defaults.ok && defaults.value.pageSetupFields).toBe(0);
    const custom = scanMarkdownExportLosses('<p>x</p>', {
      header: '内部资料',
      footer: '第 1 页',
      margin: { top: 12.7, right: 12.7, bottom: 12.7, left: 12.7 },
    });
    expect(custom.ok && custom.value.pageSetupFields).toBe(3);
  });
});
