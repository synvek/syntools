import { describe, expect, it } from 'vitest';
import { decodeMorse, encodeMorse } from './core';

describe('morse code', () => {
  it('编码 SOS 为 ... --- ...', () => {
    expect(encodeMorse('SOS')).toBe('... --- ...');
  });

  it('多词用 / 分隔', () => {
    expect(encodeMorse('HI YOU')).toBe('.... .. / -.-- --- ..-');
  });

  it('解码还原', () => {
    expect(decodeMorse('... --- ...').ok).toBe(true);
    const r = decodeMorse('.... .. / -.-- --- ..-');
    expect(r).toEqual({ ok: true, value: 'HI YOU' });
  });

  it('非法符号报错', () => {
    expect(decodeMorse('... @@@')).toEqual({ ok: false, error: 'INVALID' });
  });
});
