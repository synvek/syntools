import JSZip from 'jszip';
import { describe, expect, it } from 'vitest';
import { CONTENT_WIDTH_PX, planPageBlocks, scanDocxExportLosses } from './core';
import { exportDocxBlob } from './docx';

/** docx 导出层测试：嵌套列表 / 合并单元格 / 丢失清单 / 分页符（jsdom 环境） */

// jsdom 的 Blob 没有 arrayBuffer()，用 FileReader 读二进制
const blobToArrayBuffer = (blob: Blob): Promise<ArrayBuffer> =>
  new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result as ArrayBuffer);
    reader.onerror = () => reject(reader.error);
    reader.readAsArrayBuffer(blob);
  });

/** 读取导出文档的 word/document.xml */
async function readDocumentXml(blob: Blob): Promise<string> {
  const zip = await JSZip.loadAsync(await blobToArrayBuffer(blob));
  return (await zip.file('word/document.xml')?.async('string')) ?? '';
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
