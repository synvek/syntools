import type { ToolResult } from '@/core/types';

export type CidrErrorCode = 'EMPTY' | 'INVALID';

export interface CidrInfo {
  cidr: string;
  network: string;
  broadcast: string;
  firstHost: string;
  lastHost: string;
  netmask: string;
  wildcard: string;
  prefix: number;
  hostCount: number;
  totalAddresses: number;
}

function ipToInt(ip: string): number | null {
  const parts = ip.split('.');
  if (parts.length !== 4) return null;
  let n = 0;
  for (const part of parts) {
    if (!/^\d+$/.test(part)) return null;
    const octet = Number(part);
    if (octet < 0 || octet > 255) return null;
    n = (n << 8) + octet;
  }
  return n >>> 0;
}

function intToIp(n: number): string {
  return [(n >>> 24) & 0xff, (n >>> 16) & 0xff, (n >>> 8) & 0xff, n & 0xff].join('.');
}

/** Parse IPv4 CIDR like 192.168.1.0/24 */
export function parseCidr(input: string): ToolResult<CidrInfo> {
  const trimmed = input.trim();
  if (!trimmed) return { ok: false, error: 'EMPTY' };

  const slash = trimmed.indexOf('/');
  if (slash < 0) return { ok: false, error: 'INVALID' };
  const ipStr = trimmed.slice(0, slash).trim();
  const prefixStr = trimmed.slice(slash + 1).trim();
  if (!/^\d+$/.test(prefixStr)) return { ok: false, error: 'INVALID' };
  const prefix = Number(prefixStr);
  if (prefix < 0 || prefix > 32) return { ok: false, error: 'INVALID' };

  const ip = ipToInt(ipStr);
  if (ip === null) return { ok: false, error: 'INVALID' };

  const mask = prefix === 0 ? 0 : (0xffffffff << (32 - prefix)) >>> 0;
  const network = (ip & mask) >>> 0;
  const broadcast = (network | (~mask >>> 0)) >>> 0;
  const totalAddresses = 2 ** (32 - prefix);
  const hostCount = prefix >= 31 ? 0 : totalAddresses - 2;
  const firstHost = prefix >= 31 ? network : (network + 1) >>> 0;
  const lastHost = prefix >= 31 ? broadcast : (broadcast - 1) >>> 0;

  return {
    ok: true,
    value: {
      cidr: `${intToIp(network)}/${prefix}`,
      network: intToIp(network),
      broadcast: intToIp(broadcast),
      firstHost: intToIp(firstHost),
      lastHost: intToIp(lastHost),
      netmask: intToIp(mask),
      wildcard: intToIp((~mask) >>> 0),
      prefix,
      hostCount,
      totalAddresses,
    },
  };
}
