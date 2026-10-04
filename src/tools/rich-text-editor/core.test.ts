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
  it('识别 .docx（忽略大小写）', () => {
    expect(resolveImportKind('报告.DOCX')).toBe('docx');
    expect(resolveImportKind(' spec.docx ')).toBe('docx');
  });

  it('旧版二进制格式归为 legacy-doc', () => {
    expect(resolveImportKind('旧文档.doc')).toBe('legacy-doc');
    expect(resolveImportKind('notes.wps')).toBe('legacy-doc');
    expect(resolveImportKind('note.rtf')).toBe('legacy-doc');
  });

  it('其它扩展名不支持', () => {
    expect(resolveImportKind('a.txt')).toBe('unsupported');
  });
});

describe('checkImportFile', () => {
  it('合法的 .docx 通过校验', () => {
    expect(checkImportFile({ name: 'a.docx', size: 1024 })).toEqual({ ok: true, value: 'docx' });
  });

  it('旧版 .doc 给出明确错误码', () => {
    expect(checkImportFile({ name: 'a.doc', size: 1024 })).toEqual({
      ok: false,
      error: 'UNSUPPORTED_LEGACY_DOC',
    });
  });

  it('非 docx 文件被拒绝', () => {
    expect(checkImportFile({ name: 'a.pdf', size: 1024 })).toEqual({
      ok: false,
      error: 'NOT_DOCX',
    });
  });

  it('超大文件返回 TOO_LARGE', () => {
    const result = checkImportFile({ name: 'a.docx', size: MAX_IMPORT_BYTES + 1 });
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error).toBe('TOO_LARGE');
  });
});

describe('checkExportSize', () => {
  it('空文档不可导出', () => {
    expect(checkExportSize('<p></p>')).toEqual({ ok: false, error: 'EMPTY' });
    expect(checkExportSize('   ')).toEqual({ ok: false, error: 'EMPTY' });
  });

  it('超出上限不可导出', () => {
    const oversized = `<p>${'a'.repeat(MAX_EXPORT_HTML_BYTES + 1)}</p>`;
    const result = checkExportSize(oversized);
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error).toBe('TOO_LARGE');
  });

  it('正常文档通过', () => {
    expect(checkExportSize('<p>hello</p>')).toEqual({ ok: true, value: true });
  });
});

describe('sanitizeDocHtml', () => {
  it('剥离脚本与事件属性', () => {
    const dirty = '<p onclick="alert(1)">你好</p><script>alert(2)</script>';
    const result = sanitizeDocHtml(dirty);
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.value).not.toContain('script');
    expect(result.value).not.toContain('onclick');
    expect(result.value).toContain('你好');
  });

  it('空内容返回 EMPTY', () => {
    expect(sanitizeDocHtml('  ')).toEqual({ ok: false, error: 'EMPTY' });
  });
});

describe('htmlToPlain 与 countDocStats', () => {
  it('块级元素转为换行并保留 CJK 文本', () => {
    const plain = htmlToPlain('<h1>标题</h1><p>第一段</p><p>第二段</p>');
    expect(plain).toBe('标题\n第一段\n第二段');
  });

  it('统计中英文混排字数与段落数', () => {
    const stats = countDocStats('你好世界 hello world');
    expect(stats.chars).toBe(16);
    expect(stats.charsNoSpace).toBe(14);
    expect(stats.words).toBe(6);
  });

  it('段落按非空行计数', () => {
    const plain = htmlToPlain('<p>a</p><ul><li>b</li><li>c</li></ul>');
    const stats = countDocStats(plain);
    expect(stats.paragraphs).toBe(3);
    expect(stats.words).toBe(3);
  });

  it('空文档统计为零', () => {
    expect(countDocStats('')).toEqual({ chars: 0, charsNoSpace: 0, words: 0, paragraphs: 0 });
  });
});

describe('文件名处理', () => {
  it('过滤非法字符并限制长度', () => {
    expect(sanitizeFilename('report/2024:q1?')).toBe('report2024q1');
    expect(sanitizeFilename('')).toBe('document');
    expect(sanitizeFilename('a'.repeat(100)).length).toBe(60);
  });

  it('生成带扩展名的导出文件名', () => {
    expect(buildExportFilename('年度报告', 'docx')).toBe('年度报告.docx');
    expect(buildExportFilename('', 'pdf')).toBe('document.pdf');
  });
});

describe('computePageBreaks', () => {
  it('全部内容容纳在一页时不产生切点', () => {
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

  it('跨页的块整体移到下一页', () => {
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

  it('单块高于一整页时允许溢出，不会死循环', () => {
    const cuts = computePageBreaks([{ top: 0, height: 500 }], 200);
    expect(cuts).toEqual([500]);
  });

  it('页高非法时返回空数组', () => {
    expect(computePageBreaks([{ top: 0, height: 10 }], 0)).toEqual([]);
  });
});

describe('createEmptyDocHtml', () => {
  it('返回空段落 HTML', () => {
    expect(createEmptyDocHtml()).toBe('<p></p>');
  });
});

describe('pageIndexOfPosition / countPages', () => {
  it('未分页时全部落在第 1 页', () => {
    expect(pageIndexOfPosition([], 0)).toBe(1);
    expect(pageIndexOfPosition([], 5000)).toBe(1);
    expect(countPages([])).toBe(1);
  });

  it('按页起始位置二分定位页码', () => {
    const starts = [100, 250, 900];
    expect(pageIndexOfPosition(starts, 0)).toBe(1);
    expect(pageIndexOfPosition(starts, 99)).toBe(1);
    // 分页点本身属于新的一页
    expect(pageIndexOfPosition(starts, 100)).toBe(2);
    expect(pageIndexOfPosition(starts, 249)).toBe(2);
    expect(pageIndexOfPosition(starts, 250)).toBe(3);
    expect(pageIndexOfPosition(starts, 100000)).toBe(4);
    expect(countPages(starts)).toBe(4);
  });

  it('对大量分页点保持对数复杂度结果正确', () => {
    // 分页点从第 2 页起才有（第 1 页起点是文档开头，不入数组）
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
  it('统计批注 / 修订 / 段落排版 / 浮动图片', () => {
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

  it('嵌入型图片不算浮动损耗', () => {
    const result = scanMarkdownExportLosses('<img src="x.png" data-layer="inline">');
    expect(result.ok && result.value.floatingImages).toBe(0);
  });

  it('默认页面设置不计入损耗，非默认项才计数', () => {
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
