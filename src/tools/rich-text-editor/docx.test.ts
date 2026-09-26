import { describe, expect, it } from 'vitest';
import { planPageBlocks, scanDocxExportLosses } from './core';
import { exportDocxBlob } from './docx';

/** docx 导出层测试：嵌套列表 / 合并单元格 / 丢失清单 / 分页符（jsdom 环境） */

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
