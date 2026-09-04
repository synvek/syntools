import { describe, expect, it } from 'vitest';
import { processLines } from './core';

describe('text-lines', () => {
  it('空输入 EMPTY', () => {
    expect(processLines('', 'sort-asc')).toEqual({ ok: false, error: 'EMPTY' });
  });

  it('升序排序', () => {
    expect(processLines('b\na\nc', 'sort-asc')).toEqual({ ok: true, value: 'a\nb\nc' });
  });

  it('降序排序', () => {
    expect(processLines('a\nc\nb', 'sort-desc')).toEqual({ ok: true, value: 'c\nb\na' });
  });

  it('去重保持顺序', () => {
    expect(processLines('a\nb\na\nc', 'unique')).toEqual({ ok: true, value: 'a\nb\nc' });
  });

  it('反转与编号与去空行', () => {
    expect(processLines('a\nb', 'reverse')).toEqual({ ok: true, value: 'b\na' });
    expect(processLines('a\nb', 'number')).toEqual({ ok: true, value: '1. a\n2. b' });
    expect(processLines('a\n\n b \n', 'trim-empty')).toEqual({ ok: true, value: 'a\n b ' });
  });
});
