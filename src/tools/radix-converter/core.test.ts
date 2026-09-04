import { describe, expect, it } from 'vitest';
import {
  applyBitOperator,
  BIT_OPERATORS,
  detectRadix,
  formatRadix,
  groupBits,
  parseInteger,
  RADIXES,
  toBitPattern,
} from './core';

const MIN_I64 = -(2n ** 63n);
const MAX_I64 = 2n ** 63n - 1n;

const ok = (input: string, radix: 2 | 8 | 10 | 16): bigint => {
  const result = parseInteger(input, radix);
  expect(result.ok).toBe(true);
  return result.ok ? result.value : 0n;
};

describe('detectRadix', () => {
  it('前缀识别：0b/0o/0x，默认十进制', () => {
    expect(detectRadix('0b1010')).toBe(2);
    expect(detectRadix('0O17')).toBe(8);
    expect(detectRadix('0xff')).toBe(16);
    expect(detectRadix('42')).toBe(10);
    expect(detectRadix('  0X1A  ')).toBe(16);
  });
});

describe('parseInteger', () => {
  it('各进制解析（含前缀、负号、分隔符）', () => {
    expect(ok('255', 10)).toBe(255n);
    expect(ok('ff', 16)).toBe(255n);
    expect(ok('0xFF', 16)).toBe(255n);
    expect(ok('-42', 10)).toBe(-42n);
    expect(ok('-0x1f', 16)).toBe(-31n);
    expect(ok('1111_0000', 2)).toBe(240n);
    expect(ok('1,000', 10)).toBe(1000n);
    expect(ok('+7', 8)).toBe(7n);
  });

  it('i64 边界值可解析', () => {
    expect(ok('9223372036854775807', 10)).toBe(MAX_I64);
    expect(ok('-9223372036854775808', 10)).toBe(MIN_I64);
  });

  it('空输入返回 EMPTY', () => {
    expect(parseInteger('', 10)).toEqual({ ok: false, error: 'EMPTY' });
    expect(parseInteger('  ', 10)).toEqual({ ok: false, error: 'EMPTY' });
  });

  it('非法数字返回 INVALID', () => {
    expect(parseInteger('abc', 10)).toEqual({ ok: false, error: 'INVALID' });
    expect(parseInteger('2', 2)).toEqual({ ok: false, error: 'INVALID' });
    expect(parseInteger('8', 8)).toEqual({ ok: false, error: 'INVALID' });
    expect(parseInteger('-', 10)).toEqual({ ok: false, error: 'INVALID' });
    expect(parseInteger('1.5', 10)).toEqual({ ok: false, error: 'INVALID' });
  });

  it('前缀与所选进制不一致返回 INVALID', () => {
    expect(parseInteger('0x10', 2)).toEqual({ ok: false, error: 'INVALID' });
    expect(parseInteger('0b101', 10)).toEqual({ ok: false, error: 'INVALID' });
  });

  it('超出 i64 返回 RANGE', () => {
    expect(parseInteger('9223372036854775808', 10)).toEqual({ ok: false, error: 'RANGE' });
    expect(parseInteger('-9223372036854775809', 10)).toEqual({ ok: false, error: 'RANGE' });
  });
});

describe('formatRadix', () => {
  it('正数四种进制输出', () => {
    expect(formatRadix(255n)).toEqual({
      bin: '11111111',
      oct: '377',
      dec: '255',
      hex: 'FF',
    });
  });

  it('负数带符号、零值', () => {
    expect(formatRadix(-1n)).toEqual({ bin: '-1', oct: '-1', dec: '-1', hex: '-1' });
    expect(formatRadix(0n)).toEqual({ bin: '0', oct: '0', dec: '0', hex: '0' });
  });
});

describe('toBitPattern / groupBits', () => {
  it('64 位补码：-1 全为 1，1 为末位', () => {
    expect(toBitPattern(-1n)).toBe('1'.repeat(64));
    expect(toBitPattern(1n)).toBe('0'.repeat(63) + '1');
    expect(toBitPattern(MIN_I64)).toBe('1' + '0'.repeat(63));
    expect(toBitPattern(0n).length).toBe(64);
  });

  it('按 4 位分组', () => {
    expect(groupBits('11110000')).toBe('1111 0000');
    expect(groupBits('101')).toBe('101');
    expect(groupBits('1'.repeat(64)).split(' ')).toHaveLength(16);
  });
});

describe('applyBitOperator', () => {
  it('and / or / xor', () => {
    expect(applyBitOperator('and', 0b1100n, 0b1010n)).toEqual({ ok: true, value: 0b1000n });
    expect(applyBitOperator('or', 0b1100n, 0b1010n)).toEqual({ ok: true, value: 0b1110n });
    expect(applyBitOperator('xor', 0b1100n, 0b1010n)).toEqual({ ok: true, value: 0b0110n });
  });

  it('not：~5 = -6，~-1 = 0', () => {
    expect(applyBitOperator('not', 5n)).toEqual({ ok: true, value: -6n });
    expect(applyBitOperator('not', -1n)).toEqual({ ok: true, value: 0n });
  });

  it('shl：正常与 64 位溢出回绕', () => {
    expect(applyBitOperator('shl', 1n, 3n)).toEqual({ ok: true, value: 8n });
    expect(applyBitOperator('shl', 1n, 63n)).toEqual({ ok: true, value: MIN_I64 });
    expect(applyBitOperator('shl', -1n, 1n)).toEqual({ ok: true, value: -2n });
    // 移位量对 64 取模
    expect(applyBitOperator('shl', 5n, 64n)).toEqual({ ok: true, value: 5n });
  });

  it('shr：算术右移保留符号', () => {
    expect(applyBitOperator('shr', 8n, 3n)).toEqual({ ok: true, value: 1n });
    expect(applyBitOperator('shr', -8n, 1n)).toEqual({ ok: true, value: -4n });
    expect(applyBitOperator('shr', -1n, 63n)).toEqual({ ok: true, value: -1n });
  });

  it('二元运算缺少操作数返回 INVALID', () => {
    expect(applyBitOperator('and', 1n)).toEqual({ ok: false, error: 'INVALID' });
    expect(applyBitOperator('shl', 1n)).toEqual({ ok: false, error: 'INVALID' });
  });

  it('运算符白名单', () => {
    expect(BIT_OPERATORS).toEqual(['and', 'or', 'xor', 'shl', 'shr', 'not']);
    expect(RADIXES).toEqual([2, 8, 10, 16]);
  });
});
