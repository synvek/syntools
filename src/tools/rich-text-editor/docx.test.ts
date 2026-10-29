import JSZip from 'jszip';
import { describe, expect, it } from 'vitest';
import { CONTENT_WIDTH_PX, planPageBlocks, scanDocxExportLosses } from './core';
import { exportDocxBlob, importDocx } from './docx';
import { DEFAULT_PAGE_SETUP, normalizePageSetup, type PageSetupConfig } from './pageSetup';
import { renderTocHtml } from './toc';

const TOC_LABELS = { title: '目录', empty: '文档暂无标题' };

/** docx export tests: nested lists / merged cells / loss report / page breaks (jsdom) */

// jsdom Blob lacks arrayBuffer(), so read bytes via FileReader
const blobToArrayBuffer = (blob: Blob): Promise<ArrayBuffer> =>
  new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result as ArrayBuffer);
    reader.onerror = () => reject(reader.error);
    reader.readAsArrayBuffer(blob);
  });

/** Read any zip entry from an exported document */
async function readZipEntry(blob: Blob, path: string): Promise<string> {
  const zip = await JSZip.loadAsync(await blobToArrayBuffer(blob));
  return (await zip.file(path)?.async('string')) ?? '';
}

/** Read word/document.xml from an exported document */
async function readDocumentXml(blob: Blob): Promise<string> {
  return readZipEntry(blob, 'word/document.xml');
}

describe('planPageBlocks (edit-mode pagination planning)', () => {
  it('does not paginate when the content fits one page', () => {
    const items = [
      { top: 0, height: 100 },
      { top: 120, height: 100 },
    ];
    expect(planPageBlocks(items, 971)).toEqual([]);
  });

  it('starts a new page at the overflowing block and advances page by page', () => {
    const items = [
      { top: 0, height: 600 },
      { top: 600, height: 600 }, // spans pages → start of page 2
      { top: 1200, height: 100 }, // inside page 2
      { top: 1300, height: 600 }, // spans pages → start of page 3
    ];
    expect(planPageBlocks(items, 971)).toEqual([1, 3]);
  });

  it('allows overflow when a block is taller than a page, without looping forever', () => {
    expect(planPageBlocks([{ top: 0, height: 3000 }], 971)).toEqual([]);
  });
});

describe('scanDocxExportLosses', () => {
  it('counts linked images as externalImages but not data images', () => {
    const html =
      '<p><img src="https://example.com/a.png"><img src="data:image/png;base64,iVBORw0KGgo="></p>';
    const result = scanDocxExportLosses(html);
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.value.externalImages).toBe(1);
      expect(result.value.webpImages).toBe(0);
    }
  });

  it('counts webp images as webpImages', () => {
    const result = scanDocxExportLosses('<p><img src="data:image/webp;base64,UklGRg=="></p>');
    expect(result.ok).toBe(true);
    if (result.ok) expect(result.value.webpImages).toBe(1);
  });

  it('does not double count top-level lists and only counts nesting deeper than 8 in deepListItems', () => {
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

  it('counts comments that have marks but no metadata in unlinkedComments', () => {
    const html =
      '<p><span data-comment-id="c-1">有元数据</span><span data-comment-id="c-2">孤立</span></p>';
    const result = scanDocxExportLosses(html, [{ id: 'c-1' }]);
    expect(result.ok).toBe(true);
    if (result.ok) expect(result.value.unlinkedComments).toBe(1);
  });

  it('reports no unlinkedComments when no comment metadata is passed', () => {
    const result = scanDocxExportLosses('<p><span data-comment-id="c-1">x</span></p>');
    expect(result.ok).toBe(true);
    if (result.ok) expect(result.value.unlinkedComments).toBe(0);
  });
});

describe('exportDocxBlob', () => {
  it('returns the EMPTY error for empty content', async () => {
    const result = await exportDocxBlob('<p></p>', 't');
    expect(result.ok).toBe(false);
    expect(!result.ok && result.error).toBe('EMPTY');
  });

  it('exports nested lists + merged cells + page breaks as a non-empty docx Blob', async () => {
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

  it('skips webp images but still exports the document', async () => {
    const result = await exportDocxBlob(
      '<p><img src="data:image/webp;base64,UklGRh4AAABXRUJQVlA4TBEAAAAvAAAAAAfQ//73v/+BiOh/AAA="></p>',
      't',
    );
    expect(result.ok).toBe(true);
  });

  it('writes one w:sectPr per section, each with its own page geometry', async () => {
    const html = [
      '<p>第一节</p>',
      '<div data-section-break="nextPage" data-section-setup=\'{"size":"Letter","orientation":"landscape","margin":{"top":12.7,"right":12.7,"bottom":12.7,"left":12.7}}\'></div>',
      '<p>第二节</p>',
    ].join('');
    const result = await exportDocxBlob(html, 'sections', DEFAULT_PAGE_SETUP);
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    const xml = await readDocumentXml(result.value);
    expect((xml.match(/<w:sectPr/g) ?? []).length).toBe(2);
    // Second section: Letter landscape. `docx` swaps the pair when writing w:pgSz for landscape,
    // so the emitted size is the landscape one (15840 × 12240 twips) plus the orient flag.
    expect(xml).toContain('w:orient="landscape"');
    expect(xml).toContain('w:w="15840"');
    expect(xml).toContain('w:h="12240"');
    // 12.7mm margins -> 720 twips
    expect(xml).toContain('w:top="720"');
  });

  it('keeps a single section when the document has no section break', async () => {
    const result = await exportDocxBlob('<p>a</p><p>b</p>', 'single');
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    const xml = await readDocumentXml(result.value);
    expect((xml.match(/<w:sectPr/g) ?? []).length).toBe(1);
  });

  /** Header parts of an exported document (word/header1.xml, header2.xml, …) */
  async function headerParts(blob: Blob): Promise<string[]> {
    const zip = await JSZip.loadAsync(await blobToArrayBuffer(blob));
    return Object.keys(zip.files).filter((name) => /^word\/header\d*\.xml$/.test(name));
  }

  it('a section linked to the previous one reuses its header instead of writing a new part', async () => {
    const setup = normalizePageSetup({ header: '公司机密' });
    const html = [
      '<p>a</p>',
      '<div data-section-break="nextPage" data-section-header-linked="true"></div>',
      '<p>b</p>',
    ].join('');
    const linked = await exportDocxBlob(html, 'linked', setup);
    expect(linked.ok).toBe(true);
    if (!linked.ok) return;
    expect(await headerParts(linked.value)).toHaveLength(1);

    const unlinked = await exportDocxBlob(
      html.replace(' data-section-header-linked="true"', ' data-section-header-linked="false"'),
      'unlinked',
      setup,
    );
    expect(unlinked.ok).toBe(true);
    if (!unlinked.ok) return;
    // Unlinked section owns its header → a second header part
    expect(await headerParts(unlinked.value)).toHaveLength(2);
  });
});

describe('importDocx layout read-back (P2-2.4)', () => {
  /** jsdom's File has no arrayBuffer(); fall back to FileReader for the test only */
  const toFile = (blob: Blob, name: string): File => {
    const file = new File([blob], name, {
      type: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    });
    if (typeof file.arrayBuffer !== 'function') {
      Object.defineProperty(file, 'arrayBuffer', { value: () => blobToArrayBuffer(blob) });
    }
    return file;
  };

  it('recovers the first section page setup', async () => {
    const setup = normalizePageSetup({
      size: 'Letter',
      orientation: 'landscape',
      margin: { top: 12.7, right: 12.7, bottom: 12.7, left: 12.7 },
    });
    const exported = await exportDocxBlob('<p>a</p>', 'layout', setup);
    expect(exported.ok).toBe(true);
    if (!exported.ok) return;

    // A container keeps TypeScript from narrowing the value to null (the assignment happens in a callback)
    const captured: { layout?: { pageSetup: Partial<PageSetupConfig>; sectionCount: number } } = {};
    const result = await importDocx(toFile(exported.value, 'layout.docx'), {
      onLayout: (info) => {
        captured.layout = info;
      },
    });
    expect(result.ok).toBe(true);
    expect(captured.layout?.sectionCount).toBe(1);
    expect(captured.layout?.pageSetup.size).toBe('Letter');
    expect(captured.layout?.pageSetup.orientation).toBe('landscape');
    expect(captured.layout?.pageSetup.margin?.top).toBe(12.7);
  });

  it('reports the section count of multi-section documents', async () => {
    const html = ['<p>a</p>', '<div data-section-break="nextPage"></div>', '<p>b</p>'].join('');
    const exported = await exportDocxBlob(html, 'layout', DEFAULT_PAGE_SETUP);
    expect(exported.ok).toBe(true);
    if (!exported.ok) return;

    const captured: { layout?: { pageSetup: Partial<PageSetupConfig>; sectionCount: number } } = {};
    await importDocx(toFile(exported.value, 'layout.docx'), {
      onLayout: (info) => {
        captured.layout = info;
      },
    });
    expect(captured.layout?.sectionCount).toBe(2);
  });
});

describe('docx export: inline font family and size', () => {
  it('writes explicit font name and size to Word run properties', async () => {
    const html =
      '<p><span style="font-family: &quot;Songti SC&quot;, serif; font-size: 24px;">样张</span></p>';
    const result = await exportDocxBlob(html, '字体测试');
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    const xml = await readDocumentXml(result.value);
    expect(xml).toContain('Songti SC');
    // 24px → 36 half-points (1px = 0.75pt, half-point = pt × 2)
    expect(xml).toContain('w:sz w:val="36"');
  });

  it('does not write generic family keywords as a concrete font', async () => {
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

describe('docx export: image layering', () => {
  // 1x1 transparent PNG
  const PNG =
    'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8DwHwAFAAH/q842iQAAAABJRU5ErkJggg==';

  it('exports inline images as wp:inline', async () => {
    const result = await exportDocxBlob(`<p><img src="${PNG}"></p>`, 'inline');
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    const xml = await readDocumentXml(result.value);
    expect(xml).toContain('<wp:inline');
    expect(xml).not.toContain('<wp:anchor');
  });

  it('exports behind-text images as floating anchors with behindDoc', async () => {
    const floating = `<img src="${PNG}" data-layer="behind" style="left: 10px; top: 20px">`;
    const result = await exportDocxBlob(`<p>文字</p>${floating}`, 'float');
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    const xml = await readDocumentXml(result.value);
    expect(xml).toContain('<wp:anchor');
    expect(xml).toContain('behindDoc="1"');
    expect(xml).toContain('wrapNone');
  });

  it('writes the pixel width as the Word size (px → EMU)', async () => {
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

  it('converts legacy percentage widths to absolute sizes on export', async () => {
    const result = await exportDocxBlob(`<img src="${PNG}" style="width: 50%">`, 'w');
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    const xml = await readDocumentXml(result.value);
    // Conversion chain: 50% → pixels → EMU (docx converts from the unrounded pixel value)
    const expected = Math.round(0.5 * CONTENT_WIDTH_PX * 9525);
    expect(xml).toContain(`cx="${expected}"`);
  });

  it('keeps wrapNone for in-front images so text layout is untouched, but without behindDoc', async () => {
    const floating = `<img src="${PNG}" data-layer="front" style="left: 0px; top: 0px">`;
    const result = await exportDocxBlob(`<p>文字</p>${floating}`, 'front');
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    const xml = await readDocumentXml(result.value);
    expect(xml).toContain('<wp:anchor');
    expect(xml).not.toContain('behindDoc="1"');
  });

  it('exports square wrapping as a square frame with left / right horizontal alignment', async () => {
    const left = `<img src="${PNG}" data-layer="wrap-left">`;
    const result = await exportDocxBlob(`<p>文字</p>${left}`, 'wrap-left');
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    const xml = await readDocumentXml(result.value);
    expect(xml).toContain('<wp:anchor');
    expect(xml).toContain('wrapSquare');
    expect(xml).toContain('>left<');

    const right = `<img src="${PNG}" data-layer="wrap-right">`;
    const rightResult = await exportDocxBlob(`<p>文字</p>${right}`, 'wrap-right');
    expect(rightResult.ok).toBe(true);
    if (!rightResult.ok) return;
    expect(await readDocumentXml(rightResult.value)).toContain('>right<');
  });

  it('exports top-and-bottom wrapping as wrapTopAndBottom', async () => {
    const topBottom = `<img src="${PNG}" data-layer="top-bottom">`;
    const result = await exportDocxBlob(`<p>文字</p>${topBottom}`, 'top-bottom');
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    const xml = await readDocumentXml(result.value);
    expect(xml).toContain('<wp:anchor');
    expect(xml).toContain('wrapTopAndBottom');
  });
});

describe('docx export: hyperlinks', () => {
  it('exports a[href] as a clickable Word hyperlink', async () => {
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

  it('keeps character formatting such as bold inside links', async () => {
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

  it('degrades anchors without href to plain text and creates no empty relationship', async () => {
    const result = await exportDocxBlob('<p><a>纯文本</a></p>', 'l');
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    const xml = await readDocumentXml(result.value);
    expect(xml).not.toContain('<w:hyperlink');
    expect(xml).toContain('纯文本');
  });
});

describe('docx export: tracked changes', () => {
  it('maps ins/del to native Word revisions and enables trackRevisions', async () => {
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
    // Deleted text must use w:delText, otherwise Word reports a corrupt document
    expect(xml).toContain('<w:delText');
    expect(xml).toContain('w:author="审阅人"');
    const settings = await readZipEntry(result.value, 'word/settings.xml');
    // Enabled writes <w:trackRevisions/>, disabled writes w:val="false"
    expect(settings).toContain('<w:trackRevisions/>');
  });

  it('keeps trackRevisions off when there are no revisions', async () => {
    const result = await exportDocxBlob('<p>普通段落</p>', 'plain');
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    const settings = await readZipEntry(result.value, 'word/settings.xml');
    expect(settings).toContain('<w:trackRevisions w:val="false"/>');
  });
});

describe('docx export: comments', () => {
  it('exports comments with metadata as Word comments (range + reference + comments.xml)', async () => {
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

  it('writes the quote in italics and the body as the comment content', async () => {
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

  it('drops comment marks without metadata while keeping the text', async () => {
    const result = await exportDocxBlob(
      '<p><span data-comment-id="orphan">孤立文本</span></p>',
      'orphan',
    );
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    const xml = await readDocumentXml(result.value);
    expect(xml).not.toContain('<w:commentRangeStart');
    expect(xml).toContain('孤立文本');
    // docx always emits a comments.xml container; assert it holds no comment entries
    const comments = await readZipEntry(result.value, 'word/comments.xml');
    expect(comments).not.toContain('<w:comment ');
  });
});

describe('docx export: TOC field', () => {
  it('exports a TOC node with empty content as a placeholder TOC field', async () => {
    const result = await exportDocxBlob('<div data-toc="true" class="rte-toc"></div>', 'toc');
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    const xml = await readDocumentXml(result.value);
    expect(xml).toContain('<w:fldChar w:fldCharType="begin"');
  });

  it('maps div[data-toc] to an updatable Word TOC field caching entry text and page numbers', async () => {
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
    // TOC field: heading levels 1-6, hyperlinked, marked for update
    expect(xml).toContain(
      '<w:instrText xml:space="preserve">TOC \\h \\o &quot;1-6&quot;</w:instrText>',
    );
    expect(xml).toContain('w:dirty="true"');
    // TOC title becomes the content control alias
    expect(xml).toContain('<w:alias w:val="目录"/>');
    // Cached entries: visible as soon as Word opens, page numbers recomputed on field update
    expect(xml).toContain('<w:pStyle w:val="TOC1"/>');
    expect(xml).toContain('<w:pStyle w:val="TOC2"/>');
    expect(xml).toContain('背景');
    // Make Word update fields when opening the document
    const settings = await readZipEntry(result.value, 'word/settings.xml');
    expect(settings).toContain('<w:updateFields/>');
  });
});

describe('docx export: footnotes', () => {
  it('maps sup[data-footnote] to Word footnote references and footnotes.xml', async () => {
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
    // docx always writes the separator and continuation entries (id -1 / 0); there is only one content footnote
    expect((notes.match(/<w:footnote w:id="\d+"/g) ?? []).length).toBe(1);
    // Word renders the number: w:footnoteRef appears only once in the footnote paragraph
    const body = notes.slice(notes.indexOf('<w:footnote w:id="1"'));
    expect((body.match(/<w:footnoteRef\/>/g) ?? []).length).toBe(1);
  });

  it('numbers multiple footnotes in body order, matching the ids in footnotes.xml', async () => {
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

  it('produces no content footnote entries when there are no footnotes', async () => {
    const result = await exportDocxBlob('<p>普通段落</p>', 'nofn');
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    const notes = await readZipEntry(result.value, 'word/footnotes.xml');
    expect(notes).not.toContain('<w:footnote w:id="1"');
    const xml = await readDocumentXml(result.value);
    expect(xml).not.toContain('w:footnoteReference');
  });
});

describe('docx export: layout (columns / background / different first page)', () => {
  it('writes columns to section properties (w:cols)', async () => {
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

  it('omits w:cols for a single column, keeping Word defaults', async () => {
    const result = await exportDocxBlob('<p>正文</p>', 'onecol', DEFAULT_PAGE_SETUP);
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    const xml = await readDocumentXml(result.value);
    expect(xml).not.toContain('<w:cols ');
  });

  it('writes the page background to w:background', async () => {
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

  it('writes titlePg for a different first page', async () => {
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

describe('docx export: equations', () => {
  it('exports expressible formulas as native Word equations (m:oMath)', async () => {
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

  it('gives block formulas a dedicated equation paragraph', async () => {
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

  it('maps sub/superscripts and radicals to the matching OMML structures', async () => {
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

  it('falls back to an image or source text for formulas OMML cannot express, losing nothing', async () => {
    // jsdom has no canvas, so the image fallback fails and source text is used; the point is that nothing is lost
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

describe('docx export: character-level formatting', () => {
  it('maps <sup>/<sub> to Word vertAlign', async () => {
    const result = await exportDocxBlob('<p>E=mc<sup>2</sup> H<sub>2</sub>O</p>', '上下标');
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    const xml = await readDocumentXml(result.value);
    expect(xml).toContain('<w:vertAlign w:val="superscript"/>');
    expect(xml).toContain('<w:vertAlign w:val="subscript"/>');
  });

  it('maps letter-spacing to w:spacing and uppercase to w:caps', async () => {
    const html =
      '<p><span style="letter-spacing: 1px">宽</span><span style="text-transform: uppercase">abc</span></p>';
    const result = await exportDocxBlob(html, '字间距');
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    const xml = await readDocumentXml(result.value);
    // 1px = 0.75pt = 15 twips
    expect(xml).toContain('w:spacing w:val="15"');
    expect(xml).toContain('<w:caps/>');
  });

  it('bakes lowercase / capitalize into the text (Word has no run property for them)', async () => {
    const result = await exportDocxBlob(
      '<p><span style="text-transform: lowercase">XYZ</span><span style="text-transform: capitalize">hello world</span></p>',
      '大小写',
    );
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    const xml = await readDocumentXml(result.value);
    expect(xml).toContain('xyz');
    expect(xml).toContain('Hello World');
  });
});

describe('docx export: comment ranges', () => {
  it('wraps a comment range spanning multiple text nodes only once (strictly nested)', async () => {
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
