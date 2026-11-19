import { describe, expect, it } from 'vitest';
import { contentWidthPx, decodeImageDataUrl, fitImageSize } from './build';
import { escapeHtml, htmlToDocxBlocks } from './html';
import { DEFAULT_DOCX_PAGE_SETUP } from './types';

const PNG_1PX =
  'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==';

describe('htmlToDocxBlocks', () => {
  it('识别 H1–H6 与段落', () => {
    const blocks = htmlToDocxBlocks('<h1>标题</h1><h3>Sub</h3><p>正文</p>');
    expect(blocks).toEqual([
      { type: 'heading', level: 1, text: '标题' },
      { type: 'heading', level: 3, text: 'Sub' },
      { type: 'paragraph', text: '正文', align: undefined },
    ]);
  });

  it('折叠空白、还原 &nbsp; 与 <br>', () => {
    const blocks = htmlToDocxBlocks('<p>  第一行<br>第二&nbsp;行  </p>');
    expect(blocks[0]).toMatchObject({ type: 'paragraph', text: '第一行\n第二 行' });
  });

  it('保留段落对齐', () => {
    const blocks = htmlToDocxBlocks(
      '<p style="text-align: center">居中</p><p align="right">右</p>',
    );
    expect(blocks[0]).toMatchObject({ align: 'center' });
    expect(blocks[1]).toMatchObject({ align: 'right' });
  });

  it('无序/有序列表各成为一块', () => {
    const blocks = htmlToDocxBlocks('<ul><li>甲</li><li>乙</li></ul><ol><li>一</li></ol>');
    expect(blocks).toEqual([
      { type: 'list', ordered: false, items: ['甲', '乙'] },
      { type: 'list', ordered: true, items: ['一'] },
    ]);
  });

  it('表格按行列读取，空行被丢弃', () => {
    const blocks = htmlToDocxBlocks(
      '<table><tr><th>A</th><th>B</th></tr><tr><td>1</td><td>2</td></tr><tr><td></td><td></td></tr></table>',
    );
    expect(blocks).toEqual([
      {
        type: 'table',
        rows: [
          ['A', 'B'],
          ['1', '2'],
        ],
      },
    ]);
  });

  it('图片单独成块并带上像素尺寸', () => {
    const blocks = htmlToDocxBlocks(
      `<p><img src="${PNG_1PX}" width="600" height="800" alt=""></p><img src="${PNG_1PX}">`,
    );
    expect(blocks[0]).toEqual({ type: 'image', src: PNG_1PX, widthPx: 600, heightPx: 800 });
    expect(blocks[1]).toMatchObject({ type: 'image', widthPx: 0, heightPx: 0 });
  });

  it('hr 视为分页，嵌套容器会被展开', () => {
    const blocks = htmlToDocxBlocks('<div><section><p>内</p></section></div><hr><p>次页</p>');
    expect(blocks).toEqual([
      { type: 'paragraph', text: '内', align: undefined },
      { type: 'pageBreak' },
      { type: 'paragraph', text: '次页', align: undefined },
    ]);
  });

  it('空 HTML 返回空数组', () => {
    expect(htmlToDocxBlocks('')).toEqual([]);
  });
});

describe('escapeHtml', () => {
  it('转义五个 HTML 元字符', () => {
    expect(escapeHtml(`<a href="x">'&'</a>`)).toBe(
      '&lt;a href=&quot;x&quot;&gt;&#39;&amp;&#39;&lt;/a&gt;',
    );
  });
});

describe('decodeImageDataUrl', () => {
  it('解码 PNG data URL', () => {
    const decoded = decodeImageDataUrl(PNG_1PX);
    expect(decoded?.type).toBe('png');
    expect(decoded?.data.byteLength).toBeGreaterThan(0);
  });

  it('识别 jpeg，拒绝外链与非图片', () => {
    expect(decodeImageDataUrl('data:image/jpeg;base64,AAAA')?.type).toBe('jpg');
    expect(decodeImageDataUrl('https://example.com/a.png')).toBeNull();
    expect(decodeImageDataUrl('data:text/plain;base64,AAAA')).toBeNull();
    expect(decodeImageDataUrl('data:image/png;base64,***')).toBeNull();
  });
});

describe('fitImageSize / contentWidthPx', () => {
  it('超宽图按比例缩到内容宽', () => {
    const fitted = fitImageSize(1240, 1754, 620);
    expect(fitted.width).toBe(620);
    expect(fitted.height).toBe(877);
  });

  it('窄图保持原尺寸', () => {
    expect(fitImageSize(400, 300, 620)).toEqual({ width: 400, height: 300 });
  });

  it('缺少尺寸时使用内容宽与 4:3 兜底', () => {
    const fitted = fitImageSize(0, 0, 600);
    expect(fitted).toEqual({ width: 600, height: 450 });
  });

  it('内容宽按 A4 与 25mm 边距计算', () => {
    expect(contentWidthPx(DEFAULT_DOCX_PAGE_SETUP)).toBe(Math.round((160 / 25.4) * 96));
  });
});
