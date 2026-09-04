import { describe, expect, it } from 'vitest';
import { parseCidr } from './core';

describe('cidr-calc', () => {
  it('空输入 EMPTY', () => {
    expect(parseCidr('')).toEqual({ ok: false, error: 'EMPTY' });
  });

  it('非法格式 INVALID', () => {
    expect(parseCidr('192.168.1.1')).toEqual({ ok: false, error: 'INVALID' });
    expect(parseCidr('999.1.1.1/24')).toEqual({ ok: false, error: 'INVALID' });
    expect(parseCidr('10.0.0.0/33')).toEqual({ ok: false, error: 'INVALID' });
  });

  it('/24 计算正确', () => {
    const r = parseCidr('192.168.1.10/24');
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    expect(r.value.network).toBe('192.168.1.0');
    expect(r.value.broadcast).toBe('192.168.1.255');
    expect(r.value.firstHost).toBe('192.168.1.1');
    expect(r.value.lastHost).toBe('192.168.1.254');
    expect(r.value.netmask).toBe('255.255.255.0');
    expect(r.value.hostCount).toBe(254);
  });

  it('/32 无主机', () => {
    const r = parseCidr('10.0.0.1/32');
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    expect(r.value.hostCount).toBe(0);
    expect(r.value.network).toBe('10.0.0.1');
  });

  it('/0 全网', () => {
    const r = parseCidr('0.0.0.0/0');
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    expect(r.value.totalAddresses).toBe(2 ** 32);
  });
});
