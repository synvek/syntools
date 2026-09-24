import { describe, expect, it } from 'vitest';
import { ean13CheckDigit, generateBarcode } from './core';

describe('barcode EAN-13', () => {
  it('校验位计算', () => {
    expect(ean13CheckDigit('400638133393')).toBe(1);
    expect(ean13CheckDigit('123456789012')).toBe(8);
  });

  it('合法条码生成 SVG', () => {
    const r = generateBarcode('ean13', '4006381333931');
    expect(r.ok).toBe(true);
    if (r.ok) expect(r.value).toContain('<svg');
  });

  it('校验位错误报错', () => {
    expect(generateBarcode('ean13', '4006381333932')).toEqual({
      ok: false,
      error: 'INVALID_CHECKSUM',
    });
  });

  it('位数不足报错', () => {
    expect(generateBarcode('ean13', '123')).toEqual({ ok: false, error: 'INVALID_CHARS' });
  });
});

describe('barcode Code 39', () => {
  it('支持字母数字与常见符号', () => {
    const r = generateBarcode('code39', 'ABC-123');
    expect(r.ok).toBe(true);
    if (r.ok) expect(r.value).toContain('<svg');
  });

  it('非法字符报错', () => {
    expect(generateBarcode('code39', 'abc!')).toEqual({ ok: false, error: 'INVALID_CHARS' });
  });
});

describe('barcode Code 128', () => {
  it('生成 SVG', () => {
    const r = generateBarcode('code128', 'Hello-128');
    expect(r.ok).toBe(true);
    if (r.ok) expect(r.value).toContain('<rect');
  });
});

describe('barcode 通用', () => {
  it('空输入报错', () => {
    expect(generateBarcode('code128', '  ')).toEqual({ ok: false, error: 'EMPTY' });
  });
});
