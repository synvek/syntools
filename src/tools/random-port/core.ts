import type { ToolResult } from '@/core/types';

export interface PortOptions {
  count: number;
  min: number;
  max: number;
  unique: boolean;
  excludeSystem: boolean;
}

/** 常见服务占用端口（生成时可选排除） */
export const COMMON_PORTS = new Set([
  20, 21, 22, 23, 25, 53, 67, 68, 69, 80, 110, 119, 123, 143, 161, 194, 389, 443, 465, 514, 587,
  636, 873, 993, 995, 1433, 1521, 2049, 3306, 3389, 5432, 5672, 5900, 6379, 8080, 8443, 8888, 9000,
  9090, 9200, 11211, 27017,
]);

export function randomPorts(
  options: PortOptions,
  rand: () => number = Math.random,
): ToolResult<number[]> {
  const { count, unique, excludeSystem } = options;
  const min = Math.trunc(options.min);
  const max = Math.trunc(options.max);
  if (!Number.isInteger(count) || count < 1 || count > 500) {
    return { ok: false, error: 'INVALID_COUNT' };
  }
  if (!Number.isFinite(min) || !Number.isFinite(max) || min < 1 || max > 65535 || min > max) {
    return { ok: false, error: 'INVALID_RANGE' };
  }
  if (unique && count > max - min + 1) {
    return { ok: false, error: 'RANGE_TOO_SMALL' };
  }

  const out: number[] = [];
  const seen = new Set<number>();
  let guard = 0;
  while (out.length < count && guard < count * 100) {
    guard += 1;
    const port = min + Math.floor(rand() * (max - min + 1));
    if (excludeSystem && COMMON_PORTS.has(port)) continue;
    if (unique && seen.has(port)) continue;
    seen.add(port);
    out.push(port);
  }
  if (out.length < count) return { ok: false, error: 'RANGE_TOO_SMALL' };
  return { ok: true, value: out };
}

/** 私有网段随机 IPv4 */
export function randomPrivateIpv4(rand: () => number = Math.random): string {
  const blocks: Array<() => string> = [
    () => `10.${Math.floor(rand() * 256)}.${Math.floor(rand() * 256)}.${Math.floor(rand() * 256)}`,
    () => `192.168.${Math.floor(rand() * 256)}.${Math.floor(rand() * 256)}`,
    () =>
      `172.${16 + Math.floor(rand() * 16)}.${Math.floor(rand() * 256)}.${Math.floor(rand() * 256)}`,
  ];
  return blocks[Math.floor(rand() * blocks.length)]();
}

/** 随机 MAC（本地管理位为 1，避免与真实设备冲突） */
export function randomMac(rand: () => number = Math.random): string {
  const bytes = Array.from({ length: 6 }, () => Math.floor(rand() * 256));
  bytes[0] = (bytes[0] | 0x02) & ~0x01;
  return bytes.map((b) => b.toString(16).padStart(2, '0').toUpperCase()).join(':');
}

/** 随机 IPv6（fd00::/8 唯一本地地址） */
export function randomIpv6(rand: () => number = Math.random): string {
  const groups: string[] = ['fd00'];
  for (let i = 0; i < 7; i += 1) {
    groups.push(Math.floor(rand() * 0x10000).toString(16));
  }
  return groups.join(':');
}
