import { describe, expect, it } from 'vitest';
import { rescueGarbled } from './core';

describe('rescueGarbled', () => {
  it('还原 GBK 被误读为 Latin1 的乱码', () => {
    // '中文' 的 GBK 字节（D6D0 CEC4）被当作 Latin1 解读得到的乱码字符串
    const garbled = String.fromCharCode(0xd6, 0xd0, 0xce, 0xc4);
    const result = rescueGarbled(garbled);
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    const hit = result.value.find((c) => c.text === '中文');
    expect(hit).toBeDefined();
    expect(hit?.encoding).toBe('gbk');
  });

  it('空输入报错', () => {
    expect(rescueGarbled('   ')).toEqual({ ok: false, error: 'EMPTY' });
  });

  it('纯 ASCII 无可恢复候选', () => {
    expect(rescueGarbled('hello world').ok).toBe(false);
  });
});
