import JSZip from 'jszip';
import { describe, expect, it } from 'vitest';
import { CONTENT_WIDTH_PX, planPageBlocks, scanDocxExportLosses } from './core';
import { exportDocxBlob } from './docx';
import { DEFAULT_PAGE_SETUP } from './pageSetup';
import { renderTocHtml } from './toc';

const TOC_LABELS = { title: '目录', empty: '文档暂无标题' };

/** docx 导出层测试：嵌套列表 / 合并单元格 / 丢失清单 / 分页符（jsdom 环境） */

// jsdom 的 Blob 没有 arrayBuffer()，用 FileReader 读二进制
const blobToArrayBuffer = (blob: Blob): Promise<ArrayBuffer> =>
  new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result as ArrayBuffer);
    reader.onerror = () => reject(reader.error);
    reader.readAsArrayBuffer(blob);
  });

/** 读取导出文档中的任意 zip 条目 */
async function readZipEntry(blob: Blob, path: string): Promise<string> {
  const zip = await JSZip.loadAsync(await blobToArrayBuffer(blob));
  return (await zip.file(path)?.async('string')) ?? '';
}

/** 读取导出文档的 word/document.xml */
async function readDocumentXml(blob: Blob): Promise<string> {
  return readZipEntry(blob, 'word/document.xml');
}

describe('planPageBlocks（编辑态分页规划）', () => {
  it('内容不足一页时不分页', () => {
    const items = [
      { top: 0, height: 100 },
      { top: 120, height: 100 },
    ];
    expect(planPageBlocks(items, 971)).toEqual([]);
  });

  it('超出一页时从越界块开始新页，并逐页推进', () => {
    const items = [
      { top: 0, height: 600 },
      { top: 600, height: 600 }, // 跨页 → 第 2 页起始
      { top: 1200, height: 100 }, // 第 2 页内
      { top: 1300, height: 600 }, // 跨页 → 第 3 页起始
    ];
    expect(planPageBlocks(items, 971)).toEqual([1, 3]);
  });

  it('单块高于一页时允许溢出，不产生死循环', () => {
    expect(planPageBlocks([{ top: 0, height: 3000 }], 971)).toEqual([]);
  });
});

describe('scanDocxExportLosses', () => {
  it('外链图片计入 externalImages，data 图片不计', () => {
    const html =
      '<p><img src="https://example.com/a.png"><img src="data:image/png;base64,iVBORw0KGgo="></p>';
    const result = scanDocxExportLosses(html);
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.value.externalImages).toBe(1);
      expect(result.value.webpImages).toBe(0);
    }
  });

  it('webp 图片计入 webpImages', () => {
    const result = scanDocxExportLosses('<p><img src="data:image/webp;base64,UklGRg=="></p>');
    expect(result.ok).toBe(true);
    if (result.ok) expect(result.value.webpImages).toBe(1);
  });

  it('顶层列表不重复计数，嵌套超过 8 层才计入 deepListItems', () => {
    const nested = (n: number) => {
      let html = '<li>leaf</li>';
      for (let i = 0; i < n; i += 1) html = `<li>x<ul>${html}</ul></li>`;
      return `<ul>${html}</ul>`;
    };
    const shallow = scanDocxExportLosses('<ul><li>a<ul><li>b</li></ul></li></ul>');
    expect(shallow.ok && shallow.value.deepListItems).toBe(0);
    const deep = scanDocxExportLosses(nested(10));
    expect(deep.ok).toBe(true);
    if (deep.ok) expect(deep.value.deepListItems).toBe(2);
  });

  it('有标记但缺少元数据的批注计入 unlinkedComments', () => {
    const html =
      '<p><span data-comment-id="c-1">有元数据</span><span data-comment-id="c-2">孤立</span></p>';
    const result = scanDocxExportLosses(html, [{ id: 'c-1' }]);
    expect(result.ok).toBe(true);
    if (result.ok) expect(result.value.unlinkedComments).toBe(1);
  });

  it('未传入批注元数据时不报告 unlinkedComments', () => {
    const result = scanDocxExportLosses('<p><span data-comment-id="c-1">x</span></p>');
    expect(result.ok).toBe(true);
    if (result.ok) expect(result.value.unlinkedComments).toBe(0);
  });
});

describe('exportDocxBlob', () => {
  it('空内容返回 EMPTY 错误', async () => {
    const result = await exportDocxBlob('<p></p>', 't');
    expect(result.ok).toBe(false);
    expect(!result.ok && result.error).toBe('EMPTY');
  });

  it('嵌套列表 + 合并单元格 + 分页符可导出为非空 docx Blob', async () => {
    const html = [
      '<h1>标题</h1>',
      '<ul><li>a<ul><li>b<ul><li>c</li></ul></li></ul></li></ul>',
      '<ul data-type="taskList"><li data-checked="true" data-type="taskItem"><label><input type="checkbox" checked><span></span></label><div><p>done</p></div></li></ul>',
      '<div data-page-break="true"></div>',
      '<table><colgroup><col style="width: 50%"><col style="width: 50%"></colgroup><tr><th colspan="2">head</th></tr><tr><td>1</td><td style="background-color: #ff0000">2</td></tr></table>',
    ].join('');
    const result = await exportDocxBlob(html, '测试文档');
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.value.size).toBeGreaterThan(4000);
      expect(result.value.type).toBe(
        'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
      );
    }
  });

  it('webp 图片被跳过但文档仍导出成功', async () => {
    const result = await exportDocxBlob(
      '<p><img src="data:image/webp;base64,UklGRh4AAABXRUJQVlA4TBEAAAAvAAAAAAfQ//73v/+BiOh/AAA="></p>',
      't',
    );
    expect(result.ok).toBe(true);
  });
});

describe('docx 导出：行内字体与字号', () => {
  it('显式设置的字体名与字号写入 Word 行属性', async () => {
    const html =
      '<p><span style="font-family: &quot;Songti SC&quot;, serif; font-size: 24px;">样张</span></p>';
    const result = await exportDocxBlob(html, '字体测试');
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    const xml = await readDocumentXml(result.value);
    expect(xml).toContain('Songti SC');
    // 24px → 36 半磅（1px = 0.75pt，半磅 = pt × 2）
    expect(xml).toContain('w:sz w:val="36"');
  });

  it('通用族关键字不会被当成具体字体写入', async () => {
    const result = await exportDocxBlob(
      '<p><span style="font-family: sans-serif;">plain</span></p>',
      't',
    );
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    const xml = await readDocumentXml(result.value);
    expect(xml).not.toContain('sans-serif');
  });
});

describe('docx 导出：图片层级', () => {
  // 1×1 透明 PNG
  const PNG =
    'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8DwHwAFAAH/q842iQAAAABJRU5ErkJggg==';

  it('嵌入型图片导出为行内图片（wp:inline）', async () => {
    const result = await exportDocxBlob(`<p><img src="${PNG}"></p>`, 'inline');
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    const xml = await readDocumentXml(result.value);
    expect(xml).toContain('<wp:inline');
    expect(xml).not.toContain('<wp:anchor');
  });

  it('衬于文字下方导出为浮动图片（anchor + behindDoc）', async () => {
    const floating = `<img src="${PNG}" data-layer="behind" style="left: 10px; top: 20px">`;
    const result = await exportDocxBlob(`<p>文字</p>${floating}`, 'float');
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    const xml = await readDocumentXml(result.value);
    expect(xml).toContain('<wp:anchor');
    expect(xml).toContain('behindDoc="1"');
    expect(xml).toContain('wrapNone');
  });

  it('图片像素宽度写入 Word 尺寸（px → EMU）', async () => {
    const result = await exportDocxBlob(
      `<img src="${PNG}" style="width: 300px; height: auto">`,
      'w',
    );
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    const xml = await readDocumentXml(result.value);
    // 300px × 9525 EMU/px
    expect(xml).toContain('cx="2857500"');
  });

  it('旧版百分比宽度导出时换算为绝对尺寸', async () => {
    const result = await exportDocxBlob(`<img src="${PNG}" style="width: 50%">`, 'w');
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    const xml = await readDocumentXml(result.value);
    // 换算链路：50% → 像素 → EMU（docx 用未取整的像素值换算 EMU）
    const expected = Math.round(0.5 * CONTENT_WIDTH_PX * 9525);
    expect(xml).toContain(`cx="${expected}"`);
  });

  it('浮于文字上方保持不遮挡文字排版的 wrapNone，但不 behindDoc', async () => {
    const floating = `<img src="${PNG}" data-layer="front" style="left: 0px; top: 0px">`;
    const result = await exportDocxBlob(`<p>文字</p>${floating}`, 'front');
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    const xml = await readDocumentXml(result.value);
    expect(xml).toContain('<wp:anchor');
    expect(xml).not.toContain('behindDoc="1"');
  });
});

describe('docx 导出：超链接', () => {
  it('a[href] 导出为可点击的 Word 超链接', async () => {
    const result = await exportDocxBlob(
      '<p>访问 <a href="https://example.com/docs">文档</a> 了解更多</p>',
      'link',
    );
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    const xml = await readDocumentXml(result.value);
    expect(xml).toContain('<w:hyperlink');
    expect(xml).toContain('文档');
    const rels = await readZipEntry(result.value, 'word/_rels/document.xml.rels');
    expect(rels).toContain('https://example.com/docs');
    expect(rels).toContain('hyperlink');
  });

  it('链接内的加粗等字符格式保持有效', async () => {
    const result = await exportDocxBlob(
      '<p><a href="https://a.dev"><strong>粗体链接</strong></a></p>',
      'l',
    );
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    const xml = await readDocumentXml(result.value);
    expect(xml).toContain('<w:hyperlink');
    expect(xml).toContain('<w:b/>');
  });

  it('缺少 href 的锚点退化为普通文本，不产生空关系', async () => {
    const result = await exportDocxBlob('<p><a>纯文本</a></p>', 'l');
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    const xml = await readDocumentXml(result.value);
    expect(xml).not.toContain('<w:hyperlink');
    expect(xml).toContain('纯文本');
  });
});

describe('docx 导出：修订追踪', () => {
  it('ins/del 映射为 Word 原生修订，并打开 trackRevisions', async () => {
    const html =
      '<p>正文<ins data-track="insert" class="rte-track-insert">新增</ins>' +
      '<del data-track="delete" class="rte-track-delete">删除</del></p>';
    const result = await exportDocxBlob(html, 'tracked', null, {
      changes: [
        { id: 't-1', kind: 'insert', text: '新增', author: '审阅人', createdAt: 0 },
        { id: 't-2', kind: 'delete', text: '删除', author: '审阅人', createdAt: 0 },
      ],
      author: '审阅人',
    });
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    const xml = await readDocumentXml(result.value);
    expect(xml).toContain('<w:ins ');
    expect(xml).toContain('<w:del ');
    // 删除内容必须使用 w:delText，否则 Word 会报文档损坏
    expect(xml).toContain('<w:delText');
    expect(xml).toContain('w:author="审阅人"');
    const settings = await readZipEntry(result.value, 'word/settings.xml');
    // docx 开启时写 <w:trackRevisions/>，关闭时写 w:val="false"
    expect(settings).toContain('<w:trackRevisions/>');
  });

  it('无修订时 trackRevisions 保持关闭', async () => {
    const result = await exportDocxBlob('<p>普通段落</p>', 'plain');
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    const settings = await readZipEntry(result.value, 'word/settings.xml');
    expect(settings).toContain('<w:trackRevisions w:val="false"/>');
  });
});

describe('docx 导出：批注', () => {
  it('有元数据的批注导出为 Word 批注（范围 + 引用 + comments.xml）', async () => {
    const html = '<p>前文<span data-comment-id="c-1">待审</span>后文</p>';
    const result = await exportDocxBlob(html, 'comment', null, {
      comments: [
        {
          id: 'c-1',
          quote: '待审',
          text: '这里需要补充来源',
          author: '审阅人',
          createdAt: 0,
          resolved: false,
        },
      ],
      author: '审阅人',
    });
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    const xml = await readDocumentXml(result.value);
    expect(xml).toContain('<w:commentRangeStart');
    expect(xml).toContain('<w:commentRangeEnd');
    expect(xml).toContain('<w:commentReference');
    const comments = await readZipEntry(result.value, 'word/comments.xml');
    expect(comments).toContain('这里需要补充来源');
    expect(comments).toContain('审阅人');
  });

  it('批注引文以斜体写入 comments.xml，正文写入批注内容', async () => {
    const html = '<p><span data-comment-id="c-9">被批注的原文</span></p>';
    const result = await exportDocxBlob(html, 'quote', null, {
      comments: [
        {
          id: 'c-9',
          quote: '被批注的原文',
          text: '这段需要重写',
          author: 'A',
          createdAt: 0,
          resolved: false,
        },
      ],
    });
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    const comments = await readZipEntry(result.value, 'word/comments.xml');
    expect(comments).toContain('被批注的原文');
    expect(comments).toContain('这段需要重写');
    expect(comments).toContain('<w:i/>');
  });

  it('缺少元数据的批注标记不写入批注，但文本保留', async () => {
    const result = await exportDocxBlob(
      '<p><span data-comment-id="orphan">孤立文本</span></p>',
      'orphan',
    );
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    const xml = await readDocumentXml(result.value);
    expect(xml).not.toContain('<w:commentRangeStart');
    expect(xml).toContain('孤立文本');
    // docx 始终产出 comments.xml 容器，此处断言其中没有批注条目
    const comments = await readZipEntry(result.value, 'word/comments.xml');
    expect(comments).not.toContain('<w:comment ');
  });
});

describe('docx 导出：目录域', () => {
  it('目录内容为空的目录节点也能导出为占位目录域', async () => {
    const result = await exportDocxBlob('<div data-toc="true" class="rte-toc"></div>', 'toc');
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    const xml = await readDocumentXml(result.value);
    expect(xml).toContain('<w:fldChar w:fldCharType="begin"');
  });

  it('div[data-toc] 映射为可更新的 Word 目录域，并缓存条目文本与页码', async () => {
    const toc = renderTocHtml(
      [
        { level: 1, text: '引言', page: 1 },
        { level: 2, text: '背景', page: 2 },
      ],
      [
        { level: 1, text: '引言', pos: 1 },
        { level: 2, text: '背景', pos: 20 },
      ],
      TOC_LABELS,
    );
    const result = await exportDocxBlob(`<h1>引言</h1>${toc}<p>正文</p>`, 'toc');
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    const xml = await readDocumentXml(result.value);
    // TOC 域：标题级别 1-6、带超链接、标记为待更新
    expect(xml).toContain(
      '<w:instrText xml:space="preserve">TOC \\h \\o &quot;1-6&quot;</w:instrText>',
    );
    expect(xml).toContain('w:dirty="true"');
    // 目录标题作为内容控件别名
    expect(xml).toContain('<w:alias w:val="目录"/>');
    // 缓存条目：Word 打开即显示，页码在更新域时重算
    expect(xml).toContain('<w:pStyle w:val="TOC1"/>');
    expect(xml).toContain('<w:pStyle w:val="TOC2"/>');
    expect(xml).toContain('背景');
    // 让 Word 打开文档时自动更新域
    const settings = await readZipEntry(result.value, 'word/settings.xml');
    expect(settings).toContain('<w:updateFields/>');
  });
});

describe('docx 导出：脚注', () => {
  it('sup[data-footnote] 映射为 Word 脚注引用与 footnotes.xml', async () => {
    const result = await exportDocxBlob(
      '<p>甲<sup data-footnote="true" data-note="第一条注释" data-number="1">[1]</sup>乙</p>',
      'footnote',
    );
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    const xml = await readDocumentXml(result.value);
    expect(xml).toContain('<w:footnoteReference w:id="1"');
    const notes = await readZipEntry(result.value, 'word/footnotes.xml');
    expect(notes).toContain('第一条注释');
    // 分隔符与续行符（id -1 / 0）由 docx 固定写入，业务脚注只有 1 条
    expect((notes.match(/<w:footnote w:id="\d+"/g) ?? []).length).toBe(1);
    // 序号由 Word 自动渲染：脚注段落里只应出现一次 w:footnoteRef
    const body = notes.slice(notes.indexOf('<w:footnote w:id="1"'));
    expect((body.match(/<w:footnoteRef\/>/g) ?? []).length).toBe(1);
  });

  it('多脚注按正文顺序编号，编号与 footnotes.xml 的 id 对齐', async () => {
    const result = await exportDocxBlob(
      '<p>甲<sup data-footnote="true" data-note="一"></sup>' +
        '乙<sup data-footnote="true" data-note="二"></sup></p>',
      'footnotes',
    );
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    const xml = await readDocumentXml(result.value);
    expect(xml).toContain('<w:footnoteReference w:id="1"');
    expect(xml).toContain('<w:footnoteReference w:id="2"');
    const notes = await readZipEntry(result.value, 'word/footnotes.xml');
    expect(notes).toContain('<w:footnote w:id="1"');
    expect(notes).toContain('<w:footnote w:id="2"');
    expect(notes).toContain('>一<');
    expect(notes).toContain('>二<');
  });

  it('没有脚注时不产生业务脚注条目', async () => {
    const result = await exportDocxBlob('<p>普通段落</p>', 'nofn');
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    const notes = await readZipEntry(result.value, 'word/footnotes.xml');
    expect(notes).not.toContain('<w:footnote w:id="1"');
    const xml = await readDocumentXml(result.value);
    expect(xml).not.toContain('w:footnoteReference');
  });
});

describe('docx 导出：版式（分栏 / 背景 / 首页不同）', () => {
  it('分栏写入分节属性（w:cols）', async () => {
    const result = await exportDocxBlob('<p>正文</p>', 'cols', {
      ...DEFAULT_PAGE_SETUP,
      columns: 2,
    });
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    const xml = await readDocumentXml(result.value);
    expect(xml).toContain('<w:cols');
    expect(xml).toContain('w:num="2"');
    expect(xml).toContain('w:equalWidth="true"');
  });

  it('单栏时不写 w:cols，保持 Word 默认排版', async () => {
    const result = await exportDocxBlob('<p>正文</p>', 'onecol', DEFAULT_PAGE_SETUP);
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    const xml = await readDocumentXml(result.value);
    expect(xml).not.toContain('<w:cols ');
  });

  it('页面背景写入文档背景（w:background）', async () => {
    const result = await exportDocxBlob('<p>正文</p>', 'bg', {
      ...DEFAULT_PAGE_SETUP,
      background: '#eef2ff',
    });
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    const xml = await readDocumentXml(result.value);
    expect(xml).toContain('<w:background');
    expect(xml).toContain('w:color="eef2ff"');
  });

  it('首页不同写入 titlePg', async () => {
    const result = await exportDocxBlob('<p>正文</p>', 'titlepage', {
      ...DEFAULT_PAGE_SETUP,
      differentFirstPage: true,
      header: '内部资料',
    });
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    const xml = await readDocumentXml(result.value);
    expect(xml).toContain('<w:titlePg');
  });
});

describe('docx 导出：公式', () => {
  it('可表达的公式导出为 Word 原生公式（m:oMath）', async () => {
    const result = await exportDocxBlob(
      '<p>前<span data-math="inline" data-display="false" data-latex="\\frac{a}{b}"></span>后</p>',
      'math',
    );
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    const xml = await readDocumentXml(result.value);
    expect(xml).toContain('<m:oMath>');
    expect(xml).toContain('<m:f>');
    expect(xml).toContain('<m:num>');
    expect(xml).toContain('<m:den>');
  });

  it('块级公式独占一个公式段落', async () => {
    const result = await exportDocxBlob(
      '<div data-math="block" data-display="true" data-latex="\\sum_{i=1}^{n} a_i"></div>',
      'math-block',
    );
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    const xml = await readDocumentXml(result.value);
    expect(xml).toContain('<m:oMath>');
    expect(xml).toContain('<m:nary>');
    expect(xml).toContain('<m:sup>');
  });

  it('上下标与根号映射为 OMML 的对应结构', async () => {
    const result = await exportDocxBlob(
      '<p><span data-math="inline" data-display="false" data-latex="x_i^2"></span>' +
        '<span data-math="inline" data-display="false" data-latex="\\sqrt{y}"></span></p>',
      'math-scripts',
    );
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    const xml = await readDocumentXml(result.value);
    expect(xml).toContain('<m:sSubSup>');
    expect(xml).toContain('<m:rad>');
  });

  it('OMML 表达不了的公式降级为图片或源码，不丢内容', async () => {
    // jsdom 无 canvas，图片降级会失败 → 走源码兜底；关键是内容不丢
    const result = await exportDocxBlob(
      '<p><span data-math="inline" data-display="false" data-latex="\\begin{matrix} a \\end{matrix}"></span></p>',
      'math-fallback',
    );
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    const xml = await readDocumentXml(result.value);
    expect(xml).toContain('begin{matrix}');
    expect(xml).not.toContain('<m:oMath>');
  });
});

describe('docx 导出：批注范围', () => {
  it('批注范围跨多个文本节点时只包裹一次（范围严格嵌套）', async () => {
    const html = '<p><span data-comment-id="c-1">第一段<strong>加粗</strong>结尾</span></p>';
    const result = await exportDocxBlob(html, 'range', null, {
      comments: [
        { id: 'c-1', quote: '第一段', text: '看这里', author: 'A', createdAt: 0, resolved: false },
      ],
    });
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    const xml = await readDocumentXml(result.value);
    const starts = xml.match(/<w:commentRangeStart/g)?.length ?? 0;
    const ends = xml.match(/<w:commentRangeEnd/g)?.length ?? 0;
    expect(starts).toBe(1);
    expect(ends).toBe(1);
  });
});
