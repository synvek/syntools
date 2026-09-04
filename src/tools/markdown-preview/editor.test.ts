import { describe, expect, it } from 'vitest';
import { applyMarkdownAction } from './editor';

describe('applyMarkdownAction', () => {
  it('加粗包裹选区', () => {
    const r = applyMarkdownAction('hello world', 6, 11, 'bold');
    expect(r.text).toBe('hello **world**');
    expect(r.selectionStart).toBe(8);
    expect(r.selectionEnd).toBe(13);
  });

  it('无选区时插入占位并选中', () => {
    const r = applyMarkdownAction('ab', 1, 1, 'italic');
    expect(r.text).toBe('a*italic*b');
    expect(r.text.slice(r.selectionStart, r.selectionEnd)).toBe('italic');
  });

  it('H1–H6 设置对应层级', () => {
    expect(applyMarkdownAction('title', 0, 5, 'h1').text).toBe('# title');
    expect(applyMarkdownAction('title', 0, 5, 'h2').text).toBe('## title');
    expect(applyMarkdownAction('title', 0, 5, 'h3').text).toBe('### title');
    expect(applyMarkdownAction('# title', 0, 7, 'h4').text).toBe('#### title');
    expect(applyMarkdownAction('## title', 0, 8, 'h5').text).toBe('##### title');
    expect(applyMarkdownAction('title', 0, 5, 'h6').text).toBe('###### title');
  });

  it('无序列表前缀', () => {
    const r = applyMarkdownAction('a\nb', 0, 3, 'ul');
    expect(r.text).toBe('- a\n- b');
  });

  it('有序列表编号', () => {
    const r = applyMarkdownAction('a\nb', 0, 3, 'ol');
    expect(r.text).toBe('1. a\n2. b');
  });

  it('链接选中 URL 部分', () => {
    const r = applyMarkdownAction('docs', 0, 4, 'link');
    expect(r.text).toBe('[docs](https://)');
    expect(r.text.slice(r.selectionStart, r.selectionEnd)).toBe('https://');
  });

  it('代码块包裹', () => {
    const r = applyMarkdownAction('x', 0, 1, 'codeBlock');
    expect(r.text).toBe('```\nx\n```');
  });

  it('表格插入', () => {
    const r = applyMarkdownAction('', 0, 0, 'table');
    expect(r.text).toContain('| Column 1 | Column 2 |');
    expect(r.text).toContain('| -------- | -------- |');
  });
});
