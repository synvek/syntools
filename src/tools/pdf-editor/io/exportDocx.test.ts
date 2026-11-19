import { describe, expect, it } from 'vitest';
import { chooseDocxPageModes, docxFileName, imagePageHtml, joinDocxPages } from './exportDocx';

describe('chooseDocxPageModes', () => {
  it('文本模式从不栅格化，无文本页由 fidelity 报告说明', () => {
    expect(chooseDocxPageModes('text', [12, 0, 3])).toEqual(['text', 'text', 'text']);
  });

  it('栅格模式全部出图', () => {
    expect(chooseDocxPageModes('raster', [12, 0, 3])).toEqual(['image', 'image', 'image']);
  });

  it('混合模式只把扫描页出图', () => {
    expect(chooseDocxPageModes('mixed', [12, 0, 3, 0])).toEqual(['text', 'image', 'text', 'image']);
  });
});

describe('joinDocxPages / imagePageHtml', () => {
  it('页面之间插入 hr（docx 分页）', () => {
    expect(joinDocxPages(['<p>a</p>', '<p>b</p>'])).toBe('<p>a</p>\n<hr>\n<p>b</p>');
  });

  it('图片尺寸取整并带上宽高属性', () => {
    const html = imagePageHtml('data:image/jpeg;base64,AAAA', 1240.4, 1754.6);
    expect(html).toContain('width="1240"');
    expect(html).toContain('height="1755"');
    expect(html).toContain('src="data:image/jpeg;base64,AAAA"');
  });
});

describe('docxFileName', () => {
  it('去掉 .pdf 并补 .docx', () => {
    expect(docxFileName('report.pdf')).toBe('report.docx');
    expect(docxFileName('a.b.PDF')).toBe('a.b.docx');
    expect(docxFileName('.pdf')).toBe('document.docx');
  });
});
