import type { ToolResult } from '@/core/types';

export type IpVersion = 4 | 6;

export interface IpInfo {
  version: IpVersion;
  address: string;
  prefix: number;
  cidr: string;
  network: string;
  lastAddress: string;
  firstHost: string;
  lastHost: string;
  netmask: string;
  wildcard: string;
  total: string;
  usable: string;
  decimal: string;
  hex: string;
  binary: string;
}

const V4_BITS = 32n;
const V6_BITS = 128n;

function parseIpv4(input: string): bigint | null {
  const parts = input.split('.');
  if (parts.length !== 4) return null;
  let n = 0n;
  for (const part of parts) {
    if (!/^(0|[1-9]\d{0,2})$/.test(part)) return null;
    const v = Number(part);
    if (v > 255) return null;
    n = (n << 8n) | BigInt(v);
  }
  return n;
}

function formatIpv4(n: bigint): string {
  return [24n, 16n, 8n, 0n].map((shift) => String((n >> shift) & 0xffn)).join('.');
}

/** 展开 IPv6（支持 :: 压缩与内嵌 IPv4），返回 128 位整数 */
function parseIpv6(input: string): bigint | null {
  let ip = input.trim();
  if (!ip) return null;

  const lastColon = ip.lastIndexOf(':');
  if (lastColon >= 0 && ip.slice(lastColon + 1).includes('.')) {
    const v4 = parseIpv4(ip.slice(lastColon + 1));
    if (v4 === null) return null;
    const hi = (v4 >> 16n) & 0xffffn;
    const lo = v4 & 0xffffn;
    ip = `${ip.slice(0, lastColon + 1)}${hi.toString(16)}:${lo.toString(16)}`;
  }
  if (ip.includes(':::')) return null;

  const halves = ip.split('::');
  if (halves.length > 2) return null;

  const toGroups = (s: string): string[] | null => {
    if (s === '') return [];
    const groups = s.split(':');
    for (const g of groups) {
      if (!/^[0-9a-fA-F]{1,4}$/.test(g)) return null;
    }
    return groups;
  };

  const left = toGroups(halves[0]);
  if (left === null) return null;
  const right = halves.length === 2 ? toGroups(halves[1]) : [];
  if (right === null) return null;

  const groups = [...left];
  if (halves.length === 1) {
    if (groups.length !== 8) return null;
  } else {
    const fill = 8 - groups.length - right.length;
    // "::" 至少要压缩掉一个 0 组
    if (fill < 1) return null;
    groups.push(...Array.from({ length: fill }, () => '0'), ...right);
  }
  if (groups.length !== 8) return null;

  let n = 0n;
  for (const g of groups) n = (n << 16n) | BigInt(parseInt(g, 16));
  return n;
}

/** 按 RFC 5952 输出压缩形式 */
function formatIpv6(n: bigint): string {
  const groups: string[] = [];
  for (let i = 7; i >= 0; i -= 1) groups.push(((n >> BigInt(i * 16)) & 0xffffn).toString(16));
  let bestStart = -1;
  let bestLen = 0;
  let curStart = -1;
  let curLen = 0;
  groups.forEach((g, i) => {
    if (g === '0') {
      if (curStart < 0) {
        curStart = i;
        curLen = 1;
      } else {
        curLen += 1;
      }
      if (curLen > bestLen) {
        bestLen = curLen;
        bestStart = curStart;
      }
    } else {
      curStart = -1;
      curLen = 0;
    }
  });
  if (bestLen > 1) {
    const head = groups.slice(0, bestStart).join(':');
    const tail = groups.slice(bestStart + bestLen).join(':');
    return `${head}::${tail}`;
  }
  return groups.join(':');
}

function maskOf(prefix: number, version: IpVersion): bigint {
  const bits = version === 4 ? V4_BITS : V6_BITS;
  const hostBits = bits - BigInt(prefix);
  if (hostBits === 0n) return (1n << bits) - 1n;
  return (((1n << hostBits) - 1n) ^ ((1n << bits) - 1n)) & ((1n << bits) - 1n);
}

/**
 * 解析 IPv4 / IPv6（可带 /prefix）。
 * 不带前缀时按单主机处理（v4 = /32，v6 = /128）。
 */
export function parseIpQuery(input: string): ToolResult<IpInfo> {
  const trimmed = input.trim();
  if (!trimmed) return { ok: false, error: 'EMPTY' };

  const version: IpVersion = trimmed.includes(':') ? 6 : 4;
  const maxPrefix = version === 4 ? 32 : 128;
  const bits = version === 4 ? V4_BITS : V6_BITS;

  let addressPart = trimmed;
  let prefix = maxPrefix;
  const slash = trimmed.indexOf('/');
  if (slash >= 0) {
    addressPart = trimmed.slice(0, slash).trim();
    const prefixStr = trimmed.slice(slash + 1).trim();
    if (!/^\d{1,3}$/.test(prefixStr)) return { ok: false, error: 'INVALID_PREFIX' };
    prefix = Number(prefixStr);
    if (prefix > maxPrefix) return { ok: false, error: 'INVALID_PREFIX' };
  }

  const ip = version === 4 ? parseIpv4(addressPart) : parseIpv6(addressPart);
  if (ip === null) return { ok: false, error: 'INVALID_ADDRESS' };

  const full = (1n << bits) - 1n;
  const mask = maskOf(prefix, version);
  const network = ip & mask;
  const last = network | (mask ^ full);
  const total = 1n << (bits - BigInt(prefix));
  const pointToPoint = version === 4 ? prefix >= 31 : prefix >= 127;
  const usable = pointToPoint ? total : total - (version === 4 ? 2n : 1n);
  const firstHost = pointToPoint ? network : network + 1n;
  const lastHost = pointToPoint ? last : last - 1n;
  const fmt = version === 4 ? formatIpv4 : formatIpv6;

  return {
    ok: true,
    value: {
      version,
      address: fmt(ip),
      prefix,
      cidr: `${fmt(network)}/${prefix}`,
      network: fmt(network),
      lastAddress: fmt(last),
      firstHost: fmt(firstHost),
      lastHost: fmt(lastHost),
      netmask: fmt(mask),
      wildcard: fmt(mask ^ full),
      total: total.toString(),
      usable: usable < 0n ? '0' : usable.toString(),
      decimal: ip.toString(),
      hex: `0x${ip.toString(16)}`,
      binary: ip.toString(2).padStart(Number(bits), '0'),
    },
  };
}

const MAX_SUBNETS = 4096;

/** 子网划分：把输入网段按 newPrefix 切成等长子网 */
export function splitSubnets(input: string, newPrefix: number): ToolResult<string[]> {
  const base = parseIpQuery(input);
  if (!base.ok) return base;
  const { version, prefix } = base.value;
  const maxPrefix = version === 4 ? 32 : 128;
  if (!Number.isInteger(newPrefix) || newPrefix < prefix || newPrefix > maxPrefix) {
    return { ok: false, error: 'INVALID_SPLIT_PREFIX' };
  }
  const count = 2 ** (newPrefix - prefix);
  if (count > MAX_SUBNETS) {
    return { ok: false, error: 'TOO_MANY_SUBNETS', params: { max: MAX_SUBNETS } };
  }
  const fmt = version === 4 ? formatIpv4 : formatIpv6;
  const network = version === 4 ? parseIpv4(base.value.network) : parseIpv6(base.value.network);
  if (network === null) return { ok: false, error: 'INVALID_ADDRESS' };
  const step = 1n << BigInt(maxPrefix - newPrefix);
  return {
    ok: true,
    value: Array.from(
      { length: count },
      (_, i) => `${fmt(network + step * BigInt(i))}/${newPrefix}`,
    ),
  };
}
