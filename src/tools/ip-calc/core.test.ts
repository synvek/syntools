import { describe, expect, it } from 'vitest';
import { parseIpQuery, splitSubnets } from './core';

describe('parseIpQuery', () => {
  it('计算 IPv4 CIDR 的核心字段', () => {
    const result = parseIpQuery('192.168.1.100/24');
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.value.address).toBe('192.168.1.100');
    expect(result.value.network).toBe('192.168.1.0');
    expect(result.value.lastAddress).toBe('192.168.1.255');
    expect(result.value.firstHost).toBe('192.168.1.1');
    expect(result.value.lastHost).toBe('192.168.1.254');
    expect(result.value.netmask).toBe('255.255.255.0');
    expect(result.value.wildcard).toBe('0.0.0.255');
    expect(result.value.total).toBe('256');
    expect(result.value.usable).toBe('254');
    expect(result.value.decimal).toBe('3232235876');
  });

  it('不带前缀时按 /32 处理', () => {
    const result = parseIpQuery('8.8.8.8');
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.value.prefix).toBe(32);
    expect(result.value.total).toBe('1');
    expect(result.value.usable).toBe('1');
  });

  it('支持 IPv6 与压缩写法', () => {
    const result = parseIpQuery('2001:db8::1/64');
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.value.version).toBe(6);
    expect(result.value.network).toBe('2001:db8::');
    expect(result.value.netmask).toBe('ffff:ffff:ffff:ffff::');
    expect(result.value.total).toBe((2n ** 64n).toString());
  });

  it('识别内嵌 IPv4 的 IPv6', () => {
    const result = parseIpQuery('::ffff:192.168.0.1');
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.value.address).toBe('::ffff:c0a8:1');
  });

  it('拒绝非法输入', () => {
    expect(parseIpQuery('')).toEqual({ ok: false, error: 'EMPTY' });
    expect(parseIpQuery('999.1.1.1')).toEqual({ ok: false, error: 'INVALID_ADDRESS' });
    expect(parseIpQuery('10.0.0.1/33')).toEqual({ ok: false, error: 'INVALID_PREFIX' });
    expect(parseIpQuery('1::2::3')).toEqual({ ok: false, error: 'INVALID_ADDRESS' });
  });

  it('/31 与 /32 按点对点规则计算', () => {
    const p31 = parseIpQuery('10.0.0.0/31');
    expect(p31.ok && p31.value.usable).toBe('2');
    const p32 = parseIpQuery('10.0.0.1/32');
    expect(p32.ok && p32.value.usable).toBe('1');
  });
});

describe('splitSubnets', () => {
  it('等长切分子网', () => {
    const result = splitSubnets('192.168.1.0/24', 26);
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.value).toEqual([
      '192.168.1.0/26',
      '192.168.1.64/26',
      '192.168.1.128/26',
      '192.168.1.192/26',
    ]);
  });

  it('拒绝非法目标前缀与超量子网', () => {
    expect(splitSubnets('192.168.1.0/24', 20)).toEqual({
      ok: false,
      error: 'INVALID_SPLIT_PREFIX',
    });
    expect(splitSubnets('10.0.0.0/8', 24).ok).toBe(false);
    expect(parseIpQuery('bad').ok).toBe(false);
  });
});
