import { describe, expect, it } from 'vitest';
import { createDoc, createTableElement, createTextElement } from './factory';
import { countMatches, findInDoc, replaceAllInText, replaceInDoc } from './search';
import type { SlideDoc, TableElement, TextElement } from './types';

function docWithText(): SlideDoc {
  const doc = createDoc('search');
  const first = createTextElement(doc, '季度营收报告') as TextElement;
  const second = createTextElement(doc, '营收同比增长 20%') as TextElement;
  doc.slides[0].elements = [first, second];
  doc.slides[0].notes = '营收口径见附录';
  const table = createTableElement(doc, 1, 2) as TableElement;
  table.rows[0][0].text = '营收';
  table.rows[0][1].text = '成本';
  doc.slides.push({ id: 'slide-2', elements: [table] });
  return doc;
}

describe('查找', () => {
  it('跨页统计命中次数（含表格与备注）', () => {
    const doc = docWithText();
    expect(countMatches(doc, '营收', { includeNotes: true })).toBe(4);
    // 不含备注时少一处
    expect(countMatches(doc, '营收')).toBe(3);
  });

  it('列出命中位置，便于逐处跳转', () => {
    const doc = docWithText();
    const hits = findInDoc(doc, '营收');
    expect(hits.map((hit) => hit.slideIndex)).toEqual([0, 0, 1]);
    expect(hits[2]!.scope).toBe('table');
    expect(hits[2]!.cell).toEqual({ row: 0, col: 0 });
  });

  it('空查询返回空结果', () => {
    const doc = docWithText();
    expect(countMatches(doc, '   ')).toBe(0);
    expect(findInDoc(doc, '')).toEqual([]);
  });

  it('区分大小写开关生效', () => {
    const doc = createDoc('case');
    doc.slides[0].elements = [createTextElement(doc, 'Alpha alpha')];
    expect(countMatches(doc, 'alpha')).toBe(2);
    expect(countMatches(doc, 'alpha', { matchCase: true })).toBe(1);
  });
});

describe('替换', () => {
  it('按字面量替换，正则元字符不会被当成模式', () => {
    expect(replaceAllInText('a.b a.b', 'a.b', 'X', true)).toBe('X X');
    expect(replaceAllInText('a1b a2b', 'a.b', 'X', true)).toBe('a1b a2b');
  });

  it('大小写不敏感替换保留原位', () => {
    expect(replaceAllInText('Alpha alpha', 'alpha', 'β', false)).toBe('β β');
  });

  it('替换文档正文、表格与备注，并保留样式字段', () => {
    const doc = docWithText();
    const first = doc.slides[0].elements[0] as TextElement;
    first.body.paragraphs[0]!.runs[0]!.style = { bold: true };

    const next = replaceInDoc(doc, '营收', '收入', { includeNotes: true });
    expect(next).not.toBe(doc);

    const nextFirst = next.slides[0].elements[0] as TextElement;
    expect(nextFirst.body.paragraphs[0]!.runs[0]!.text).toBe('季度收入报告');
    expect(nextFirst.body.paragraphs[0]!.runs[0]!.style).toEqual({ bold: true });

    const nextTable = next.slides[1].elements[0] as TableElement;
    expect(nextTable.rows[0][0].text).toBe('收入');
    expect(next.slides[0].notes).toBe('收入口径见附录');
    // 未命中的部分保持原引用
    expect(next.slides[1].elements[0]).not.toBe(doc.slides[1].elements[0]);
    expect(doc.slides[0].notes).toBe('营收口径见附录');
  });

  it('无命中时返回原文档引用（不制造无效撤销点）', () => {
    const doc = docWithText();
    expect(replaceInDoc(doc, '不存在的词', 'X')).toBe(doc);
  });

  it('替换后 version 自增以失效缩略图缓存', () => {
    const doc = docWithText();
    const next = replaceInDoc(doc, '营收', '收入');
    expect(next.version).toBe(doc.version + 1);
  });
});
