import { describe, expect, it } from 'vitest';
import { COMMON_PORTS, randomIpv6, randomMac, randomPorts, randomPrivateIpv4 } from './core';

/** 线性同余伪随机，保证测试可复现 */
function seeded(seed: number): () => number {
  let state = seed;
  return () => {
    state = (state * 1103515245 + 12345) % 2147483648;
    return state / 2147483648;
  };
}

const base = { count: 5, min: 1, max: 65535, unique: true, excludeSystem: false };

describe('randomPorts', () => {
  it('生成范围内端口', () => {
    const result = randomPorts(base, seeded(7));
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.value).toHaveLength(5);
    for (const port of result.value) {
      expect(port).toBeGreaterThanOrEqual(1);
      expect(port).toBeLessThanOrEqual(65535);
    }
  });

  it('unique 保证不重复', () => {
    const result = randomPorts({ ...base, count: 20, min: 1000, max: 1100 }, seeded(11));
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(new Set(result.value).size).toBe(20);
  });

  it('excludeSystem 跳过常见端口', () => {
    const result = randomPorts(
      { count: 30, min: 8000, max: 8100, unique: true, excludeSystem: true },
      seeded(3),
    );
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    for (const port of result.value) expect(COMMON_PORTS.has(port)).toBe(false);
  });

  it('范围不足以去重时报错', () => {
    expect(randomPorts({ ...base, count: 10, min: 100, max: 105 }, seeded(5))).toEqual({
      ok: false,
      error: 'RANGE_TOO_SMALL',
    });
  });

  it('校验参数', () => {
    expect(randomPorts({ ...base, count: 0 }, seeded(1))).toEqual({
      ok: false,
      error: 'INVALID_COUNT',
    });
    expect(randomPorts({ ...base, min: 0, max: 100 }, seeded(1))).toEqual({
      ok: false,
      error: 'INVALID_RANGE',
    });
    expect(randomPorts({ ...base, min: 500, max: 100 }, seeded(1))).toEqual({
      ok: false,
      error: 'INVALID_RANGE',
    });
  });
});

describe('随机网络标识', () => {
  it('私有 IPv4 落在 RFC1918 网段', () => {
    for (let i = 0; i < 20; i += 1) {
      const ip = randomPrivateIpv4(seeded(i + 1));
      expect(
        ip.startsWith('10.') || ip.startsWith('192.168.') || /^172\.(1[6-9]|2\d|3[01])\./.test(ip),
      ).toBe(true);
    }
  });

  it('MAC 为本地管理单播', () => {
    const mac = randomMac(seeded(9));
    expect(mac).toMatch(/^[0-9A-F]{2}(:[0-9A-F]{2}){5}$/);
    const first = parseInt(mac.slice(0, 2), 16);
    expect(first & 0x02).toBe(2);
    expect(first & 0x01).toBe(0);
  });

  it('IPv6 使用 fd00::/8 唯一本地地址', () => {
    const ip = randomIpv6(seeded(13));
    expect(ip.startsWith('fd00:')).toBe(true);
    expect(ip.split(':')).toHaveLength(8);
  });
});
