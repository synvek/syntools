import { describe, expect, it } from 'vitest';
import { cellAddress, parseCellInput } from './cellEdit';

describe('cellAddress', () => {
  it('0-based 行列 → A1 记法', () => {
    expect(cellAddress(0, 0)).toBe('A1');
    expect(cellAddress(2, 1)).toBe('B3');
    expect(cellAddress(9, 26)).toBe('AA10');
  });
});

describe('parseCellInput', () => {
  it('空串 = 清空这一格', () => {
    expect(parseCellInput('')).toEqual({ kind: 'clear' });
  });

  it('= 开头写成公式，原样保留（含 = 本身）', () => {
    expect(parseCellInput('=SUM(A1:A2)')).toEqual({
      kind: 'formula',
      formula: '=SUM(A1:A2)',
    });
  });

  it('只有一个 = 时按文本写入（不制造非法公式）', () => {
    expect(parseCellInput('=')).toEqual({ kind: 'text', value: '=' });
  });

  it('未装饰的十进制数写成数值', () => {
    expect(parseCellInput('42')).toEqual({ kind: 'number', value: 42 });
    expect(parseCellInput('-3.5')).toEqual({ kind: 'number', value: -3.5 });
    expect(parseCellInput('0')).toEqual({ kind: 'number', value: 0 });
  });

  it('带前导零 / 千分位 / 科学计数 / 百分号一律按文本（不猜用户的数据）', () => {
    for (const text of ['007', '1,234', '1e3', '50%', ' 42', '42 ', '1.', '.5']) {
      expect(parseCellInput(text)).toEqual({ kind: 'text', value: text });
    }
  });

  it('普通字符串原样保留，不做 trim', () => {
    expect(parseCellInput(' 华东 ')).toEqual({ kind: 'text', value: ' 华东 ' });
  });
});
