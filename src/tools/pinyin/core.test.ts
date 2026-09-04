import { describe, expect, it } from 'vitest';
import { convertPinyin } from './core';

describe('pinyin', () => {
  it('转拼音小写空格（无声调）', () => {
    const r = convertPinyin('中文', { separator: 'space', letterCase: 'lower', tone: false });
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    expect(r.value.toLowerCase()).toBe('zhong wen');
  });

  it('启用声调输出符号标调', () => {
    const r = convertPinyin('中文', { separator: 'space', letterCase: 'lower', tone: true });
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    expect(r.value).toBe('zhōng wén');
  });

  it('无分隔大写', () => {
    const r = convertPinyin('中文', { separator: 'none', letterCase: 'upper', tone: false });
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    expect(r.value).toBe('ZHONGWEN');
  });

  it('空输入', () => {
    expect(convertPinyin('')).toEqual({ ok: false, error: 'EMPTY' });
  });
});
