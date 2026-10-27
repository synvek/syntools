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
  pageIndexOfPosition,
  resolveImportKind,
  scanMarkdownExportLosses,
  sanitizeDocHtml,
  sanitizeFilename,
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

  it('rejects other extensions', () => {
    expect(resolveImportKind('a.txt')).toBe('unsupported');
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
