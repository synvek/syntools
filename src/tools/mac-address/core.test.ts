import { describe, expect, it } from 'vitest';
import { analyzeMac, generateMacs, parseMac } from './core';

describe('parseMac', () => {
  it('解析四种常见写法', () => {
    expect(parseMac('00:1A:2B:3C:4D:5E').ok).toBe(true);
    expect(parseMac('00-1A-2B-3C-4D-5E').ok).toBe(true);
    expect(parseMac('001A.2B3C.4D5E').ok).toBe(true);
    expect(parseMac('001A2B3C4D5E').ok).toBe(true);
  });

  it('拒绝非法输入', () => {
    expect(parseMac('')).toEqual({ ok: false, error: 'EMPTY' });
    expect(parseMac('00:1A:2B')).toEqual({ ok: false, error: 'INVALID' });
    expect(parseMac('ZZ:1A:2B:3C:4D:5E')).toEqual({ ok: false, error: 'INVALID' });
  });
});

describe('analyzeMac', () => {
  it('输出格式化变体与标志位', () => {
    const result = analyzeMac('00:1a:2b:3c:4d:5e');
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.value.normalized).toBe('00:1A:2B:3C:4D:5E');
    expect(result.value.hyphen).toBe('00-1A-2B-3C-4D-5E');
    expect(result.value.dot).toBe('001a.2b3c.4d5e');
    expect(result.value.bare).toBe('001A2B3C4D5E');
    expect(result.value.isMulticast).toBe(false);
    expect(result.value.isLocallyAdministered).toBe(false);
    expect(result.value.oui).toBe('00-1A-2B');
  });

  it('识别组播与本地管理位', () => {
    const multicast = analyzeMac('01:00:5e:00:00:01');
    expect(multicast.ok && multicast.value.isMulticast).toBe(true);
    const local = analyzeMac('02:1a:2b:3c:4d:5e');
    expect(local.ok && local.value.isLocallyAdministered).toBe(true);
    const broadcast = analyzeMac('ff:ff:ff:ff:ff:ff');
    expect(broadcast.ok && broadcast.value.isBroadcast).toBe(true);
  });

  it('生成 EUI-64 与链路本地地址', () => {
    const result = analyzeMac('00:1a:2b:3c:4d:5e');
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    // U/L 位翻转后首字节为 02
    expect(result.value.eui64.startsWith('02:1a:2b:ff:fe:3c:4d:5e')).toBe(true);
    expect(result.value.linkLocal.startsWith('fe80:0:0:0:21a:2bff:fe3c:4d5e')).toBe(true);
  });

  it('查询内置 OUI 厂商', () => {
    const vmware = analyzeMac('00:0c:29:11:22:33');
    expect(vmware.ok && vmware.value.vendor).toBe('VMware');
    const unknown = analyzeMac('ab:cd:ef:11:22:33');
    expect(unknown.ok && unknown.value.vendor).toBeNull();
  });
});

describe('generateMacs', () => {
  it('按数量与分隔符生成', () => {
    const result = generateMacs(
      { count: 3, separator: ':', upper: true, locallyAdministered: true, multicast: false },
      () => 0.5,
    );
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.value).toHaveLength(3);
    for (const mac of result.value) {
      expect(mac).toMatch(/^[0-9A-F]{2}(:[0-9A-F]{2}){5}$/);
      // 本地管理位置 1、组播位清零
      expect(parseInt(mac.slice(0, 2), 16) & 0x02).toBe(2);
      expect(parseInt(mac.slice(0, 2), 16) & 0x01).toBe(0);
    }
  });

  it('拒绝非法数量', () => {
    expect(
      generateMacs(
        { count: 0, separator: ':', upper: false, locallyAdministered: false, multicast: false },
        Math.random,
      ),
    ).toEqual({ ok: false, error: 'INVALID_COUNT' });
  });
});
